import lumaCode from '@/shaders/luma.wgsl?raw';
import gridCode from '@/shaders/grid.wgsl?raw';
import commonCode from '@/shaders/common.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { qrLayout } from '@/qr/layout';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE } from './palette';

const FRAME = 4;

// Marks cells for the current frame: the value lands in grid bits 8+ (see grid.wgsl).
export type Overlay = (time: number, mark: (row: number, col: number, value: number) => void) => void;
export type OverlayFactory = (data: QrMatrix, seed: number, inverted: boolean) => Overlay;

export interface GridShaderState {
    uniforms: Float32Array;
    grid: Uint32Array;
    frameGrid: Uint32Array;
    gridBuffer: GPUBuffer;
    overlay?: Overlay;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
}

// An animation drawn entirely by a fragment shader from the QR grid: no game state, only time.
export function gridShaderAnimation(shaderCode: string, overlay?: OverlayFactory): QrAnimation<GridShaderState> {
    let shaderModule: GPUShaderModule | undefined;
    return {
        createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, options?: AnimationOptions): GridShaderState {
            const { reserved } = qrLayout(data);
            const size = data.length + 2 * FRAME;
            const grid = new Uint32Array(size * size).fill(2 | 8);
            data.forEach((line, row) =>
                line.forEach((dark, col) => {
                    grid[(row + FRAME) * size + col + FRAME] = (dark ? 1 : 0) | (reserved[row][col] ? 2 : 0);
                }),
            );
            const gridBuffer = device.createBuffer({ size: grid.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(gridBuffer, 0, grid);

            const { neon, accent, dark, light } = options?.palette ?? DEFAULT_PALETTE;
            const uniforms = new Float32Array([0, size, options?.inverted ? 1 : 0, seed, ...neon, 0, ...accent, 0, ...dark, 0, ...light, 0]);
            const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const pipeline = device.createRenderPipeline({
                layout: 'auto',
                vertex: { module: shaderModule!, entryPoint: 'vertShader' },
                fragment: { module: shaderModule!, entryPoint: 'fragmentShader', targets: [{ format }] },
                primitive: { topology: 'triangle-list' },
            });
            const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                    { binding: 1, resource: { buffer: gridBuffer } },
                ],
            });
            return {
                uniforms, grid, frameGrid: grid.slice(), gridBuffer, uniformBuffer, bindGroup, pipeline,
                overlay: overlay?.(data, seed, !!options?.inverted),
            };
        },

        frame: function (device: GPUDevice, outTexture: GPUTextureView, state: GridShaderState, delta: number): void {
            state.uniforms[0] += delta;
            device.queue.writeBuffer(state.uniformBuffer, 0, state.uniforms);
            if (state.overlay) {
                const { grid, frameGrid } = state;
                const size = state.uniforms[1];
                frameGrid.set(grid);
                state.overlay(state.uniforms[0], (row, col, value) => {
                    frameGrid[(row + FRAME) * size + col + FRAME] |= value << 8;
                });
                device.queue.writeBuffer(state.gridBuffer, 0, frameGrid);
            }
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{ view: outTexture, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
            });
            pass.setPipeline(state.pipeline);
            pass.setBindGroup(0, state.bindGroup);
            pass.draw(3);
            pass.end();
            device.queue.submit([encoder.finish()]);
        },

        init: async function (device: GPUDevice): Promise<void> {
            shaderModule ??= await compileShader(device, lumaCode + gridCode + commonCode + shaderCode);
        },
    };
}

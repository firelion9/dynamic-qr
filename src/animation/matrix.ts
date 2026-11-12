import lumaCode from '@/shaders/luma.wgsl?raw';
import commonCode from '@/shaders/common.wgsl?raw';
import shaderCode from '@/shaders/matrix.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { qrLayout } from '@/qr/layout';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE } from './palette';

const FRAME = 4;

let shaderModule: GPUShaderModule;

export interface MatrixAnimationState {
    uniforms: Float32Array;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
}

export const MatrixAnimation: QrAnimation<MatrixAnimationState> = {
    createState: function (device: GPUDevice, data: QrMatrix, _seed: number, format: GPUTextureFormat, options?: AnimationOptions): MatrixAnimationState {
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
        const uniforms = new Float32Array([0, size, options?.inverted ? 1 : 0, 0, ...neon, 0, ...accent, 0, ...dark, 0, ...light, 0]);
        const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: shaderModule, entryPoint: 'vertShader' },
            fragment: { module: shaderModule, entryPoint: 'fragmentShader', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
        });
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: { buffer: gridBuffer } },
            ],
        });
        return { uniforms, uniformBuffer, bindGroup, pipeline };
    },

    frame: function (device: GPUDevice, outTexture: GPUTextureView, state: MatrixAnimationState, delta: number): void {
        state.uniforms[0] += delta;
        device.queue.writeBuffer(state.uniformBuffer, 0, state.uniforms);
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
        shaderModule ??= await compileShader(device, lumaCode + commonCode + shaderCode);
    },
};

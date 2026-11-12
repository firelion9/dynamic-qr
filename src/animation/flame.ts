import shaderCode from '@/shaders/flame.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE, FLAME_PALETTE, Palette } from './palette';
import { FlameGame, FlameOptions, FlameStage } from './flame-game';

const TICKS_PER_SECOND = 10;

let shaderModule: GPUShaderModule;

export interface FlameAnimationState {
    game: FlameGame;
    grid: Uint32Array;
    gridBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    time: number;
    ticks: number;
    palette: Palette;
    inverted: boolean;
}

export function flameAnimation(options?: FlameOptions): QrAnimation<FlameAnimationState> {
    return {
        createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, animationOptions?: AnimationOptions): FlameAnimationState {
            const game = new FlameGame(data, seed, options);
            const size = game.gridSize;
            const grid = new Uint32Array(size * size);

            const gridBuffer = device.createBuffer({ size: grid.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            const uniformBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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

            const palette = animationOptions?.palette ?? FLAME_PALETTE;
            const state = { game, grid, gridBuffer, uniformBuffer, bindGroup, pipeline, time: 0, ticks: 0, palette, inverted: !!animationOptions?.inverted };
            updateGrid(device, state);
            return state;
        },

        frame: function (device: GPUDevice, outTexture: GPUTextureView, state: FlameAnimationState, delta: number): void {
            state.time += delta;
            const ticks = Math.floor(state.time * TICKS_PER_SECOND);
            if (ticks > state.ticks) {
                for (; state.ticks < ticks; state.ticks++) state.game.tick();
                updateGrid(device, state);
            }

            const { neon, accent, dark, light } = state.palette;
            const tickFraction = (state.time * TICKS_PER_SECOND) % 1;
            const uniforms = [state.time, state.game.gridSize, tickFraction, state.inverted ? 1 : 0, ...neon, 0, ...accent, 0, ...dark, 0, ...light, 0];
            device.queue.writeBuffer(state.uniformBuffer, 0, new Float32Array(uniforms));

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{ view: outTexture, clearValue: { r: 1, g: 1, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
            });
            pass.setPipeline(state.pipeline);
            pass.setBindGroup(0, state.bindGroup);
            pass.draw(3);
            pass.end();
            device.queue.submit([encoder.finish()]);
        },

        init: async function (device: GPUDevice): Promise<void> {
            shaderModule ??= await compileShader(device, shaderCode);
        },
    };
}

export const FlameAnimation = flameAnimation();

function updateGrid(device: GPUDevice, state: FlameAnimationState): void {
    const { game, grid } = state;
    const size = game.gridSize;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = game.cells[r][c];
            const isDark = cell.originalDark || cell.stage === FlameStage.Charcoal || cell.stage === FlameStage.Firing;
            const flags = (isDark ? 1 : 0)
                | (cell.isReserved ? 2 : 0)
                | (cell.isFuel ? 4 : 0)
                | (cell.stage << 4)
                | (Math.min(cell.ticks, 255) << 8)
                | (((r * 31 + c * 17) & 255) << 16);

            grid[r * size + c] = flags;
        }
    }

    device.queue.writeBuffer(state.gridBuffer, 0, grid);
}

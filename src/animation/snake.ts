import shaderCode from '@/shaders/snake.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { compileShader, QrAnimation } from './utils';
import { SnakeGame, SnakeOptions } from './snake-game';

const FRAME = 4;
const TICKS_PER_SECOND = 8;

let shaderModule: GPUShaderModule;

export interface SnakeAnimationState {
    game: SnakeGame;
    base: Uint32Array;
    grid: Uint32Array;
    gridBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    time: number;
    ticks: number;
}

function snakeAnimation(options: SnakeOptions): QrAnimation<SnakeAnimationState> {
    return {
        createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat): SnakeAnimationState {
            const game = new SnakeGame(data, seed, options);
            const size = data.length + 2 * FRAME;
            const base = new Uint32Array(size * size).fill(2 | 8);
            data.forEach((line, row) =>
                line.forEach((dark, col) => {
                    base[(row + FRAME) * size + col + FRAME] = (dark ? 1 : 0) | (game.layout.reserved[row][col] ? 2 : 0);
                }),
            );

            const gridBuffer = device.createBuffer({ size: base.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            const uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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

            const state = { game, base, grid: new Uint32Array(base), gridBuffer, uniformBuffer, bindGroup, pipeline, time: 0, ticks: 0 };
            updateGrid(device, state);
            return state;
        },

        frame: function (device: GPUDevice, outTexture: GPUTextureView, state: SnakeAnimationState, delta: number): void {
            state.time += delta;
            const ticks = Math.floor(state.time * TICKS_PER_SECOND);
            if (ticks > state.ticks) {
                for (; state.ticks < ticks; state.ticks++) state.game.tick();
                updateGrid(device, state);
            }
            device.queue.writeBuffer(state.uniformBuffer, 0, new Float32Array([state.time, Math.sqrt(state.grid.length), 0, 0]));

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

function updateGrid(device: GPUDevice, state: SnakeAnimationState): void {
    const { dark, cells } = state.game.frame();
    const size = Math.sqrt(state.grid.length);
    state.grid.set(state.base);
    cells.forEach((line, row) =>
        line.forEach(({ sprite, index, dir, snake }, col) => {
            const i = (row + FRAME) * size + col + FRAME;
            state.grid[i] = (state.grid[i] & ~1) | (dark[row][col] ? 1 : 0) | (sprite << 4) | (Math.min(index, 255) << 8) | (dir << 16) | (snake << 18);
        }),
    );
    device.queue.writeBuffer(state.gridBuffer, 0, state.grid);
}

export const SnakeAnimation = snakeAnimation({ snakes: 1, length: 10 });
export const SnakeDuelAnimation = snakeAnimation({ snakes: 2, length: 8 });

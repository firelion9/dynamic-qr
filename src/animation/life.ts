import shaderCode from '@/shaders/life.wgsl?raw';
import type { QrMatrix } from '@/qr/encode';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE, Palette } from './palette';
import { LIFE_FRAME_PADDING, LifeGame, LifeOptions } from './life-game';

const TICKS_PER_SECOND = 8;

let shaderModule: GPUShaderModule;

export interface LifeAnimationState {
    game: LifeGame;
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

export function lifeAnimation(options?: LifeOptions): QrAnimation<LifeAnimationState> {
    return {
        createState: function (
            device: GPUDevice,
            data: QrMatrix,
            seed: number,
            format: GPUTextureFormat,
            animationOptions?: AnimationOptions,
        ): LifeAnimationState {
            const game = new LifeGame(data, seed, options);
            const size = game.gridSize;
            const grid = new Uint32Array(size * size);

            const gridBuffer = device.createBuffer({
                size: grid.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const uniformBuffer = device.createBuffer({
                size: 80,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
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

            const palette = animationOptions?.palette ?? DEFAULT_PALETTE;
            const state: LifeAnimationState = {
                game,
                grid,
                gridBuffer,
                uniformBuffer,
                bindGroup,
                pipeline,
                time: 0,
                ticks: 0,
                palette,
                inverted: !!animationOptions?.inverted,
            };
            updateGrid(device, state);
            return state;
        },

        frame: function (
            device: GPUDevice,
            outTexture: GPUTextureView,
            state: LifeAnimationState,
            delta: number,
        ): void {
            state.time += delta;
            const ticks = Math.floor(state.time * TICKS_PER_SECOND);
            if (ticks > state.ticks) {
                for (; state.ticks < ticks; state.ticks++) state.game.tick();
                updateGrid(device, state);
            }

            const { neon, accent, dark, light } = state.palette;
            const tickProgress = (state.time * TICKS_PER_SECOND) % 1;

            const uniforms = [
                state.time,
                state.game.gridSize,
                tickProgress,
                state.inverted ? 1 : 0,
                ...neon,
                0,
                ...accent,
                0,
                ...dark,
                0,
                ...light,
                0,
            ];
            device.queue.writeBuffer(state.uniformBuffer, 0, new Float32Array(uniforms));

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: outTexture,
                        clearValue: { r: 1, g: 1, b: 1, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
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

export const LifeAnimation = lifeAnimation();

function updateGrid(device: GPUDevice, state: LifeAnimationState): void {
    const { game, grid } = state;
    const { dark, cells } = game.frame();
    const qrSize = game.size;
    const totalSize = game.gridSize;

    grid.fill(2);

    for (let r = 0; r < qrSize; r++) {
        for (let c = 0; c < qrSize; c++) {
            const cell = cells[r][c];
            const isDark = dark[r][c];
            const isReserved = cell.isReserved;

            const flags =
                (isDark ? 1 : 0) |
                (isReserved ? 2 : 0) |
                (cell.justBorn ? 4 : 0) |
                (cell.justDied ? 8 : 0) |
                ((cell.age & 15) << 4);

            const index = (r + LIFE_FRAME_PADDING) * totalSize + (c + LIFE_FRAME_PADDING);
            grid[index] = flags;
        }
    }

    device.queue.writeBuffer(state.gridBuffer, 0, grid);
}

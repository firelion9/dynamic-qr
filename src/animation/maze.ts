import commonCode from '@/shaders/common.wgsl?raw';
import shaderCode from '@/shaders/maze.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE, Palette } from './palette';
import { DEATH_TICKS, MazeGame, MazeOptions, POWER_TICKS } from './maze-game';

const FRAME = 4;
const TICKS_PER_SECOND = 7;

let shaderModule: GPUShaderModule;

export interface MazeAnimationState {
    game: MazeGame;
    corridorDark: boolean;
    grid: Uint32Array;
    gridBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    time: number;
    ticks: number;
    palette: Palette;
}

function mazeAnimation(options: MazeOptions): QrAnimation<MazeAnimationState> {
    return {
        createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, animationOptions?: AnimationOptions): MazeAnimationState {
            const game = new MazeGame(data, seed, options);
            const size = data.length + 2 * FRAME;
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

            const palette = animationOptions?.palette ?? DEFAULT_PALETTE;
            const state = { game, corridorDark: options.corridorDark, grid, gridBuffer, uniformBuffer, bindGroup, pipeline, time: 0, ticks: 0, palette };
            updateGrid(device, state);
            return state;
        },

        frame: function (device: GPUDevice, outTexture: GPUTextureView, state: MazeAnimationState, delta: number): void {
            state.time += delta;
            const ticks = Math.floor(state.time * TICKS_PER_SECOND);
            if (ticks > state.ticks) {
                for (; state.ticks < ticks; state.ticks++) state.game.tick();
                updateGrid(device, state);
            }
            const { game } = state;
            const { neon, accent, dark, light } = state.palette;
            const uniforms = [state.time, Math.sqrt(state.grid.length), game.powered / POWER_TICKS, game.hero.wait / DEATH_TICKS, ...neon, 0, ...accent, 0, ...dark, 0, ...light, 0];
            device.queue.writeBuffer(state.uniformBuffer, 0, new Float32Array(uniforms));

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
            shaderModule ??= await compileShader(device, commonCode + shaderCode);
        },
    };
}

function updateGrid(device: GPUDevice, state: MazeAnimationState): void {
    const { game, grid, corridorDark } = state;
    const { dark, lit } = game.frame();
    const size = Math.sqrt(grid.length);
    const index = ([r, c]: [number, number]) => (r + FRAME) * size + c + FRAME;

    grid.fill((corridorDark ? 1 : 0) | 2 | 8);
    dark.forEach((line, r) =>
        line.forEach((d, c) => {
            grid[index([r, c])] = (d !== corridorDark ? 1 : 0) | (game.layout.reserved[r][c] ? 2 : 0) | (lit[r][c] ? 4 : 0);
        }),
    );
    for (const key of game.pellets) grid[index(game.point(key))] |= 16;
    for (const key of game.power) grid[index(game.point(key))] |= 32;

    const put = (at: [number, number], actor: number, dir: number, mood: number) => {
        grid[index(at)] = (grid[index(at)] & 0xff) | (actor << 8) | (dir << 11) | (mood << 13);
    };
    game.ghosts.forEach((g, i) => g.wait === 0 && put(g.at, 2 + i, g.dir, g.scared ? 1 : 0));
    const hero = game.hero;
    put(hero.at, 1, hero.dir, hero.wait > 0 ? 2 : game.powered > 0 ? 1 : 0);

    device.queue.writeBuffer(state.gridBuffer, 0, grid);
}

export const MazeAnimation = mazeAnimation({ corridorDark: true, ghosts: 3 });
export const MazeNightAnimation = mazeAnimation({ corridorDark: false, ghosts: 3 });

import lumaCode from '@/shaders/luma.wgsl?raw';
import commonCode from '@/shaders/common.wgsl?raw';
import shaderCode from '@/shaders/train.wgsl?raw';
import { QrMatrix } from '@/qr/encode';
import { AnimationOptions, compileShader, QrAnimation } from './utils';
import { DEFAULT_PALETTE, Palette } from './palette';
import { SnakeGame, SnakeOptions } from './snake-game';

const FRAME = 4;
const TICKS_PER_SECOND = 8;
const MAX_GLYPHS = 64;

let shaderModule: GPUShaderModule;

function rasterizeChar(ch: string, N = 24): number[] {
    if (typeof document === 'undefined') {
        return new Array(N).fill(0);
    }
    const canvas = document.createElement('canvas');
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Array(N).fill(0);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, N, N);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, N / 2, N / 2);

    const img = ctx.getImageData(0, 0, N, N);
    const rows = new Array<number>(N).fill(0);
    for (let y = 1; y < N - 1; y++) {
        let r = 0;
        for (let x = 1; x < N - 1; x++) {
            if (img.data[(y * N + x) * 4] > 70) {
                r |= (1 << (N - 1 - x));
            }
        }
        rows[y] = r;
    }
    return rows;
}

export function parseTrainText(raw?: string): string[] {
    const text = (raw ?? 'ИТМО').trim() || 'ИТМО';
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter().segment(text)).map(s => s.segment);
    }
    return Array.from(text);
}

export interface TrainAnimationState {
    game: SnakeGame;
    base: Uint32Array;
    grid: Uint32Array;
    gridBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    glyphBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    time: number;
    ticks: number;
    palette: Palette;
    inverted: boolean;
    chars: string[];
}

export function trainAnimation(options?: Partial<SnakeOptions>): QrAnimation<TrainAnimationState> {
    const baseOptions: SnakeOptions = { snakes: 1, length: 6, ...options };
    return {
        createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, animationOptions?: AnimationOptions): TrainAnimationState {
            const chars = parseTrainText(animationOptions?.trainText);
            const trainLength = chars.length + 2;
            const game = new SnakeGame(data, seed, { ...baseOptions, length: trainLength });
            const size = data.length + 2 * FRAME;
            const base = new Uint32Array(size * size).fill(2 | 8);
            data.forEach((line, row) =>
                line.forEach((dark, col) => {
                    base[(row + FRAME) * size + col + FRAME] = (dark ? 1 : 0) | (game.layout.reserved[row][col] ? 2 : 0);
                }),
            );

            const gridBuffer = device.createBuffer({ size: base.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            const uniformBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const glyphBuffer = device.createBuffer({ size: MAX_GLYPHS * 24 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

            const glyphData = new Uint32Array(MAX_GLYPHS * 24);
            for (let i = 0; i < chars.length && i < MAX_GLYPHS; i++) {
                const rows = rasterizeChar(chars[i].toUpperCase(), 24);
                for (let r = 0; r < 24; r++) {
                    glyphData[i * 24 + r] = rows[r];
                }
            }
            device.queue.writeBuffer(glyphBuffer, 0, glyphData);

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
                    { binding: 2, resource: { buffer: glyphBuffer } },
                ],
            });

            const palette = animationOptions?.palette ?? DEFAULT_PALETTE;
            const state = { game, base, grid: new Uint32Array(base), gridBuffer, uniformBuffer, glyphBuffer, bindGroup, pipeline, time: 0, ticks: 0, palette, inverted: !!animationOptions?.inverted, chars };
            updateGrid(device, state);
            return state;
        },

        frame: function (device: GPUDevice, outTexture: GPUTextureView, state: TrainAnimationState, delta: number): void {
            state.time += delta;
            const ticks = Math.floor(state.time * TICKS_PER_SECOND);
            if (ticks > state.ticks) {
                for (; state.ticks < ticks; state.ticks++) state.game.tick();
                updateGrid(device, state);
            }
            const { neon, accent, dark, light } = state.palette;
            const uniforms = [state.time, Math.sqrt(state.grid.length), state.inverted ? 1 : 0, state.chars.length, ...neon, 0, ...accent, 0, ...dark, 0, ...light, 0];
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
            shaderModule ??= await compileShader(device, lumaCode + commonCode + shaderCode);
        },
    };
}

function updateGrid(device: GPUDevice, state: TrainAnimationState): void {
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

export const TrainAnimation = trainAnimation({ snakes: 1, length: 6 });

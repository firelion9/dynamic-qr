import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { AnimationOptions, QrAnimation } from '@/animation/utils';
import type { QrMatrix } from '@/qr/encode';

export type ExportFormat = 'mp4' | 'gif';

export interface ExportOptions extends Partial<AnimationOptions> {
    format: ExportFormat;
    size: number;
    seconds: number;
    fps: number;
    speed?: number;
    onProgress?: (done: number) => void;
}

interface FrameWriter {
    add(pixels: Uint8Array, index: number): Promise<void>;
    finish(): Promise<Blob>;
}

export async function exportAnimation<S>(
    device: GPUDevice,
    animation: QrAnimation<S>,
    matrix: QrMatrix,
    seed: number,
    options: ExportOptions,
): Promise<Blob> {
    const { size, fps } = options;
    const frames = Math.round(options.seconds * fps);
    const state = animation.createState(device, matrix, seed, 'rgba8unorm', options.palette && { palette: options.palette });
    const writer = options.format === 'mp4' ? await mp4Writer(size, fps) : gifWriter(size, fps);
    const reader = new FrameReader(device, size);
    try {
        for (let i = 0; i < frames; i++) {
            animation.frame(device, reader.view, state, i === 0 ? 0 : (options.speed ?? 1) / fps);
            await writer.add(await reader.read(), i);
            options.onProgress?.((i + 1) / frames);
        }
        return await writer.finish();
    } finally {
        reader.destroy();
    }
}

class FrameReader {
    readonly view: GPUTextureView;
    private readonly texture: GPUTexture;
    private readonly buffer: GPUBuffer;
    private readonly pixels: Uint8Array;
    private readonly bytesPerRow: number;

    constructor(private readonly device: GPUDevice, private readonly size: number) {
        this.texture = device.createTexture({
            size: [size, size],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        this.view = this.texture.createView();
        this.bytesPerRow = Math.ceil((size * 4) / 256) * 256;
        this.buffer = device.createBuffer({ size: this.bytesPerRow * size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        this.pixels = new Uint8Array(size * size * 4);
    }

    async read(): Promise<Uint8Array> {
        const { device, size, bytesPerRow } = this;
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: this.texture }, { buffer: this.buffer, bytesPerRow }, [size, size]);
        device.queue.submit([encoder.finish()]);
        await this.buffer.mapAsync(GPUMapMode.READ);
        const mapped = new Uint8Array(this.buffer.getMappedRange());
        for (let row = 0; row < size; row++) {
            this.pixels.set(mapped.subarray(row * bytesPerRow, row * bytesPerRow + size * 4), row * size * 4);
        }
        this.buffer.unmap();
        return this.pixels;
    }

    destroy(): void {
        this.texture.destroy();
        this.buffer.destroy();
    }
}

// Constrained Baseline first: Firefox encodes H.264 with OpenH264, which supports nothing else.
const AVC_CODECS = ['avc1.42e033', 'avc1.640033'];

async function mp4Writer(size: number, fps: number): Promise<FrameWriter> {
    let config: VideoEncoderConfig | null = null;
    for (const codec of AVC_CODECS) {
        const candidate: VideoEncoderConfig = {
            codec,
            width: size,
            height: size,
            framerate: fps,
            bitrate: Math.round(size * size * fps * 0.2),
            avc: { format: 'avc' },
        };
        if ((await VideoEncoder.isConfigSupported(candidate)).supported) {
            config = candidate;
            break;
        }
    }
    if (!config) throw new Error('Браузер не умеет кодировать MP4 такого размера, попробуйте GIF');

    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: size, height: size },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
    });
    let failure: unknown = null;
    const encoder = new VideoEncoder({
        output: (chunk, meta) => {
            try {
                muxer.addVideoChunk(chunk, meta);
            } catch (e) {
                failure ??= e;
            }
        },
        error: e => (failure ??= e),
    });
    encoder.configure(config);
    const frameUs = Math.round(1e6 / fps);

    return {
        async add(pixels, index) {
            if (failure) throw failure;
            const frame = new VideoFrame(pixels, { format: 'RGBA', codedWidth: size, codedHeight: size, timestamp: index * frameUs, duration: frameUs });
            encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
            frame.close();
            while (encoder.encodeQueueSize > 8) await new Promise(resolve => setTimeout(resolve, 1));
        },
        async finish() {
            await encoder.flush();
            encoder.close();
            if (failure) throw failure;
            muxer.finalize();
            return new Blob([muxer.target.buffer], { type: 'video/mp4' });
        },
    };
}

function gifWriter(size: number, fps: number): FrameWriter {
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    return {
        async add(pixels) {
            const palette = quantize(pixels, 256);
            gif.writeFrame(applyPalette(pixels, palette), size, size, { palette, delay });
        },
        async finish() {
            gif.finish();
            return new Blob([gif.bytes()], { type: 'image/gif' });
        },
    };
}

export function download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

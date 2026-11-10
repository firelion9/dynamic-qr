import { FrameRenderer } from "@/gpuState";
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function exportToGif(device: GPUDevice, renderer: FrameRenderer, fps = 30, width: number, height: number, durationSec = 5.0): Promise<Blob> {

    const totalFrames = Math.round(fps * durationSec);
    const delta = 1 / fps;
    const delayMs = Math.round(1000 / fps);

    const bytesPerPixel = 4; // rgba8unorm
    const texture = device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });


    // For some reason you can read rows only by multiples of 256
    const unpaddedBytesPerRow = width * bytesPerPixel;
    const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;
    const bufferSize = paddedBytesPerRow * height;
    const readBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const unpaddedData = new Uint8Array(width * height * bytesPerPixel);

    const gif = GIFEncoder();
    for (let frame = 0; frame < totalFrames; frame++) {

        const textureView = texture.createView();
        renderer.render(device, textureView, delta);

        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture },
            { buffer: readBuffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: height },
            [width, height, 1],
        );

        device.queue.submit([commandEncoder.finish()]);


        await readBuffer.mapAsync(GPUMapMode.READ);
        const mapped = new Uint8Array(readBuffer.getMappedRange());

        for (let r = 0; r < height; r++) {
            const srcOff = r * paddedBytesPerRow;
            const destOff = r * unpaddedBytesPerRow;
            unpaddedData.set(mapped.subarray(srcOff, srcOff + unpaddedBytesPerRow), destOff);

        }
        readBuffer.unmap();

        const palette = quantize(unpaddedData, 256);
        const index = applyPalette(unpaddedData, palette);



        gif.writeFrame(index, width, height, { palette, delay: delayMs });
    }

    texture.destroy();
    readBuffer.destroy();

    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
}
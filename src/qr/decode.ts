import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { QrMatrix } from './encode';

prepareZXingModule({
    overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
});

export interface DecodedQr {
    text: string;
    matrix: QrMatrix;
}

export async function decodeQr(image: Blob | ImageData): Promise<DecodedQr | null> {
    const imageData = image instanceof Blob ? await toImageData(image) : image;
    const [result] = await readBarcodes(imageData, { formats: ['QRCode'], tryInvert: true });
    if (!result?.isValid) return null;

    const { width, height, data } = result.symbol;
    const matrix = Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, col) => data[row * width + col] === 0),
    );
    return { text: result.text, matrix };
}

async function toImageData(blob: Blob): Promise<ImageData> {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

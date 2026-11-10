import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prepareZXingModule } from 'zxing-wasm/reader';
import type { QrMatrix } from './encode';

export async function loadZxing() {
    const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'));
    await prepareZXingModule({
        overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) },
        fireImmediately: true,
    });
}

export function render(matrix: QrMatrix, { scale = 6, quiet = 4, rotate = false, invert = false } = {}): ImageData {
    const n = matrix.length;
    const side = (n + 2 * quiet) * scale;
    const data = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
            const [r, c] = [Math.floor(y / scale) - quiet, Math.floor(x / scale) - quiet];
            const [row, col] = rotate ? [n - 1 - c, r] : [r, c];
            const dark = row >= 0 && row < n && col >= 0 && col < n && matrix[row][col];
            const v = dark !== invert ? 0 : 255;
            data.set([v, v, v, 255], (y * side + x) * 4);
        }
    }
    return { data, width: side, height: side, colorSpace: 'srgb' } as ImageData;
}

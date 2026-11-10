import type { QrMatrix } from '@/qr/encode';

export function drawQr(canvas: HTMLCanvasElement, matrix: QrMatrix, color = '#000000'): void {
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = size / matrix.length;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix.length; c++) {
            if (matrix[r][c]) {
                ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
            }
        }
    }
}
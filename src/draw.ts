import type { QrMatrix } from '@/qr/encode';

const QUIET_ZONE = 4;

export function drawQr(canvas: HTMLCanvasElement, matrix: QrMatrix, dark = '#000000', light = '#ffffff'): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = canvas.width / (matrix.length + 2 * QUIET_ZONE);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = dark;
    matrix.forEach((line, r) =>
        line.forEach((isDark, c) => {
            if (isDark) ctx.fillRect((c + QUIET_ZONE) * cell, (r + QUIET_ZONE) * cell, cell + 0.5, cell + 0.5);
        }),
    );
}

// A canvas keeps the first context type it was asked for, so switching between 2d and webgpu needs a new element.
export function freshCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const copy = canvas.cloneNode() as HTMLCanvasElement;
    canvas.replaceWith(copy);
    return copy;
}

export function fitCanvas(canvas: HTMLCanvasElement, fallback = canvas.width): void {
    const side = Math.round((canvas.clientWidth || fallback) * devicePixelRatio);
    canvas.width = side;
    canvas.height = side;
}

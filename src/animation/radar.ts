import type { QrMatrix } from '@/qr/encode';
import { qrLayout } from '@/qr/layout';
import type { Overlay } from './grid-shader';
import { random } from './random';

// Marks for radar.wgsl: a ship is a head and a body cell, +2 when the module has to stay light; then the trail.
const HEAD = 1;
const BODY = 2;
const LIGHT = 2;
const TRAIL = 5;
const LENGTH = 5;

// Ships cross the screen in straight lines. The blip is solid black wherever the error budget allows it.
export function radarShips(data: QrMatrix, seed: number, inverted: boolean): Overlay {
    const layout = qrLayout(data);
    const n = data.length;
    const rand = random(seed);
    const ships = Array.from({ length: Math.max(3, Math.round(n / 8)) }, () => {
        const angle = rand() * 2 * Math.PI;
        const speed = 0.7 + rand() * 0.8;
        return { x: rand() * n, y: rand() * n, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed };
    });
    const wrap = (v: number) => ((Math.floor(v) % n) + n) % n;

    return (time, mark) => {
        const limit = layout.blocks.map(b => Math.floor(b.capacity * 0.5));
        const used = layout.blocks.map(() => 0);
        const flipped = new Set<number>();
        const canDarken = (row: number, col: number): boolean => {
            if (data[row][col] !== inverted) return true;
            if (layout.reserved[row][col]) return false;
            const cw = layout.codeword[row][col];
            if (cw < 0 || flipped.has(cw)) return true;
            const block = layout.codewordBlock[cw];
            if (used[block] === limit[block]) return false;
            used[block]++;
            flipped.add(cw);
            return true;
        };

        const marks = new Map<number, number>();
        for (const ship of ships) {
            const step = 1 / Math.hypot(ship.dx, ship.dy);
            for (let k = LENGTH - 1; k >= 0; k--) {
                const t = time - k * step;
                const row = wrap(ship.y + ship.dy * t);
                const col = wrap(ship.x + ship.dx * t);
                const key = row * n + col;
                const value = k > 1 ? TRAIL + k - 2 : (k ? BODY : HEAD) + (canDarken(row, col) ? 0 : LIGHT);
                if (!marks.has(key) || value < marks.get(key)!) marks.set(key, value);
            }
        }
        marks.forEach((value, key) => mark(Math.floor(key / n), key % n, value));
    };
}

import { readBarcodes } from 'zxing-wasm/reader';
import { beforeAll, expect, it } from 'vitest';
import { encodeQr, type EcLevel } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { loadZxing, render } from '@/qr/test-utils';
import { MazeGame } from './maze-game';

const TEXT = 'https://github.com/firelion9/dynamic-qr';
const CASES = (['L', 'M', 'Q', 'H'] as EcLevel[]).flatMap(level => [true, false].map(dark => [level, dark] as const));

beforeAll(loadZxing);

it.each(CASES)('every frame fits the budget at %s, dark corridors: %s', async (level, corridorDark) => {
    const matrix = encodeQr(TEXT, level);
    const game = new MazeGame(matrix, 0.42, { corridorDark, ghosts: 3 });
    for (let tick = 0; tick < 600; tick++) {
        game.tick();
        const frame = game.frame();
        const changed = frame.dark.map((line, r) => line.map((d, c) => d !== matrix[r][c]));
        expect(fitsBudget(game.layout, changed)).toBe(true);
        if (tick % 50 === 0) {
            const [result] = await readBarcodes(render(frame.dark, { invert: !corridorDark }), { formats: ['QRCode'] });
            expect(result?.text).toBe(TEXT);
        }
    }
    expect(game.area.length).toBeGreaterThan(100);
});

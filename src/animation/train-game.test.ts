import { readBarcodes } from 'zxing-wasm/reader';
import { beforeAll, expect, it } from 'vitest';
import { encodeQr, type EcLevel } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { loadZxing, render } from '@/qr/test-utils';
import { SnakeGame, Sprite } from './snake-game';

const TEXT = 'https://itmo.ru';

beforeAll(loadZxing);

it('train starts with 6 pieces (locomotive + 4 ITMO carriages + 1 space wagon)', () => {
    const matrix = encodeQr(TEXT);
    const game = new SnakeGame(matrix, 0.42, { snakes: 1, length: 6 });
    expect(game.snakes[0].body.length).toBe(1);
    for (let tick = 0; tick < 5; tick++) game.tick();
    expect(game.snakes[0].body.length).toBe(6);

    const frame = game.frame();
    const cells = frame.cells;
    const body = game.snakes[0].body;

    const [hr, hc] = body[0];
    expect(cells[hr][hc].index).toBe(0);
    expect([Sprite.Head, Sprite.HeadLight]).toContain(cells[hr][hc].sprite);

    for (let i = 1; i <= 5; i++) {
        const [r, c] = body[i];
        expect(cells[r][c].index).toBe(i);
        expect([Sprite.Body, Sprite.BodyLight]).toContain(cells[r][c].sprite);
    }
});

it('repeats the 5-wagon cycle (4 ITMO logo wagons + 1 space wagon)', () => {
    const matrix = encodeQr(TEXT);
    const game = new SnakeGame(matrix, 0.42, { snakes: 1, length: 16 });
    for (let tick = 0; tick < 16; tick++) game.tick();
    const bodyLength = game.snakes[0].body.length;
    expect(bodyLength).toBeGreaterThanOrEqual(16);
    const frame = game.frame();
    for (let i = 1; i < bodyLength; i++) {
        const [r, c] = game.snakes[0].body[i];
        expect(frame.cells[r][c].index).toBe(i);
        const part = (frame.cells[r][c].index - 1) % 5;
        expect(part).toBe((i - 1) % 5);
    }
});

it.each(['L', 'M', 'Q', 'H'] as EcLevel[])('train animation fits EC budget at %s and decodes with ZXing', async level => {
    const matrix = encodeQr(TEXT, level);
    const game = new SnakeGame(matrix, 0.77, { snakes: 1, length: 6 });
    for (let tick = 0; tick < 200; tick++) {
        game.tick();
        const { dark } = game.frame();
        const changed = dark.map((line, r) => line.map((d, c) => d !== matrix[r][c]));
        expect(fitsBudget(game.layout, changed)).toBe(true);
        if (tick % 40 === 0) {
            const [result] = await readBarcodes(render(dark), { formats: ['QRCode'] });
            expect(result?.text).toBe(TEXT);
        }
    }
});

import { readBarcodes } from 'zxing-wasm/reader';
import { beforeAll, expect, it } from 'vitest';
import { encodeQr, type EcLevel } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { loadZxing, render } from '@/qr/test-utils';
import { SnakeGame, Sprite } from './snake-game';

const TEXT = 'https://github.com/firelion9/dynamic-qr';

beforeAll(loadZxing);

it.each(['L', 'M', 'Q', 'H'] as EcLevel[])('every frame fits the budget at %s', async level => {
    const matrix = encodeQr(TEXT, level);
    const game = new SnakeGame(matrix, 0.42, { snakes: 2, length: 12 });
    let eaten = 0;
    for (let tick = 0; tick < 600; tick++) {
        const apples = game.apples.length;
        game.tick();
        if (game.apples.length < apples) eaten++;
        const { dark } = game.frame();
        const changed = dark.map((line, r) => line.map((d, c) => d !== matrix[r][c]));
        expect(fitsBudget(game.layout, changed)).toBe(true);
        if (tick % 50 === 0) {
            const [result] = await readBarcodes(render(dark), { formats: ['QRCode'] });
            expect(result?.text).toBe(TEXT);
        }
    }
    expect(eaten).toBeGreaterThan(3);
});

it('snakes stay connected and never overlap', () => {
    const game = new SnakeGame(encodeQr(TEXT), 0.7, { snakes: 2, length: 12 });
    for (let tick = 0; tick < 600; tick++) {
        game.tick();
        const cells = game.snakes.flatMap(s => s.body.map(([r, c]) => `${r},${c}`));
        expect(new Set(cells).size).toBe(cells.length);
        for (const { body } of game.snakes) {
            body.slice(1).forEach(([r, c], i) => expect(Math.abs(r - body[i][0]) + Math.abs(c - body[i][1])).toBe(1));
        }
    }
});

it('puts apples only on dark modules', () => {
    const matrix = encodeQr(TEXT);
    const game = new SnakeGame(matrix, 0.1, { snakes: 1, length: 8 });
    for (let tick = 0; tick < 100; tick++) game.tick();
    game.frame().cells.forEach((line, r) =>
        line.forEach((cell, c) => cell.sprite === Sprite.Apple && expect(matrix[r][c]).toBe(true)),
    );
});

import { beforeAll, describe, expect, it } from 'vitest';
import { encodeQr } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { decodeQr } from '@/qr/decode';
import { loadZxing, render } from '@/qr/test-utils';
import { LifeGame } from './life-game';

beforeAll(loadZxing);

describe('LifeGame', () => {
    const text = 'https://github.com/firelion9/dynamic-qr';

    it('never touches reserved modules', () => {
        for (const v of [4, 5, 6]) {
            const matrix = encodeQr(text, 'H', v);
            const game = new LifeGame(matrix, 42);

            for (let t = 0; t < 50; t++) {
                game.tick();
                const frame = game.frame();
                for (let r = 0; r < game.size; r++) {
                    for (let c = 0; c < game.size; c++) {
                        if (game.layout.reserved[r][c]) {
                            expect(frame.dark[r][c]).toBe(matrix[r][c]);
                        }
                    }
                }
            }
        }
    });

    it('every frame fits the error correction budget at share=0.5', () => {
        for (const v of [4, 5, 6]) {
            const matrix = encodeQr(text, 'H', v);
            const game = new LifeGame(matrix, 12345, { share: 0.5 });

            for (let t = 0; t < 60; t++) {
                game.tick();
                const frame = game.frame();

                const changed = matrix.map((line, r) =>
                    line.map((dark, c) => dark !== frame.dark[r][c]),
                );

                expect(fitsBudget(game.layout, changed, 0.5)).toBe(true);
            }
        }
    });

    it('frames are decodable with ZXing', async () => {
        const matrix = encodeQr(text, 'H', 5);
        const game = new LifeGame(matrix, 999, { share: 0.5 });

        for (let t = 0; t < 30; t++) {
            game.tick();
            if (t % 6 === 0) {
                const frame = game.frame();
                const decoded = await decodeQr(render(frame.dark));
                expect(decoded?.text).toBe(text);
            }
        }
    });
});

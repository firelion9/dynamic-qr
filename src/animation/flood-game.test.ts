import { readBarcodes } from 'zxing-wasm/reader';
import { beforeAll, describe, expect, it } from 'vitest';
import { encodeQr, type EcLevel } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { loadZxing, render } from '@/qr/test-utils';
import { CellType, FLOOD_FRAME_PADDING, FloodGame } from './flood-game';

const TEXT = 'https://github.com/firelion9/dynamic-qr';

beforeAll(loadZxing);

describe('FloodGame', () => {
    it('never touches reserved modules', () => {
        for (const v of [4, 5, 6]) {
            const matrix = encodeQr(TEXT, 'H', v);
            const game = new FloodGame(matrix, 42);

            for (let t = 0; t < 60; t++) {
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

    it.each(['L', 'M', 'Q', 'H'] as EcLevel[])('every frame fits the error correction budget at %s', level => {
        const matrix = encodeQr(TEXT, level);
        const game = new FloodGame(matrix, 12345, { share: 0.5 });

        for (let t = 0; t < 150; t++) {
            game.tick();
            const frame = game.frame();
            const changed = matrix.map((line, r) =>
                line.map((dark, c) => dark !== frame.dark[r][c]),
            );

            expect(fitsBudget(game.layout, changed, 0.5)).toBe(true);
        }
    });

    it('frames are decodable with ZXing', async () => {
        const matrix = encodeQr(TEXT, 'H', 5);
        const game = new FloodGame(matrix, 999, { share: 0.5 });

        for (let t = 0; t < 80; t++) {
            game.tick();
            if (t % 10 === 0) {
                const frame = game.frame();
                const [result] = await readBarcodes(render(frame.dark), { formats: ['QRCode'] });
                expect(result?.text).toBe(TEXT);
            }
        }
    });

    it('water moves from top to bottom and leaves when reaching bottom', () => {
        const matrix = encodeQr(TEXT, 'H', 4);
        const game = new FloodGame(matrix, 777, { streamCount: 0, surgeInterval: 999999 });

        const col = Math.floor(game.gridSize / 2);
        game.cells[1][col].type = CellType.Water;

        let reachedBottom = false;
        let leftBottom = false;

        for (let t = 0; t < 200; t++) {
            game.tick();
            if (game.cells[game.gridSize - 1].some(c => c.type === CellType.Water)) {
                reachedBottom = true;
            }
            if (reachedBottom && !game.cells[game.gridSize - 1].some(c => c.type === CellType.Water)) {
                leftBottom = true;
                break;
            }
        }

        expect(reachedBottom).toBe(true);
        expect(leftBottom).toBe(true);
    });

    it('breaks pixel under hydrostatic water pressure', () => {
        const matrix = encodeQr(TEXT, 'H', 4);
        const game = new FloodGame(matrix, 555, {
            streamCount: 0,
            surgeInterval: 999999,
            breakThreshold: 4,
            repairTicks: 30,
        });

        let targetR = -1;
        let targetC = -1;
        for (let r = 0; r < game.size; r++) {
            for (let c = 0; c < game.size; c++) {
                if (game.canBreak(r + FLOOD_FRAME_PADDING, c + FLOOD_FRAME_PADDING)) {
                    targetR = r + FLOOD_FRAME_PADDING;
                    targetC = c + FLOOD_FRAME_PADDING;
                    break;
                }
            }
            if (targetR >= 0) break;
        }

        expect(targetR).toBeGreaterThan(0);
        expect(targetC).toBeGreaterThan(0);

        game.cells[targetR - 1][targetC].type = CellType.Water;
        game.cells[targetR - 2][targetC].type = CellType.Water;

        expect(game.cells[targetR][targetC].broken).toBe(false);

        for (let t = 0; t < 10; t++) {
            game.cells[targetR - 1][targetC].type = CellType.Water;
            game.tick();
            if (game.cells[targetR][targetC].broken) break;
        }

        expect(game.cells[targetR][targetC].broken).toBe(true);
        expect(game.cells[targetR][targetC].type).toBe(CellType.Empty);

        const frame = game.frame();
        const qrR = targetR - FLOOD_FRAME_PADDING;
        const qrC = targetC - FLOOD_FRAME_PADDING;
        expect(frame.dark[qrR][qrC]).toBe(false);

        for (let t = 0; t < 35; t++) {
            game.tick();
        }

        expect(game.cells[targetR][targetC].broken).toBe(false);
        expect(game.cells[targetR][targetC].type).toBe(CellType.Solid);
    });

    it('water does not seep into the locator', () => {
        const matrix = encodeQr(TEXT, 'H', 4);
        const game = new FloodGame(matrix, 42);

        for (let t = 0; t < 100; t++) {
            game.tick();
            for (let r = FLOOD_FRAME_PADDING + 1; r <= FLOOD_FRAME_PADDING + 5; r++) {
                for (let c = FLOOD_FRAME_PADDING + 1; c <= FLOOD_FRAME_PADDING + 5; c++) {
                    if (game.cells[r][c].isReserved && !game.cells[r][c].originalDark) {
                        expect(game.cells[r][c].type).toBe(CellType.Empty);
                    }
                }
            }
        }
    });

    it('black parts of timing lines never change or break', () => {
        const matrix = encodeQr(TEXT, 'H', 4);
        const game = new FloodGame(matrix, 42);

        for (let t = 0; t < 100; t++) {
            game.tick();
            const frame = game.frame();
            for (let i = 0; i < game.size; i++) {
                if (game.layout.reserved[6][i] && matrix[6][i]) {
                    expect(frame.dark[6][i]).toBe(true);
                    expect(game.cells[6 + FLOOD_FRAME_PADDING][i + FLOOD_FRAME_PADDING].type).toBe(CellType.Solid);
                }
                if (game.layout.reserved[i][6] && matrix[i][6]) {
                    expect(frame.dark[i][6]).toBe(true);
                    expect(game.cells[i + FLOOD_FRAME_PADDING][6 + FLOOD_FRAME_PADDING].type).toBe(CellType.Solid);
                }
            }
        }
    });
});

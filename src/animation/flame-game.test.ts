import { readBarcodes } from 'zxing-wasm/reader';
import { beforeAll, expect, it } from 'vitest';
import { encodeQr, type EcLevel } from '@/qr/encode';
import { fitsBudget } from '@/qr/layout';
import { loadZxing, render } from '@/qr/test-utils';
import { FlameGame, FlameStage } from './flame-game';

const TEXT = 'https://github.com/firelion9/dynamic-qr';

beforeAll(loadZxing);

it.each(['L', 'M', 'Q', 'H'] as EcLevel[])('every frame fits the error correction budget at %s', async level => {
    const matrix = encodeQr(TEXT, level);
    const game = new FlameGame(matrix, 0.42);

    let burnedCount = 0;
    for (let tick = 0; tick < 600; tick++) {
        game.tick();
        const { dark, cells } = game.frame();

        const hasBurning = cells.some(row => row.some(c => c.stage === FlameStage.Firing || c.stage === FlameStage.Charcoal));
        if (hasBurning) burnedCount++;

        const changed = dark.map((line, r) => line.map((d, c) => d !== matrix[r][c]));
        expect(fitsBudget(game.layout, changed)).toBe(true);

        if (tick % 50 === 0) {
            const [result] = await readBarcodes(render(dark), { formats: ['QRCode'] });
            expect(result?.text).toBe(TEXT);
        }
    }
    expect(burnedCount).toBeGreaterThan(100);
});

it('white pixels catch fire, turn to charcoal, and extinguish back to alive', () => {
    const matrix = encodeQr(TEXT, 'H');
    const game = new FlameGame(matrix, 0.123);

    let sawFiring = false;
    let sawCharcoal = false;
    let sawExtinguish = false;

    for (let tick = 0; tick < 400; tick++) {
        game.tick();
        for (const row of game.cells) {
            for (const c of row) {
                if (c.stage === FlameStage.Firing) sawFiring = true;
                if (c.stage === FlameStage.Charcoal) sawCharcoal = true;
                if (sawCharcoal && c.stage === FlameStage.Alive && c.isFuel) sawExtinguish = true;
            }
        }
    }

    expect(sawFiring).toBe(true);
    expect(sawCharcoal).toBe(true);
    expect(sawExtinguish).toBe(true);
});

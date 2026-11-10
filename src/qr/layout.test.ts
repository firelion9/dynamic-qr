import { beforeAll, describe, expect, it } from 'vitest';
import { decodeQr } from './decode';
import { encodeQr, type EcLevel, type QrMatrix } from './encode';
import { freeModules, qrLayout, type QrLayout } from './layout';
import { loadZxing, render } from './test-utils';

beforeAll(loadZxing);

const TEXT = 'https://github.com/firelion9/dynamic-qr';
const LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

function codewordsOfBlock(layout: QrLayout, block: number, count: number): number[] {
    const all = layout.codewordBlock.flatMap((b, i) => (b === block ? [i] : []));
    return Array.from({ length: count }, (_, k) => all[Math.floor((k * all.length) / count)]);
}

function damage(matrix: QrMatrix, layout: QrLayout, codewords: number[], modulesPerCodeword = 8): QrMatrix {
    const left = new Map(codewords.map(i => [i, modulesPerCodeword]));
    return matrix.map((line, row) =>
        line.map((dark, col) => {
            const i = layout.codeword[row][col];
            if (!left.get(i)) return dark;
            left.set(i, left.get(i)! - 1);
            return !dark;
        }),
    );
}

async function decodes(matrix: QrMatrix): Promise<boolean> {
    return (await decodeQr(render(matrix)))?.text === TEXT;
}

describe('qrLayout', () => {
    it.each(LEVELS)('reads version and level %s from matrix', (level) => {
        const layout = qrLayout(encodeQr(TEXT, level, 7));
        expect(layout.version).toBe(7);
        expect(layout.ecLevel).toBe(level);
    });

    it('splits 5-H into blocks from the spec', () => {
        const { blocks } = qrLayout(encodeQr(TEXT, 'H'));
        expect(blocks.map(b => b.dataCodewords)).toEqual([11, 11, 12, 12]);
        expect(blocks.every(b => b.ecCodewords === 22 && b.capacity === 11)).toBe(true);
    });

    it('places exactly 8 modules into each codeword', () => {
        const layout = qrLayout(encodeQr(TEXT, 'Q', 7));
        const sizes = new Map<number, number>();
        layout.codeword.flat().forEach(i => i >= 0 && sizes.set(i, (sizes.get(i) ?? 0) + 1));
        const total = layout.blocks.reduce((s, b) => s + b.dataCodewords + b.ecCodewords, 0);
        expect(sizes.size).toBe(total);
        expect(layout.codewordBlock.length).toBe(total);
        expect([...sizes.values()].every(n => n === 8)).toBe(true);
    });
});

describe('error budget', () => {
    it.each(LEVELS)('%s survives capacity broken codewords in every block', async (level) => {
        const matrix = encodeQr(TEXT, level);
        const layout = qrLayout(matrix);
        const broken = layout.blocks.flatMap((b, i) => codewordsOfBlock(layout, i, b.capacity));
        expect(await decodes(damage(matrix, layout, broken))).toBe(true);
    });

    it.each(LEVELS)('%s fails with one more broken codeword', async (level) => {
        const matrix = encodeQr(TEXT, level);
        const layout = qrLayout(matrix);
        const broken = codewordsOfBlock(layout, 0, layout.blocks[0].capacity + 1);
        expect(await decodes(damage(matrix, layout, broken))).toBe(false);
    });

    it('counts a single flipped module as a whole codeword', async () => {
        const matrix = encodeQr(TEXT, 'H');
        const layout = qrLayout(matrix);
        const broken = codewordsOfBlock(layout, 0, layout.blocks[0].capacity + 1);
        expect(await decodes(damage(matrix, layout, broken, 1))).toBe(false);
    });
});

describe('freeModules', () => {
    it.each(LEVELS)('%s stays readable with all free modules inverted', async (level) => {
        const matrix = encodeQr(TEXT, level, 5);
        const free = freeModules(qrLayout(matrix));
        const inverted = matrix.map((line, row) => line.map((dark, col) => dark !== free[row][col]));
        expect(free.flat().some(Boolean)).toBe(true);
        expect(await decodes(inverted)).toBe(true);
    });

    it('takes at most share of capacity from each block', () => {
        const layout = qrLayout(encodeQr(TEXT, 'H'));
        const free = freeModules(layout, 0.5);
        const perBlock = layout.blocks.map(() => new Set<number>());
        layout.codeword.forEach((line, row) =>
            line.forEach((i, col) => free[row][col] && i >= 0 && perBlock[layout.codewordBlock[i]].add(i)),
        );
        layout.blocks.forEach((b, i) => expect(perBlock[i].size).toBeLessThanOrEqual(Math.floor(b.capacity / 2)));
    });
});

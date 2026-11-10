import QRCode from 'qrcode';
import { getBlocksCount, getTotalCodewordsCount } from 'qrcode/lib/core/error-correction-code.js';
import * as Levels from 'qrcode/lib/core/error-correction-level.js';
import { getEncodedBits } from 'qrcode/lib/core/format-info.js';
import type { EcLevel, QrMatrix } from './encode';

export interface QrBlock {
    dataCodewords: number;
    ecCodewords: number;
    capacity: number;
}

export interface QrLayout {
    version: number;
    ecLevel: EcLevel;
    reserved: boolean[][];
    codeword: number[][];
    codewordBlock: number[];
    blocks: QrBlock[];
}

const EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

export function qrLayout(matrix: QrMatrix): QrLayout {
    const size = matrix.length;
    const version = (size - 17) / 4;
    const ecLevel = readEcLevel(matrix);

    const { reservedBit } = QRCode.create('0', { version, errorCorrectionLevel: 'L' }).modules;
    const reserved = grid(size, (row, col) => reservedBit[row * size + col] === 1);
    const codeword = placementOrder(reserved);
    const total = Math.max(...codeword.flat()) + 1;
    const blocks = splitIntoBlocks(version, ecLevel, total);

    return { version, ecLevel, reserved, codeword, codewordBlock: interleave(blocks), blocks };
}

export function freeModules(layout: QrLayout, share = 0.5): boolean[][] {
    const limit = layout.blocks.map(b => Math.floor(b.capacity * share));
    const used = layout.blocks.map(() => 0);
    let end = 0;
    for (const block of layout.codewordBlock) {
        if (used[block] === limit[block]) break;
        used[block]++;
        end++;
    }
    const { reserved, codeword } = layout;
    return grid(reserved.length, (row, col) => !reserved[row][col] && codeword[row][col] < end);
}

function readEcLevel(matrix: QrMatrix): EcLevel {
    const size = matrix.length;
    let bits = 0;
    for (let i = 0; i < 15; i++) {
        const row = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
        if (matrix[row][8]) bits |= 1 << i;
    }

    let best: EcLevel = 'H';
    let bestDistance = Infinity;
    for (const level of EC_LEVELS) {
        for (let mask = 0; mask < 8; mask++) {
            const distance = popCount(bits ^ getEncodedBits(Levels[level], mask));
            if (distance < bestDistance) [best, bestDistance] = [level, distance];
        }
    }
    return best;
}

function placementOrder(reserved: boolean[][]): number[][] {
    const size = reserved.length;
    const codeword = grid(size, () => -1);
    let bit = 0;
    let row = size - 1;
    let step = -1;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (; row >= 0 && row < size; row += step) {
            for (const c of [col, col - 1]) {
                if (!reserved[row][c]) codeword[row][c] = Math.floor(bit++ / 8);
            }
        }
        step = -step;
        row += step;
    }
    const total = Math.floor(bit / 8);
    return codeword.map(line => line.map(i => (i < total ? i : -1)));
}

function splitIntoBlocks(version: number, ecLevel: EcLevel, total: number): QrBlock[] {
    const count = getBlocksCount(version, Levels[ecLevel]);
    const ecCodewords = getTotalCodewordsCount(version, Levels[ecLevel]) / count;
    const shortData = Math.floor(total / count) - ecCodewords;
    const longBlocks = total % count;
    const capacity = Math.floor((ecCodewords - misdecodeProtection(version, ecLevel)) / 2);

    return Array.from({ length: count }, (_, i) => ({
        dataCodewords: shortData + (i >= count - longBlocks ? 1 : 0),
        ecCodewords,
        capacity,
    }));
}

function interleave(blocks: QrBlock[]): number[] {
    const order: number[] = [];
    const maxData = Math.max(...blocks.map(b => b.dataCodewords));
    for (let i = 0; i < maxData; i++) {
        blocks.forEach((b, block) => i < b.dataCodewords && order.push(block));
    }
    for (let i = 0; i < blocks[0].ecCodewords; i++) {
        blocks.forEach((_, block) => order.push(block));
    }
    return order;
}

function misdecodeProtection(version: number, ecLevel: EcLevel): number {
    if (version === 1) return { L: 3, M: 2, Q: 1, H: 1 }[ecLevel];
    if (version === 2 && ecLevel === 'L') return 2;
    if (version === 3 && ecLevel === 'L') return 1;
    return 0;
}

function grid<T>(size: number, value: (row: number, col: number) => T): T[][] {
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => value(row, col)));
}

function popCount(x: number): number {
    let count = 0;
    for (; x; x &= x - 1) count++;
    return count;
}

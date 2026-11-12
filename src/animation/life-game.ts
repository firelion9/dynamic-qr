import type { QrMatrix } from '@/qr/encode';
import { qrLayout, type QrLayout } from '@/qr/layout';
import { random } from './random';

export const LIFE_FRAME_PADDING = 4;

export interface LifeCell {
    isLive: boolean;
    originalDark: boolean;
    isReserved: boolean;
    cw: number;
    age: number;
    justBorn: boolean;
    justDied: boolean;
}

export interface LifeOptions {
    share?: number;
    reseedInterval?: number;
}

export interface LifeFrame {
    dark: boolean[][];
    cells: LifeCell[][];
    generation: number;
    aliveCount: number;
    mutatedCount: number;
}

export class LifeGame {
    readonly layout: QrLayout;
    readonly size: number;
    readonly gridSize: number;
    readonly cells: LifeCell[][];
    readonly options: Required<LifeOptions>;

    generation = 0;
    private readonly rand: () => number;
    private readonly limit: number[];
    private readonly used: number[];
    private readonly activeCodewords = new Set<number>();
    private readonly codewordRefCounts = new Map<number, number>();
    private stagnantTicks = 0;

    constructor(private readonly matrix: QrMatrix, seed: number, options?: LifeOptions) {
        this.layout = qrLayout(matrix);
        this.size = matrix.length;
        this.gridSize = this.size + 2 * LIFE_FRAME_PADDING;
        this.rand = random(seed);

        this.options = {
            share: options?.share ?? 0.50,
            reseedInterval: options?.reseedInterval ?? 25,
        };

        this.limit = this.layout.blocks.map(b => Math.floor(b.capacity * this.options.share));
        this.used = this.layout.blocks.map(() => 0);

        this.cells = Array.from({ length: this.size }, (_, r) =>
            Array.from({ length: this.size }, (_, c) => {
                const originalDark = this.matrix[r][c];
                const isReserved = this.layout.reserved[r][c];
                const cw = this.layout.codeword[r][c];

                return {
                    isLive: originalDark,
                    originalDark,
                    isReserved,
                    cw,
                    age: originalDark ? 1 : 0,
                    justBorn: false,
                    justDied: false,
                };
            }),
        );
    }

    tick(): void {
        this.generation++;

        const desired = Array.from({ length: this.size }, () => Array(this.size).fill(false));

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = this.cells[r][c];
                if (cell.isReserved) {
                    desired[r][c] = cell.originalDark;
                    continue;
                }

                let liveNeighbors = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                            if (this.cells[nr][nc].isLive) liveNeighbors++;
                        }
                    }
                }

                if (cell.isLive) {
                    desired[r][c] = liveNeighbors === 2 || liveNeighbors === 3;
                } else {
                    desired[r][c] = liveNeighbors === 3;
                }
            }
        }

        const returning: [number, number][] = [];
        const mutating: [number, number][] = [];
        let changedCount = 0;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = this.cells[r][c];
                if (cell.isReserved) continue;

                const want = desired[r][c];
                if (want === cell.isLive) {
                    cell.justBorn = false;
                    cell.justDied = false;
                    if (cell.isLive) cell.age = Math.min(15, cell.age + 1);
                    else cell.age = 0;
                    continue;
                }

                if (want === cell.originalDark) {
                    returning.push([r, c]);
                } else {
                    mutating.push([r, c]);
                }
            }
        }

        for (const [r, c] of returning) {
            const cell = this.cells[r][c];
            cell.isLive = cell.originalDark;
            cell.justBorn = cell.originalDark;
            cell.justDied = !cell.originalDark;
            cell.age = cell.originalDark ? 1 : 0;
            changedCount++;

            const cw = cell.cw;
            if (cw >= 0) {
                const block = this.layout.codewordBlock[cw];
                const ref = (this.codewordRefCounts.get(cw) ?? 1) - 1;
                if (ref <= 0) {
                    this.codewordRefCounts.delete(cw);
                    this.activeCodewords.delete(cw);
                    this.used[block]--;
                } else {
                    this.codewordRefCounts.set(cw, ref);
                }
            }
        }

        for (let i = mutating.length - 1; i > 0; i--) {
            const j = Math.floor(this.rand() * (i + 1));
            const tmp = mutating[i];
            mutating[i] = mutating[j];
            mutating[j] = tmp;
        }

        for (const [r, c] of mutating) {
            const cell = this.cells[r][c];
            const want = desired[r][c];
            const cw = cell.cw;

            if (cw >= 0) {
                const block = this.layout.codewordBlock[cw];
                const isAlreadyActive = this.activeCodewords.has(cw);
                const canMutate = isAlreadyActive || (this.used[block] < this.limit[block]);

                if (canMutate) {
                    cell.isLive = want;
                    cell.justBorn = want;
                    cell.justDied = !want;
                    cell.age = want ? 1 : 0;
                    changedCount++;

                    if (!isAlreadyActive) {
                        this.activeCodewords.add(cw);
                        this.used[block]++;
                    }
                    this.codewordRefCounts.set(cw, (this.codewordRefCounts.get(cw) ?? 0) + 1);
                } else {
                    cell.justBorn = false;
                    cell.justDied = false;
                    if (cell.isLive) cell.age = Math.min(15, cell.age + 1);
                    else cell.age = 0;
                }
            } else {
                cell.isLive = want;
                cell.justBorn = want;
                cell.justDied = !want;
                cell.age = want ? 1 : 0;
                changedCount++;
            }
        }

        if (changedCount <= 2) {
            this.stagnantTicks++;
        } else {
            this.stagnantTicks = 0;
        }

        if (this.stagnantTicks >= 5 || this.generation % this.options.reseedInterval === 0) {
            this.spawnDispersedSparks();
            this.stagnantTicks = 0;
        }
    }

    private spawnDispersedSparks(): void {
        const half = Math.floor(this.size / 2);
        const zones: [number, number, number, number][] = [
            [2, half - 3, 2, half - 3],
            [2, half - 3, half + 1, this.size - 4],
            [half + 1, this.size - 4, 2, half - 3],
            [half + 1, this.size - 4, half + 1, this.size - 4],
            [Math.floor(half * 0.7), Math.floor(half * 1.3), Math.floor(half * 0.7), Math.floor(half * 1.3)],
        ];

        const gliderOffsets = [
            [0, 1],
            [1, 2],
            [2, 0],
            [2, 1],
            [2, 2],
        ];

        for (const [minR, maxR, minC, maxC] of zones) {
            if (minR >= maxR || minC >= maxC) continue;
            for (let attempt = 0; attempt < 4; attempt++) {
                const startR = minR + Math.floor(this.rand() * (maxR - minR));
                const startC = minC + Math.floor(this.rand() * (maxC - minC));

                let valid = true;
                for (const [dr, dc] of gliderOffsets) {
                    const r = startR + dr;
                    const c = startC + dc;
                    if (r >= this.size || c >= this.size || this.cells[r][c].isReserved) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) continue;

                for (const [dr, dc] of gliderOffsets) {
                    const r = startR + dr;
                    const c = startC + dc;
                    const cell = this.cells[r][c];
                    if (!cell.isLive) {
                        const cw = cell.cw;
                        if (cw >= 0) {
                            const block = this.layout.codewordBlock[cw];
                            if (this.activeCodewords.has(cw) || this.used[block] < this.limit[block]) {
                                cell.isLive = true;
                                cell.justBorn = true;
                                cell.age = 1;
                                if (!this.activeCodewords.has(cw)) {
                                    this.activeCodewords.add(cw);
                                    this.used[block]++;
                                }
                                this.codewordRefCounts.set(cw, (this.codewordRefCounts.get(cw) ?? 0) + 1);
                            }
                        } else {
                            cell.isLive = true;
                            cell.justBorn = true;
                            cell.age = 1;
                        }
                    }
                }
                break;
            }
        }
    }

    frame(): LifeFrame {
        let aliveCount = 0;
        let mutatedCount = 0;

        const dark = this.cells.map((row, r) =>
            row.map((cell, c) => {
                if (cell.isLive) aliveCount++;
                if (cell.isLive !== this.matrix[r][c]) mutatedCount++;
                return cell.isLive;
            }),
        );

        return {
            dark,
            cells: this.cells,
            generation: this.generation,
            aliveCount,
            mutatedCount,
        };
    }
}

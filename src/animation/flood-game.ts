import type { QrMatrix } from '@/qr/encode';
import { qrLayout, type QrLayout } from '@/qr/layout';
import { random } from './random';

export const FLOOD_FRAME_PADDING = 4;

export enum CellType {
    Empty = 0,
    Solid = 1,
    Water = 2,
}

export interface FloodCell {
    type: CellType;
    originalDark: boolean;
    isReserved: boolean;
    isBreakable: boolean;
    broken: boolean;
    brokenTicks: number;
    waterPressure: number;
    lastMovedTick: number;
    cw: number;
}

export interface FloodOptions {
    share?: number;
    breakThreshold?: number;
    repairTicks?: number;
    surgeInterval?: number;
    streamCount?: number;
}

export interface FloodFrame {
    dark: boolean[][];
    cells: FloodCell[][];
    waterCount: number;
    brokenCount: number;
}

export class FloodGame {
    readonly layout: QrLayout;
    readonly size: number;
    readonly gridSize: number;
    readonly options: Required<FloodOptions>;
    readonly cells: FloodCell[][];

    private readonly rand: () => number;
    private readonly limit: number[];
    private readonly used: number[];
    private readonly activeCodewords = new Set<number>();
    private readonly codewordRefCounts = new Map<number, number>();

    ticks = 0;
    streamPositions: number[] = [];

    constructor(private readonly matrix: QrMatrix, seed: number, options?: FloodOptions) {
        this.layout = qrLayout(matrix);
        this.size = matrix.length;
        this.gridSize = this.size + 2 * FLOOD_FRAME_PADDING;
        this.rand = random(seed);

        this.options = {
            share: options?.share ?? 0.50,
            breakThreshold: options?.breakThreshold ?? 6,
            repairTicks: options?.repairTicks ?? 60,
            surgeInterval: options?.surgeInterval ?? 100,
            streamCount: options?.streamCount ?? 4,
        };

        this.limit = this.layout.blocks.map(b => Math.floor(b.capacity * this.options.share));
        this.used = this.layout.blocks.map(() => 0);

        this.cells = Array.from({ length: this.gridSize }, (_, r) =>
            Array.from({ length: this.gridSize }, (_, c) => {
                const qrRow = r - FLOOD_FRAME_PADDING;
                const qrCol = c - FLOOD_FRAME_PADDING;
                const inQr = qrRow >= 0 && qrRow < this.size && qrCol >= 0 && qrCol < this.size;

                const originalDark = inQr ? this.matrix[qrRow][qrCol] : false;
                const isReserved = inQr ? this.layout.reserved[qrRow][qrCol] : false;
                const isBreakable = originalDark && !isReserved;
                const cw = inQr ? this.layout.codeword[qrRow][qrCol] : -1;

                return {
                    type: originalDark ? CellType.Solid : CellType.Empty,
                    originalDark,
                    isReserved,
                    isBreakable,
                    broken: false,
                    brokenTicks: 0,
                    waterPressure: 0,
                    lastMovedTick: -1,
                    cw,
                };
            }),
        );

        this.initStreams();
    }

    private initStreams(): void {
        this.streamPositions.length = 0;
        const count = this.options.streamCount;
        const step = (this.gridSize - 4) / Math.max(1, count);
        for (let i = 0; i < count; i++) {
            const col = Math.floor(2 + i * step + this.rand() * (step * 0.8));
            this.streamPositions.push(Math.max(1, Math.min(this.gridSize - 2, col)));
        }
    }

    canBreak(r: number, c: number): boolean {
        if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) return false;
        const cell = this.cells[r][c];
        if (!cell.isBreakable || cell.broken || cell.type !== CellType.Solid) return false;
        const cw = cell.cw;
        if (cw < 0) return true;
        const block = this.layout.codewordBlock[cw];
        if (this.activeCodewords.has(cw)) return true;
        return this.used[block] < this.limit[block];
    }

    breakPixel(r: number, c: number): boolean {
        if (!this.canBreak(r, c)) return false;
        const cell = this.cells[r][c];
        cell.broken = true;
        cell.brokenTicks = 0;
        cell.type = CellType.Empty;

        const cw = cell.cw;
        if (cw >= 0) {
            const block = this.layout.codewordBlock[cw];
            if (!this.activeCodewords.has(cw)) {
                this.activeCodewords.add(cw);
                this.used[block]++;
            }
            this.codewordRefCounts.set(cw, (this.codewordRefCounts.get(cw) ?? 0) + 1);
        }
        return true;
    }

    private repairPixel(r: number, c: number): void {
        const cell = this.cells[r][c];
        cell.broken = false;
        cell.brokenTicks = 0;
        cell.waterPressure = 0;
        cell.type = CellType.Solid;

        const cw = cell.cw;
        if (cw >= 0) {
            const block = this.layout.codewordBlock[cw];
            const count = (this.codewordRefCounts.get(cw) ?? 1) - 1;
            if (count <= 0) {
                this.codewordRefCounts.delete(cw);
                this.activeCodewords.delete(cw);
                this.used[block]--;
            } else {
                this.codewordRefCounts.set(cw, count);
            }
        }
    }

    tick(): void {
        this.ticks++;

        this.emitWater();
        this.simulateLiquids();
        this.updateHydrostaticPressure();
        this.updateRepairs();
    }

    private emitWater(): void {
        const isSurge = (this.ticks % this.options.surgeInterval) < 18;

        if (isSurge) {
            for (let c = 1; c < this.gridSize - 1; c++) {
                if (this.rand() < 0.85 && this.cells[0][c].type === CellType.Empty) {
                    this.cells[0][c].type = CellType.Water;
                    this.cells[0][c].lastMovedTick = this.ticks;
                }
            }
        } else {
            for (let i = 0; i < this.streamPositions.length; i++) {
                if (this.rand() < 0.1) {
                    const delta = this.rand() < 0.5 ? -1 : 1;
                    const nextCol = this.streamPositions[i] + delta;
                    if (nextCol >= 1 && nextCol < this.gridSize - 1) {
                        this.streamPositions[i] = nextCol;
                    }
                }

                const col = this.streamPositions[i];
                if (this.rand() < 0.85 && this.cells[0][col].type === CellType.Empty) {
                    this.cells[0][col].type = CellType.Water;
                    this.cells[0][col].lastMovedTick = this.ticks;
                }
            }
        }
    }

    private simulateLiquids(): void {
        const leftToRight = this.ticks % 2 === 0;

        for (let r = this.gridSize - 1; r >= 0; r--) {
            const startC = leftToRight ? 0 : this.gridSize - 1;
            const endC = leftToRight ? this.gridSize : -1;
            const stepC = leftToRight ? 1 : -1;

            for (let c = startC; c !== endC; c += stepC) {
                const cell = this.cells[r][c];
                if (cell.type !== CellType.Water) continue;
                if (cell.lastMovedTick === this.ticks) continue;

                if (r === this.gridSize - 1) {
                    cell.type = CellType.Empty;
                    continue;
                }

                if (this.cells[r + 1][c].type === CellType.Empty) {
                    this.moveWater(r, c, r + 1, c);
                    continue;
                }

                const canDownLeft =
                    c > 0 &&
                    this.cells[r + 1][c - 1].type === CellType.Empty &&
                    this.cells[r][c - 1].type !== CellType.Solid;
                const canDownRight =
                    c < this.gridSize - 1 &&
                    this.cells[r + 1][c + 1].type === CellType.Empty &&
                    this.cells[r][c + 1].type !== CellType.Solid;

                if (canDownLeft && canDownRight) {
                    const pickLeft = (r + c + this.ticks) % 2 === 0;
                    this.moveWater(r, c, r + 1, pickLeft ? c - 1 : c + 1);
                    continue;
                } else if (canDownLeft) {
                    this.moveWater(r, c, r + 1, c - 1);
                    continue;
                } else if (canDownRight) {
                    this.moveWater(r, c, r + 1, c + 1);
                    continue;
                }

                const canLeft = c > 0 && this.cells[r][c - 1].type === CellType.Empty;
                const canRight = c < this.gridSize - 1 && this.cells[r][c + 1].type === CellType.Empty;

                if (canLeft && canRight) {
                    const pickLeft = (r + c + this.ticks) % 2 === 0;
                    this.moveWater(r, c, r, pickLeft ? c - 1 : c + 1);
                } else if (canLeft) {
                    this.moveWater(r, c, r, c - 1);
                } else if (canRight) {
                    this.moveWater(r, c, r, c + 1);
                }
            }
        }
    }

    private moveWater(fromR: number, fromC: number, toR: number, toC: number): void {
        this.cells[toR][toC].type = CellType.Water;
        this.cells[toR][toC].lastMovedTick = this.ticks;
        this.cells[fromR][fromC].type = CellType.Empty;
    }

    private updateHydrostaticPressure(): void {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.cells[r][c];
                if (!cell.isBreakable || cell.broken || cell.type !== CellType.Solid) continue;

                let depth = 0;
                for (let kr = r - 1; kr >= 0; kr--) {
                    if (this.cells[kr][c].type === CellType.Water) {
                        depth++;
                    } else {
                        break;
                    }
                }

                if (depth >= 1) {
                    cell.waterPressure += depth;
                } else {
                    cell.waterPressure = Math.max(0, cell.waterPressure - 1);
                }

                if (cell.waterPressure >= this.options.breakThreshold) {
                    this.breakPixel(r, c);
                }
            }
        }
    }

    private updateRepairs(): void {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.cells[r][c];
                if (!cell.broken) continue;

                cell.brokenTicks++;
                if (cell.brokenTicks >= this.options.repairTicks) {
                    this.repairPixel(r, c);
                }
            }
        }
    }

    frame(): FloodFrame {
        let waterCount = 0;
        let brokenCount = 0;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.cells[r][c].type === CellType.Water) waterCount++;
                if (this.cells[r][c].broken) brokenCount++;
            }
        }

        const dark = this.matrix.map((line, qrRow) =>
            line.map((originalDark, qrCol) => {
                if (this.layout.reserved[qrRow][qrCol]) {
                    return originalDark;
                }
                const cell = this.cells[qrRow + FLOOD_FRAME_PADDING][qrCol + FLOOD_FRAME_PADDING];
                if (cell.broken) {
                    return false;
                }
                return originalDark;
            }),
        );

        return { dark, cells: this.cells, waterCount, brokenCount };
    }
}

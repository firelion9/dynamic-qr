import type { QrMatrix } from '@/qr/encode';
import { qrLayout, type QrLayout } from '@/qr/layout';
import { random } from './random';

export const FLAME_FRAME_PADDING = 4;

export enum FlameStage {
    Alive = 0,
    Heating = 1,
    Firing = 2,
    Charcoal = 3,
    Cooling = 4,
}

export interface FlameCellState {
    stage: FlameStage;
    ticks: number;
    isFuel: boolean;
    isReserved: boolean;
    originalDark: boolean;
    cw: number;
}

export interface FlameOptions {
    share?: number;
    spreadProb?: number;
    spreadDiagProb?: number;
    heatTicks?: number;
    fireTicks?: number;
    charcoalTicks?: number;
    coolingTicks?: number;
}

export interface FlameFrame {
    dark: boolean[][];
    cells: FlameCellState[][];
}

const ORTHO_DIRS: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];

const DIAG_DIRS: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
];

export class FlameGame {
    readonly layout: QrLayout;
    readonly size: number;
    readonly gridSize: number;
    readonly options: Required<FlameOptions>;
    readonly cells: FlameCellState[][];

    private readonly rand: () => number;
    private readonly limit: number[];
    private readonly used: number[];
    private readonly activeCodewords = new Set<number>();
    private readonly codewordRefCounts = new Map<number, number>();

    constructor(private readonly matrix: QrMatrix, seed: number, options?: FlameOptions) {
        this.layout = qrLayout(matrix);
        this.size = matrix.length;
        this.gridSize = this.size + 2 * FLAME_FRAME_PADDING;
        this.rand = random(seed);

        this.options = {
            share: options?.share ?? 0.50,
            spreadProb: options?.spreadProb ?? 0.55,
            spreadDiagProb: options?.spreadDiagProb ?? 0.28,
            heatTicks: options?.heatTicks ?? 2,
            fireTicks: options?.fireTicks ?? 4,
            charcoalTicks: options?.charcoalTicks ?? 6,
            coolingTicks: options?.coolingTicks ?? 3,
        };

        this.limit = this.layout.blocks.map(b => Math.floor(b.capacity * this.options.share));
        this.used = this.layout.blocks.map(() => 0);

        this.cells = Array.from({ length: this.gridSize }, (_, r) =>
            Array.from({ length: this.gridSize }, (_, c) => {
                const qrRow = r - FLAME_FRAME_PADDING;
                const qrCol = c - FLAME_FRAME_PADDING;
                const inQr = qrRow >= 0 && qrRow < this.size && qrCol >= 0 && qrCol < this.size;

                const originalDark = inQr ? this.matrix[qrRow][qrCol] : false;
                const isReserved = inQr ? this.layout.reserved[qrRow][qrCol] : true;
                const cw = inQr ? this.layout.codeword[qrRow][qrCol] : -1;
                const isFuel = !originalDark && !isReserved;

                return {
                    stage: FlameStage.Alive,
                    ticks: 0,
                    isFuel,
                    isReserved,
                    originalDark,
                    cw,
                };
            }),
        );

        for (let i = 0; i < 8; i++) {
            this.spawnSpark(true);
        }
    }

    canIgnite(r: number, c: number): boolean {
        if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) return false;
        const cell = this.cells[r][c];
        if (cell.stage !== FlameStage.Alive || !cell.isFuel) return false;
        const cw = cell.cw;
        if (cw < 0) return true;
        const block = this.layout.codewordBlock[cw];
        if (this.activeCodewords.has(cw)) return true;
        return this.used[block] < this.limit[block];
    }

    ignite(r: number, c: number): void {
        const cell = this.cells[r][c];
        cell.stage = FlameStage.Heating;
        cell.ticks = 0;
        const cw = cell.cw;
        if (cw >= 0) {
            const block = this.layout.codewordBlock[cw];
            if (!this.activeCodewords.has(cw)) {
                this.activeCodewords.add(cw);
                this.used[block]++;
            }
            this.codewordRefCounts.set(cw, (this.codewordRefCounts.get(cw) ?? 0) + 1);
        }
    }

    private extinguish(r: number, c: number): void {
        const cell = this.cells[r][c];
        cell.stage = FlameStage.Alive;
        cell.ticks = 0;
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

    getActivePositions(): [number, number][] {
        const res: [number, number][] = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const s = this.cells[r][c].stage;
                if (s === FlameStage.Heating || s === FlameStage.Firing) {
                    res.push([r, c]);
                }
            }
        }
        return res;
    }

    spawnSpark(requireDistance = true): boolean {
        const active = requireDistance ? this.getActivePositions() : [];
        for (let attempt = 0; attempt < 60; attempt++) {
            const r = Math.floor(this.rand() * this.gridSize);
            const c = Math.floor(this.rand() * this.gridSize);
            if (!this.canIgnite(r, c)) continue;

            if (requireDistance && active.length > 0) {
                let tooClose = false;
                for (const [ar, ac] of active) {
                    if (Math.abs(r - ar) <= 4 && Math.abs(c - ac) <= 4) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
            }

            this.ignite(r, c);
            return true;
        }
        if (requireDistance) {
            return this.spawnSpark(false);
        }
        return false;
    }

    tick(): void {
        const toIgnite: [number, number][] = [];

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.cells[r][c].stage === FlameStage.Firing) {
                    for (const [dr, dc] of ORTHO_DIRS) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (this.canIgnite(nr, nc) && this.rand() < this.options.spreadProb) {
                            toIgnite.push([nr, nc]);
                        }
                    }
                    for (const [dr, dc] of DIAG_DIRS) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (this.canIgnite(nr, nc) && this.rand() < this.options.spreadDiagProb) {
                            toIgnite.push([nr, nc]);
                        }
                    }
                }
            }
        }

        for (const [r, c] of toIgnite) {
            if (this.canIgnite(r, c)) {
                this.ignite(r, c);
            }
        }

        let activeFiringCount = 0;
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.cells[r][c];
                if (cell.stage === FlameStage.Alive) continue;

                cell.ticks++;
                if (cell.stage === FlameStage.Heating) {
                    activeFiringCount++;
                    if (cell.ticks >= this.options.heatTicks) {
                        cell.stage = FlameStage.Firing;
                        cell.ticks = 0;
                    }
                } else if (cell.stage === FlameStage.Firing) {
                    activeFiringCount++;
                    if (cell.ticks >= this.options.fireTicks) {
                        cell.stage = FlameStage.Charcoal;
                        cell.ticks = 0;
                    }
                } else if (cell.stage === FlameStage.Charcoal) {
                    if (cell.ticks >= this.options.charcoalTicks) {
                        cell.stage = FlameStage.Cooling;
                        cell.ticks = 0;
                    }
                } else if (cell.stage === FlameStage.Cooling) {
                    if (cell.ticks >= this.options.coolingTicks) {
                        this.extinguish(r, c);
                    }
                }
            }
        }

        if (activeFiringCount < 7 || this.rand() < 0.28) {
            this.spawnSpark(true);
        }
    }

    frame(): FlameFrame {
        const dark = this.matrix.map((line, qrRow) =>
            line.map((originalDark, qrCol) => {
                if (originalDark) return true;
                const cell = this.cells[qrRow + FLAME_FRAME_PADDING][qrCol + FLAME_FRAME_PADDING];
                return cell.stage === FlameStage.Charcoal || cell.stage === FlameStage.Firing;
            }),
        );

        return { dark, cells: this.cells };
    }
}

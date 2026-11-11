import type { QrMatrix } from '@/qr/encode';
import { qrLayout, type QrLayout } from '@/qr/layout';
import { random } from './snake-game';

export interface MazeOptions {
    corridorDark: boolean;
    ghosts: number;
    share?: number;
    carve?: number;
}

export type Point = [number, number];

export interface Walker {
    at: Point;
    from: Point;
    dir: number;
    home: Point;
    scared: boolean;
    wait: number;
}

export interface MazeFrame {
    dark: boolean[][];
    lit: boolean[][];
}

const DIRS: Point[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const POWER_TICKS = 60;
export const DEATH_TICKS = 16;
const RESPAWN_TICKS = 30;

export class MazeGame {
    readonly layout: QrLayout;
    readonly carved: boolean[][];
    readonly corridor: boolean[][];
    readonly area: Point[];
    readonly pellets = new Set<number>();
    readonly power = new Set<number>();
    readonly hero: Walker;
    readonly ghosts: Walker[] = [];
    powered = 0;
    ticks = 0;

    private readonly size: number;
    private readonly rand: () => number;
    private readonly walkable: boolean[][];
    private readonly limit: number[];
    private readonly used: number[];
    private readonly opened = new Set<number>();

    constructor(private readonly matrix: QrMatrix, seed: number, private readonly options: MazeOptions) {
        this.layout = qrLayout(matrix);
        this.size = matrix.length;
        this.rand = random(seed);
        this.limit = this.layout.blocks.map(b => Math.floor(b.capacity * (options.share ?? 0.5)));
        this.used = this.layout.blocks.map(() => 0);

        const carveLimit = this.layout.blocks.map(b => Math.floor(b.capacity * (options.carve ?? 0.4)));
        this.carved = this.grid(() => false);
        this.corridor = this.grid((r, c) => this.isCorridor(r, c));
        this.carve(carveLimit);

        this.area = this.largestComponent();
        this.walkable = this.grid(() => false);
        for (const [r, c] of this.area) this.walkable[r][c] = true;

        this.hero = this.walker(this.pick(this.area));
        for (let i = 0; i < options.ghosts; i++) {
            const home = this.farthest(this.area, [this.hero.at, ...this.ghosts.map(g => g.at)]);
            this.ghosts.push(this.walker(home));
        }
        this.refill();
    }

    tick(): void {
        this.ticks++;
        this.moveHero();
        this.ghosts.forEach((g, i) => this.moveGhost(g, i));
        this.collide();
        if (this.powered > 0 && --this.powered === 0) this.ghosts.forEach(g => (g.scared = false));
        if (!this.pellets.size && !this.power.size) this.refill();
    }

    frame(): MazeFrame {
        const { matrix, layout } = this;
        const used = [...this.used];
        const opened = new Set(this.opened);
        const dark = matrix.map((line, r) => line.map((d, c) => d !== this.carved[r][c]));
        const lit = this.grid(() => false);

        const cells = [this.hero.at, ...[...this.power].map(key => this.point(key))];
        for (const [r, c] of cells) {
            if (layout.reserved[r][c] || lit[r][c]) continue;
            const cw = layout.codeword[r][c];
            if (cw >= 0 && !opened.has(cw)) {
                const block = layout.codewordBlock[cw];
                if (used[block] === this.limit[block]) continue;
                used[block]++;
                opened.add(cw);
            }
            lit[r][c] = true;
            dark[r][c] = !dark[r][c];
        }
        return { dark, lit };
    }

    key([r, c]: Point): number {
        return r * this.size + c;
    }

    point(key: number): Point {
        return [Math.floor(key / this.size), key % this.size];
    }

    private moveHero(): void {
        const hero = this.hero;
        hero.from = hero.at;
        if (hero.wait > 0) {
            if (--hero.wait === 0) hero.at = hero.from = this.farthest(this.area, this.ghosts.map(g => g.at));
            return;
        }

        const hunters = this.ghosts.filter(g => !g.scared && g.wait === 0);
        const danger = new Set<number>();
        for (const g of hunters) {
            danger.add(this.key(g.at));
            for (let d = 0; d < 4; d++) danger.add(this.key(this.step(g.at, d)));
        }
        const prey = new Set(this.ghosts.filter(g => g.scared && g.wait === 0).map(g => this.key(g.at)));
        const threatened = hunters.some(g => this.distance(g.at, hero.at) < 6);

        const goals = [
            this.powered > 10 ? prey : null,
            threatened ? this.power : null,
            new Set([...this.pellets, ...this.power]),
        ];
        let dir: number | null = null;
        for (const goal of goals) {
            if (goal?.size && (dir = this.firstStep(hero.at, goal, danger)) !== null) break;
        }
        dir ??= this.best(hero, p => Math.min(99, ...hunters.map(g => this.distance(g.at, p))), true);
        if (dir === null) return;

        hero.dir = dir;
        hero.at = this.step(hero.at, dir);
        const key = this.key(hero.at);
        this.pellets.delete(key);
        if (this.power.delete(key)) {
            this.powered = POWER_TICKS;
            this.ghosts.forEach(g => (g.scared = true));
        }
    }

    private moveGhost(ghost: Walker, id: number): void {
        ghost.from = ghost.at;
        if (ghost.wait > 0) {
            if (--ghost.wait === 0) ghost.at = ghost.from = ghost.home;
            return;
        }
        if (ghost.scared && this.ticks % 2 === 0) return;

        const hero = this.hero.at;
        let dir: number | null;
        if (ghost.scared) {
            dir = this.best(ghost, p => this.distance(p, hero), false);
        } else if (this.hero.wait === 0 && this.rand() < 0.75 - 0.15 * id) {
            const toHero = this.firstStep(ghost.at, new Set([this.key(hero)]), new Set());
            dir = toHero !== null && toHero !== (ghost.dir ^ 1) ? toHero : this.best(ghost, p => -this.distance(p, hero), false);
        } else {
            dir = this.best(ghost, () => 0, false);
        }
        if (dir === null) return;
        ghost.dir = dir;
        ghost.at = this.step(ghost.at, dir);
    }

    private collide(): void {
        const hero = this.hero;
        if (hero.wait > 0) return;
        const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
        for (const g of this.ghosts) {
            if (g.wait > 0) continue;
            if (!same(g.at, hero.at) && !(same(g.at, hero.from) && same(g.from, hero.at))) continue;
            if (g.scared) {
                g.scared = false;
                g.wait = RESPAWN_TICKS;
            } else {
                hero.wait = DEATH_TICKS;
                this.powered = 0;
                this.ghosts.forEach(o => (o.scared = false));
                return;
            }
        }
    }

    private best(w: Walker, score: (p: Point) => number, canTurnBack: boolean): number | null {
        const options = [0, 1, 2, 3].filter(d => this.canWalk(this.step(w.at, d)));
        const forward = options.filter(d => d !== (w.dir ^ 1));
        const pool = canTurnBack || !forward.length ? options : forward;
        if (!pool.length) return null;
        const value = (d: number) => score(this.step(w.at, d)) + this.rand() * 0.5;
        return pool.reduce((a, b) => (value(b) > value(a) ? b : a));
    }

    private firstStep(start: Point, goals: Set<number>, blocked: Set<number>): number | null {
        const first = new Map([[this.key(start), -1]]);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
            for (let d = 0; d < 4; d++) {
                const next = this.step(queue[i], d);
                const key = this.key(next);
                if (!this.canWalk(next) || blocked.has(key) || first.has(key)) continue;
                const step = first.get(this.key(queue[i]))!;
                first.set(key, step < 0 ? d : step);
                if (goals.has(key)) return first.get(key)!;
                queue.push(next);
            }
        }
        return null;
    }

    private carve(limit: number[]): void {
        const { layout } = this;
        for (;;) {
            const { label, sizes } = this.components();
            let best: Point | null = null;
            let bestScore = 0;
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    if (this.corridor[r][c] || layout.reserved[r][c]) continue;
                    const cw = layout.codeword[r][c];
                    const free = cw < 0 || this.opened.has(cw);
                    if (!free && this.used[layout.codewordBlock[cw]] >= limit[layout.codewordBlock[cw]]) continue;
                    const ids = new Set<number>();
                    for (let d = 0; d < 4; d++) {
                        const [nr, nc] = this.step([r, c], d);
                        if (this.inside([nr, nc]) && label[nr][nc] >= 0) ids.add(label[nr][nc]);
                    }
                    if (ids.size < 2) continue;
                    const merged = [...ids].map(i => sizes[i]).sort((a, b) => b - a);
                    const score = (merged.slice(1).reduce((a, b) => a + b) + 1) * (free ? 3 : 1);
                    if (score > bestScore) [best, bestScore] = [[r, c], score];
                }
            }
            if (!best) return;

            const [r, c] = best;
            const cw = layout.codeword[r][c];
            if (cw >= 0 && !this.opened.has(cw)) {
                this.opened.add(cw);
                this.used[layout.codewordBlock[cw]]++;
            }
            this.carved[r][c] = true;
            this.corridor[r][c] = true;
        }
    }

    private components(): { label: number[][]; sizes: number[] } {
        const label = this.grid(() => -1);
        const sizes: number[] = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (!this.corridor[r][c] || label[r][c] >= 0) continue;
                const id = sizes.length;
                const stack: Point[] = [[r, c]];
                label[r][c] = id;
                let size = 0;
                while (stack.length) {
                    const p = stack.pop()!;
                    size++;
                    for (let d = 0; d < 4; d++) {
                        const [nr, nc] = this.step(p, d);
                        if (!this.inside([nr, nc]) || !this.corridor[nr][nc] || label[nr][nc] >= 0) continue;
                        label[nr][nc] = id;
                        stack.push([nr, nc]);
                    }
                }
                sizes.push(size);
            }
        }
        return { label, sizes };
    }

    private largestComponent(): Point[] {
        const { label, sizes } = this.components();
        const main = sizes.indexOf(Math.max(...sizes));
        const cells: Point[] = [];
        label.forEach((line, r) => line.forEach((id, c) => id === main && cells.push([r, c])));
        return cells;
    }

    private refill(): void {
        const reserved = this.layout.reserved;
        for (const p of this.area) if (!reserved[p[0]][p[1]]) this.pellets.add(this.key(p));
        const corners: Point[] = [[0, 0], [0, this.size], [this.size, 0], [this.size, this.size]];
        for (const corner of corners) {
            const p = this.area.reduce((a, b) => (this.distance(b, corner) < this.distance(a, corner) ? b : a));
            this.pellets.delete(this.key(p));
            this.power.add(this.key(p));
        }
        this.pellets.delete(this.key(this.hero.at));
    }

    private walker(at: Point): Walker {
        return { at, from: at, dir: 0, home: at, scared: false, wait: 0 };
    }

    private farthest(cells: Point[], from: Point[]): Point {
        const score = (p: Point) => Math.min(...from.map(q => this.distance(p, q))) + this.rand();
        return cells.reduce((a, b) => (score(b) > score(a) ? b : a));
    }

    private pick(cells: Point[]): Point {
        return cells[Math.floor(this.rand() * cells.length)];
    }

    private isCorridor(r: number, c: number): boolean {
        return (this.matrix[r][c] !== this.carved[r][c]) === this.options.corridorDark;
    }

    private canWalk(p: Point): boolean {
        return this.inside(p) && this.walkable[p[0]][p[1]];
    }

    private inside([r, c]: Point): boolean {
        return r >= 0 && c >= 0 && r < this.size && c < this.size;
    }

    private step([r, c]: Point, d: number): Point {
        return [r + DIRS[d][0], c + DIRS[d][1]];
    }

    private distance(a: Point, b: Point): number {
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }

    private grid<T>(value: (r: number, c: number) => T): T[][] {
        return Array.from({ length: this.size }, (_, r) => Array.from({ length: this.size }, (_, c) => value(r, c)));
    }
}

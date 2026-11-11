import type { QrMatrix } from '@/qr/encode';
import { qrLayout, type QrLayout } from '@/qr/layout';
import { random } from './random';

export enum Sprite {
    None,
    Body,
    BodyLight,
    Head,
    HeadLight,
    Apple,
}

export interface SnakeOptions {
    snakes: number;
    length: number;
    share?: number;
}

export interface Cell {
    sprite: Sprite;
    index: number;
    dir: number;
    snake: number;
}

export interface SnakeFrame {
    dark: boolean[][];
    cells: Cell[][];
}

type Point = [number, number];

interface Snake {
    body: Point[];
    grow: number;
    dir: number;
}

const DIRS: Point[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAX_LENGTH = 40;
const MAX_APPLES = 2;

export class SnakeGame {
    readonly layout: QrLayout;
    readonly snakes: Snake[] = [];
    readonly apples: Point[] = [];
    private readonly size: number;
    private readonly rand: () => number;

    constructor(private readonly matrix: QrMatrix, seed: number, private readonly options: SnakeOptions) {
        this.layout = qrLayout(matrix);
        this.size = matrix.length;
        this.rand = random(seed);
        for (let i = 0; i < options.snakes; i++) this.snakes.push(this.spawn());
    }

    tick(): void {
        for (const snake of this.snakes) this.move(snake);
        if (this.apples.length < MAX_APPLES && (this.apples.length === 0 || this.rand() < 0.06)) this.spawnApple();
    }

    frame(): SnakeFrame {
        const { matrix, layout } = this;
        const limit = layout.blocks.map(b => Math.floor(b.capacity * (this.options.share ?? 0.5)));
        const used = layout.blocks.map(() => 0);
        const flipped = new Set<number>();
        const dark = matrix.map(line => [...line]);
        const cells = matrix.map(line => line.map((): Cell => ({ sprite: Sprite.None, index: 0, dir: 0, snake: 0 })));

        const canDarken = (row: number, col: number): boolean => {
            const cw = layout.codeword[row][col];
            if (cw < 0 || flipped.has(cw)) return true;
            const block = layout.codewordBlock[cw];
            if (used[block] === limit[block]) return false;
            used[block]++;
            flipped.add(cw);
            return true;
        };

        for (const [row, col] of this.apples) cells[row][col].sprite = Sprite.Apple;
        const longest = Math.max(...this.snakes.map(s => s.body.length));
        for (let index = 0; index < longest; index++) {
            this.snakes.forEach((snake, id) => {
                if (index >= snake.body.length) return;
                const [row, col] = snake.body[index];
                if (layout.reserved[row][col] || cells[row][col].sprite !== Sprite.None) return;
                const solid = matrix[row][col] || canDarken(row, col);
                const head = index === 0;
                dark[row][col] = solid;
                cells[row][col] = {
                    sprite: head ? (solid ? Sprite.Head : Sprite.HeadLight) : solid ? Sprite.Body : Sprite.BodyLight,
                    index,
                    dir: snake.dir,
                    snake: id,
                };
            });
        }
        return { dark, cells };
    }

    private move(snake: Snake): void {
        const taken = this.occupied();
        const head = snake.body[0];
        const options = [0, 1, 2, 3].filter(d => this.isFree(this.step(head, d), taken));
        if (!options.length) {
            Object.assign(snake, this.spawn());
            return;
        }

        const roomy = (d: number) => this.room(this.step(head, d), taken) >= snake.body.length + snake.grow;
        const score = (d: number) =>
            this.room(this.step(head, d), taken) * 4 + (d === snake.dir ? 2 : 0) + (d < 2 ? 1 : 0) + this.rand();
        const toApple = this.pathToApple(head, taken);
        const dir = toApple !== null && roomy(toApple) ? toApple : options.reduce((a, b) => (score(b) > score(a) ? b : a));

        const next = this.step(head, dir);
        snake.dir = dir;
        snake.body.unshift(next);
        if (snake.grow > 0) snake.grow--;
        else snake.body.pop();

        const apple = this.apples.findIndex(([r, c]) => r === next[0] && c === next[1]);
        if (apple >= 0) {
            this.apples.splice(apple, 1);
            snake.grow += Math.max(0, Math.min(3, MAX_LENGTH - snake.body.length));
        }
    }

    private pathToApple(start: Point, taken: Set<number>): number | null {
        const apples = new Set(this.apples.map(p => this.key(p)));
        const firstStep = new Map([[this.key(start), -1]]);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
            const point = queue[i];
            for (let d = 0; d < 4; d++) {
                const next = this.step(point, d);
                const key = this.key(next);
                if (!this.isFree(next, taken) || firstStep.has(key)) continue;
                const first = firstStep.get(this.key(point))!;
                firstStep.set(key, first < 0 ? d : first);
                if (apples.has(key)) return firstStep.get(key)!;
                queue.push(next);
            }
        }
        return null;
    }

    private room(start: Point, taken: Set<number>): number {
        if (!this.isFree(start, taken)) return 0;
        const seen = new Set([this.key(start)]);
        const stack = [start];
        while (stack.length && seen.size < 200) {
            const point = stack.pop()!;
            for (let d = 0; d < 4; d++) {
                const next = this.step(point, d);
                if (this.isFree(next, taken) && !seen.has(this.key(next))) {
                    seen.add(this.key(next));
                    stack.push(next);
                }
            }
        }
        return seen.size;
    }

    private spawn(): Snake {
        const taken = this.occupied();
        let point: Point;
        do point = [this.randomIndex(), this.randomIndex()];
        while (taken.has(this.key(point)));
        return { body: [point], grow: this.options.length - 1, dir: Math.floor(this.rand() * 4) };
    }

    private spawnApple(): void {
        const taken = this.occupied();
        this.apples.forEach(p => taken.add(this.key(p)));
        const snake = this.snakes[Math.floor(this.rand() * this.snakes.length)];
        const [hr, hc] = snake.body[0];
        const [dr, dc] = DIRS[snake.dir];

        const ahead: Point[] = [];
        this.matrix.forEach((line, r) =>
            line.forEach((isDark, c) => {
                if (!isDark || this.layout.reserved[r][c] || taken.has(this.key([r, c]))) return;
                const distance = Math.abs(r - hr) + Math.abs(c - hc);
                if (distance >= 5 && distance <= 14 && (r - hr) * dr + (c - hc) * dc > 0) ahead.push([r, c]);
            }),
        );
        if (ahead.length) this.apples.push(ahead[Math.floor(this.rand() * ahead.length)]);
    }

    private occupied(): Set<number> {
        const taken = new Set<number>();
        for (const { body, grow } of this.snakes) {
            const end = grow > 0 ? body.length : body.length - 1;
            for (let i = 0; i < end; i++) taken.add(this.key(body[i]));
        }
        return taken;
    }

    private isFree([r, c]: Point, taken: Set<number>): boolean {
        return r >= 0 && c >= 0 && r < this.size && c < this.size && !taken.has(this.key([r, c]));
    }

    private step([r, c]: Point, d: number): Point {
        return [r + DIRS[d][0], c + DIRS[d][1]];
    }

    private key([r, c]: Point): number {
        return r * this.size + c;
    }

    private randomIndex(): number {
        return Math.floor(this.rand() * this.size);
    }
}

import { mkdirSync, writeFileSync } from 'node:fs';
import { readBarcodes } from 'zxing-wasm/reader';
import { encodeQr, type QrMatrix } from '../../src/qr/encode.ts';
import { freeModules, qrLayout, type QrLayout } from '../../src/qr/layout.ts';
import { loadZxing, render } from '../../src/qr/test-utils.ts';

const TEXT = 'https://github.com/firelion9/dynamic-qr';
const CELL = 9;
const QUIET = 2;
const BLOCK_COLORS = ['#4c78a8', '#f58518', '#54a24b', '#b279a2', '#e45756', '#72b7b2', '#9d755d', '#eeca3b'];
const RESERVED = '#3b3b3b';

type Paint = (row: number, col: number) => string;

interface Panel {
    title: string;
    caption?: string;
    paint: Paint;
    overlay?: string;
}

const matrix = encodeQr(TEXT, 'H');
const layout = qrLayout(matrix);
const size = matrix.length;
const side = (size + 2 * QUIET) * CELL;
const at = (i: number) => (i + QUIET) * CELL;

function mix(color: string, amount: number): string {
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    return '#' + rgb.map(v => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0')).join('');
}

function blockColor(row: number, col: number, l: QrLayout = layout): string {
    const i = l.codeword[row][col];
    if (l.reserved[row][col]) return RESERVED;
    if (i < 0) return '#ffffff';
    const block = l.codewordBlock[i];
    const isData = i < l.blocks.reduce((s, b) => s + b.dataCodewords, 0);
    return isData ? BLOCK_COLORS[block % BLOCK_COLORS.length] : mix(BLOCK_COLORS[block % BLOCK_COLORS.length], 0.55);
}

function plain(m: QrMatrix): Paint {
    return (row, col) => (m[row][col] ? '#111111' : '#ffffff');
}

function path(cells: [number, number][], color: string): string {
    const points = cells.map(([r, c]) => `${at(c) + CELL / 2},${at(r) + CELL / 2}`).join(' ');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
}

function codewordPath(count = Infinity): [number, number][] {
    const sums = new Map<number, [number, number, number]>();
    layout.codeword.forEach((line, row) =>
        line.forEach((i, col) => {
            if (i < 0 || i >= count) return;
            const [r, c, n] = sums.get(i) ?? [0, 0, 0];
            sums.set(i, [r + row, c + col, n + 1]);
        }),
    );
    return [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([, [r, c, n]]) => [r / n, c / n]);
}

function svg(panels: Panel[], legend: [string, string][] = []): string {
    const gap = 28;
    const top = 30;
    const width = panels.length * side + (panels.length - 1) * gap;
    const legendHeight = legend.length ? 30 : 0;
    const captionHeight = panels.some(p => p.caption) ? 24 : 0;
    const height = top + side + captionHeight + legendHeight;
    const body = panels.map((p, k) => {
        const x = k * (side + gap);
        const cells = matrix.flatMap((line, row) =>
            line.map((_, col) => {
                const fill = p.paint(row, col);
                return fill === '#ffffff' ? '' : `<rect x="${at(col)}" y="${at(row)}" width="${CELL}" height="${CELL}" fill="${fill}"/>`;
            }),
        );
        return `<g transform="translate(${x},0)">
<text x="${side / 2}" y="20" text-anchor="middle" font-size="15" font-weight="600">${p.title}</text>
<g transform="translate(0,${top})"><rect width="${side}" height="${side}" fill="#ffffff" stroke="#d0d0d0"/>${cells.join('')}${p.overlay ?? ''}</g>
${p.caption ? `<text x="${side / 2}" y="${top + side + 18}" text-anchor="middle" font-size="14">${p.caption}</text>` : ''}
</g>`;
    });
    const legendItems = legend.map(([color, label], k) => {
        const x = k * 170;
        return `<rect x="${x}" y="${height - 20}" width="14" height="14" fill="${color}" stroke="#999"/><text x="${x + 20}" y="${height - 8}" font-size="13">${label}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif" fill="#222">
<rect width="100%" height="100%" fill="#ffffff"/>${body.join('')}${legendItems.join('')}</svg>`;
}

function flip(codewords: Map<number, number>): { damaged: QrMatrix; paint: Paint; count: number } {
    const left = new Map(codewords);
    const flipped = new Set<string>();
    const damaged = matrix.map((line, row) =>
        line.map((dark, col) => {
            const i = layout.codeword[row][col];
            if (!left.get(i)) return dark;
            left.set(i, left.get(i)! - 1);
            flipped.add(`${row},${col}`);
            return !dark;
        }),
    );
    const paint: Paint = (row, col) =>
        flipped.has(`${row},${col}`) ? (damaged[row][col] ? '#c0392b' : '#f5b7b1') : plain(damaged)(row, col);
    return { damaged, paint, count: flipped.size };
}

async function readable(m: QrMatrix): Promise<boolean> {
    const [result] = await readBarcodes(render(m), { formats: ['QRCode'] });
    return result?.isValid === true && result.text === TEXT;
}

function blockCodewords(block: number, count: number): number[] {
    const all = layout.codewordBlock.flatMap((b, i) => (b === block ? [i] : []));
    return Array.from({ length: count }, (_, k) => all[Math.floor((k * all.length) / count)]);
}

await loadZxing();
const out = new URL('./img/', import.meta.url);
mkdirSync(out, { recursive: true });

const legend: [string, string][] = [
    [RESERVED, 'служебные'],
    ...layout.blocks.map((_, i): [string, string] => [BLOCK_COLORS[i], `блок ${i + 1}: данные`]),
];
const ecLegend: [string, string][] = [[mix(BLOCK_COLORS[0], 0.55), 'светлее: коррекция']];
writeFileSync(
    new URL('structure.svg', out),
    svg(
        [
            { title: 'QR 5-H', paint: plain(matrix) },
            { title: 'Роли модулей и блоки', paint: blockColor },
            {
                title: 'Порядок раскладки',
                paint: (row, col) => (layout.reserved[row][col] ? RESERVED : mix(blockColor(row, col), 0.6)),
                overlay: path(codewordPath(), '#222222'),
            },
        ],
        [...legend, ...ecLegend],
    ),
);

const t = layout.blocks[0].capacity;
const scattered = flip(new Map(blockCodewords(0, t + 1).map(i => [i, 1])));
const grouped = flip(new Map(layout.blocks.flatMap((b, k) => blockCodewords(k, b.capacity)).map(i => [i, 8])));
const free = freeModules(layout);
const band = matrix.map((line, row) => line.map((dark, col) => dark !== free[row][col]));
const bandCount = free.flat().filter(Boolean).length;
const mark = async (m: QrMatrix) => ((await readable(m)) ? '✓ читается' : '✗ не читается');

writeFileSync(
    new URL('damage.svg', out),
    svg([
        { title: `${scattered.count} модулей вразброс`, caption: `${t + 1} слов блока 1 по 1 модулю — ${await mark(scattered.damaged)}`, paint: scattered.paint },
        { title: `${grouped.count} модулей целыми словами`, caption: `по ${t} слов в каждом блоке — ${await mark(grouped.damaged)}`, paint: grouped.paint },
        {
            title: `${bandCount} модулей в свободной полосе`,
            caption: `полоса инвертирована — ${await mark(band)}`,
            paint: (row, col) => (free[row][col] ? (band[row][col] ? '#c0392b' : '#f5b7b1') : plain(band)(row, col)),
        },
    ]),
);

const bandCodewords = Math.max(...layout.codeword.flat().filter((_, k) => free.flat()[k])) + 1;
const bandCells = codewordPath(bandCodewords);
writeFileSync(
    new URL('band.svg', out),
    svg(
        [
            {
                title: 'Свободная полоса (share = 0.5)',
                paint: (row, col) => (free[row][col] ? (matrix[row][col] ? '#1f7a73' : '#9fdcd5') : plain(matrix)(row, col)),
                overlay: path(bandCells, '#0b3d39'),
            },
            {
                title: 'Полоса как дорожка',
                paint: (row, col) => (free[row][col] ? '#d9f2ef' : layout.reserved[row][col] ? RESERVED : plain(matrix)(row, col)),
                overlay: path(bandCells, '#1f7a73'),
            },
        ],
        [
            ['#1f7a73', 'свободные модули'],
            [RESERVED, 'служебные'],
        ],
    ),
);

const rows = (['L', 'M', 'Q', 'H'] as const).flatMap(level => {
    const version = qrLayout(encodeQr(TEXT, level)).version;
    return [version, version + 1].map(v => {
        const l = qrLayout(encodeQr(TEXT, level, v));
        const dataModules = l.reserved.flat().filter(r => !r).length;
        const grouped = l.blocks.reduce((s, b) => s + b.capacity * 8, 0);
        const scattered = l.blocks.reduce((s, b) => s + b.capacity, 0);
        const bandSize = freeModules(l).flat().filter(Boolean).length;
        return `| ${level} | ${v} (${l.reserved.length}×${l.reserved.length}) | ${l.blocks.length} × ${l.blocks[0].capacity} | ${grouped} (${pct(grouped, dataModules)}) | ${scattered} (${pct(scattered, dataModules)}) | ${bandSize} |`;
    });
});
console.log(rows.join('\n'));

function pct(a: number, b: number): string {
    return `${Math.round((100 * a) / b)}%`;
}

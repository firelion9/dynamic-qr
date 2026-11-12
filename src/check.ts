import { CATALOG, CatalogEntry } from '@/animation/catalog';
import { DEFAULT_PALETTE } from '@/animation/palette';
import type { AnimationOptions } from '@/animation/utils';
import { FrameReader } from '@/export';
import { device } from '@/gpuState';
import { initWebGPU } from '@/main';
import { decodeQr } from '@/qr/decode';
import { encodeQr } from '@/qr/encode';

const TEXT = 'https://qr.fluffyspire.com';
const SIZES = [480, 720, 1080, 1440];
const SEEDS = [0.13, 0.77];
const TIMES = [1, 6, 20, 60];
// Options that change what an animation draws get their own rows.
const VARIANTS: Record<string, Partial<AnimationOptions>[]> = {
    train: [{ trainText: 'ИТМО' }, { trainText: 'DEVDAYS 2026' }, { trainText: 'Привет, ИТМО! 🙂' }, { trainText: 'Dynamic QR — живые коды для презентаций' }],
};

export interface CheckRow {
    key: string;
    passed: number;
    total: number;
    failed: string[];
}

async function checkAnimation(entry: CatalogEntry, inverted: boolean, extra: Partial<AnimationOptions> = {}): Promise<CheckRow> {
    const matrix = encodeQr(TEXT);
    const label = extra.trainText ? ` «${extra.trainText}»` : '';
    const row: CheckRow = { key: entry.key + label + (inverted ? ' inv' : ''), passed: 0, total: 0, failed: [] };
    for (const size of SIZES) {
        const reader = new FrameReader(device, size);
        for (const seed of SEEDS) {
            const state = entry.animation.createState(device, matrix, seed, 'rgba8unorm', { palette: DEFAULT_PALETTE, inverted, ...extra });
            let time = 0;
            for (const t of TIMES) {
                entry.animation.frame(device, reader.view, state, t - time);
                time = t;
                const pixels = await reader.read();
                const qr = await decodeQr(new ImageData(new Uint8ClampedArray(pixels), size, size));
                row.total++;
                if (qr?.text === TEXT) row.passed++;
                else row.failed.push(`${size}px seed ${seed} ${t}s`);
            }
        }
        reader.destroy();
    }
    return row;
}

function show(rows: CheckRow[]): void {
    document.getElementById('table')!.innerHTML =
        '<tr><th>Анимация</th><th>Читается</th><th>Не читается</th></tr>' +
        rows
            .map(r => `<tr class="${r.failed.length ? 'fail' : ''}"><td>${r.key}</td><td>${r.passed}/${r.total}</td><td>${r.failed.join(', ')}</td></tr>`)
            .join('');
}

async function run(): Promise<void> {
    await initWebGPU();
    const status = document.getElementById('status')!;
    if (!device) {
        status.textContent = 'Нет WebGPU';
        (window as any).checkResult = { error: 'no WebGPU' };
        return;
    }
    const rows: CheckRow[] = [];
    for (const entry of CATALOG) {
        for (const extra of VARIANTS[entry.key] ?? [{}]) {
            for (const inverted of [false, true]) {
                status.textContent = `Проверяем ${entry.key}...`;
                rows.push(await checkAnimation(entry, inverted, extra));
                show(rows);
            }
        }
    }
    const failed = rows.filter(r => r.failed.length).length;
    status.textContent = failed ? `Не читаются: ${failed} из ${rows.length}` : 'Все анимации читаются';
    (window as any).checkResult = { rows };
}

run();

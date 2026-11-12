import { encodeQr, QrMatrix } from '@/qr/encode';
import { device } from '@/gpuState';
import { catalogEntry } from '@/animation/catalog';
import { hashSeed } from '@/animation/random';
import { hexToRgb, Palette, PALETTES, readableColors, readableDark, readableLight, rgbToHex } from '@/animation/palette';
import { drawQr, fitCanvas, freshCanvas } from '@/draw';
import { download, ExportFormat, exportAnimation } from '@/export';
import { screenActive, showScreen } from '@/navigation';
import { state } from '@/state';

const TIMELINE_SECONDS = 30;
const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

const player = { runId: 0, time: 0, speed: 1, playing: true };
let palette: Palette = PALETTES[0].palette;
let inverted = false;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

export function setupEditor(): void {
    const entry = catalogEntry(state.selectedStyle);
    byId('backLabel').textContent = entry.title;
    document.querySelectorAll<HTMLElement>('[data-themed]').forEach(el => (el.hidden = !entry.themed));
    byId<HTMLInputElement>('messageInput').value = state.currentData;
    setPlaying(true);
    populateEditor();
}

export function initEditor(): void {
    byId('messageInput').addEventListener('input', () => populateEditor());
    byId('seedInput').addEventListener('input', () => populateEditor());
    byId('btnBack').addEventListener('click', () => showScreen(2));

    byId('speedSlider').addEventListener('input', e => {
        player.speed = parseFloat((e.target as HTMLInputElement).value);
        byId('speedValue').textContent = player.speed.toFixed(1);
    });

    byId('btnRefresh').addEventListener('click', () => {
        byId<HTMLInputElement>('seedInput').value = String(Math.floor(Math.random() * 1e9));
        populateEditor();
    });

    byId('btnPlay').addEventListener('click', () => setPlaying(!player.playing));
    byId('qrSize').addEventListener('change', () => populateEditor());
    initPalette();
    byId('invertToggle').addEventListener('change', e => {
        inverted = (e.target as HTMLInputElement).checked;
        byId('invertHint').hidden = !inverted;
        populateEditor(player.time);
    });
    byId('timelineSlider').addEventListener('input', e => {
        populateEditor((Number((e.target as HTMLInputElement).value) / 100) * TIMELINE_SECONDS);
    });

    initExport();
}

export function editorData(): string {
    return byId<HTMLInputElement>('messageInput').value.trim() || state.currentData;
}

export function editorMatrix(): QrMatrix {
    const text = editorData();
    const version = (encodeQr(text).length - 17) / 4;
    return encodeQr(text, 'H', version + Number(byId<HTMLSelectElement>('qrSize').value));
}

export function editorSeed(): number {
    return hashSeed(byId<HTMLInputElement>('seedInput').value.trim());
}

function initPalette(): void {
    const inputs = {
        dark: byId<HTMLInputElement>('darkColor'),
        light: byId<HTMLInputElement>('lightColor'),
        neon: byId<HTMLInputElement>('neonColor'),
        accent: byId<HTMLInputElement>('accentColor'),
    };
    const hint = byId('colorHint');
    const chips = PALETTES.map(({ name, palette: preset }) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'palette-chip';
        chip.innerHTML = `<i style="background:${rgbToHex(preset.neon)}"></i><i style="background:${rgbToHex(preset.accent)}"></i>${name}`;
        chip.addEventListener('click', () => select(preset));
        byId('paletteRow').appendChild(chip);
        return { chip, preset };
    });

    const select = (next: Palette) => {
        palette = next;
        chips.forEach(({ chip, preset }) => chip.setAttribute('aria-pressed', String(preset === next)));
        if (screenActive(3)) populateEditor(player.time);
    };
    const show = (next: Palette) => {
        (Object.keys(inputs) as (keyof Palette)[]).forEach(key => (inputs[key].value = rgbToHex(next[key])));
    };
    const fromInputs = (): Palette => {
        const read = (key: keyof Palette) => hexToRgb(inputs[key].value);
        return { dark: readableDark(read('dark')), light: readableLight(read('light')), neon: read('neon'), accent: read('accent') };
    };

    for (const input of Object.values(inputs)) {
        input.addEventListener('input', () => select(fromInputs()));
        input.addEventListener('change', () => {
            const next = fromInputs();
            hint.hidden = rgbToHex(next.dark) === inputs.dark.value && rgbToHex(next.light) === inputs.light.value;
            show(next);
            select(next);
        });
    }
    for (const { chip, preset } of chips) {
        chip.addEventListener('click', () => {
            hint.hidden = true;
            show(preset);
        });
    }
    show(palette);
    select(palette);
}

function setPlaying(playing: boolean): void {
    player.playing = playing;
    byId('btnPlay').innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
}

function showTime(seconds: number): void {
    byId<HTMLInputElement>('timelineSlider').value = String((seconds / TIMELINE_SECONDS) * 100);
    const whole = Math.floor(seconds);
    byId('timelineTime').textContent = Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function populateEditor(start = 0): void {
    const canvas = freshCanvas(byId<HTMLCanvasElement>('editorCanvas'));
    fitCanvas(canvas);
    const matrix = editorMatrix();
    const context = device && canvas.getContext('webgpu');
    if (!context) {
        const { dark, light } = readableColors(palette, inverted);
        drawQr(canvas, matrix, rgbToHex(dark), rgbToHex(light));
        return;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const { animation } = catalogEntry(state.selectedStyle);
    context.configure({ device, format, alphaMode: 'opaque' });
    const animationState = animation.createState(device, matrix, editorSeed(), format, { palette, inverted });
    animation.frame(device, context.getCurrentTexture().createView(), animationState, start);
    player.time = start;
    showTime(start);

    const runId = ++player.runId;
    let prev = -1;
    const loop = (now: number) => {
        if (runId !== player.runId || !screenActive(3)) return;
        const delta = prev < 0 || !player.playing ? 0 : ((now - prev) / 1000) * player.speed;
        prev = now;
        if (player.time + delta >= TIMELINE_SECONDS) {
            populateEditor();
            return;
        }
        player.time += delta;
        animation.frame(device, context.getCurrentTexture().createView(), animationState, delta);
        showTime(player.time);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

function initExport(): void {
    const modal = byId('exportModal');
    const actions = byId('modalActions');
    const options = byId('exportOptions');
    const progress = byId('exportProgress');
    const bar = byId('exportProgressBar');
    const text = byId('exportText');
    const estimate = byId('exportEstimate');
    const value = (id: string) => byId<HTMLInputElement | HTMLSelectElement>(id).value;
    let running = false;

    // Measured on the maze: a GIF frame takes about 0.06 bytes per pixel at 20 fps.
    const updateEstimate = () => {
        const seconds = Number(value('exportSeconds'));
        byId('exportSecondsValue').textContent = `${seconds} с`;
        const megabytes = (Number(value('exportSize')) ** 2 * seconds * 20 * 0.06) / 1e6;
        estimate.hidden = value('exportFormat') !== 'gif' || megabytes < 20;
        estimate.textContent = `GIF получится примерно на ${Math.round(megabytes)} МБ. Для длинных роликов лучше MP4.`;
    };
    ['exportFormat', 'exportSize', 'exportSeconds'].forEach(id => byId(id).addEventListener('input', updateEstimate));

    const reset = () => {
        actions.style.display = 'flex';
        options.hidden = false;
        progress.classList.remove('active');
        updateEstimate();
        text.textContent = 'MP4 подходит для презентаций, GIF для мессенджеров. Кадры совпадают с превью для текущего seed.';
    };

    byId('btnExport').addEventListener('click', () => {
        reset();
        if (!device) {
            options.hidden = true;
            byId('btnConfirmExport').hidden = true;
            text.textContent = 'Экспорт работает только в браузере с WebGPU.';
        }
        modal.classList.add('active');
    });
    byId('btnCancelExport').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => {
        if (e.target === e.currentTarget && !running) modal.classList.remove('active');
    });

    byId('btnConfirmExport').addEventListener('click', async () => {
        if (!device || running) return;
        const format = value('exportFormat') as ExportFormat;
        const size = Number(value('exportSize'));
        const seconds = Number(value('exportSeconds'));
        const { animation } = catalogEntry(state.selectedStyle);

        running = true;
        actions.style.display = 'none';
        options.hidden = true;
        estimate.hidden = true;
        progress.classList.add('active');
        bar.style.width = '0%';
        text.textContent = `Рендерим ${size}×${size}, ${seconds} с...`;
        try {
            const blob = await exportAnimation(device, animation, editorMatrix(), editorSeed(), {
                palette,
                inverted,
                format,
                size,
                seconds,
                fps: format === 'gif' ? 20 : 30,
                speed: player.speed,
                onProgress: done => (bar.style.width = Math.round(done * 100) + '%'),
            });
            download(blob, `qr-${state.selectedStyle}-${size}.${format}`);
            text.textContent = `Готово: ${(blob.size / 1e6).toFixed(1)} МБ`;
            setTimeout(() => modal.classList.remove('active'), 1500);
        } catch (err) {
            console.error('Export failed:', err);
            text.textContent = 'Не получилось: ' + (err instanceof Error ? err.message : String(err));
            actions.style.display = 'flex';
        } finally {
            running = false;
        }
    });
}

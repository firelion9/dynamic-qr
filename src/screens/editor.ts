import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { AllAnimationsList } from '@/animation/registry';
import { hashSeed } from '@/animation/random';
import { drawQr, fitCanvas } from '@/draw';
import { download, ExportFormat, exportAnimation } from '@/export';
import { screenActive, showScreen } from '@/navigation';
import { state, styleNumber } from '@/state';

const TIMELINE_SECONDS = 30;
const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

const player = { runId: 0, time: 0, speed: 1, playing: true };

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

export function setupEditor(): void {
    byId('backLabel').textContent = 'Анимация#' + styleNumber();
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
    byId('timelineSlider').addEventListener('input', e => {
        populateEditor((Number((e.target as HTMLInputElement).value) / 100) * TIMELINE_SECONDS);
    });

    initExport();
}

export function editorData(): string {
    return byId<HTMLInputElement>('messageInput').value.trim() || state.currentData;
}

export function editorSeed(): number {
    return hashSeed(byId<HTMLInputElement>('seedInput').value.trim());
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
    const canvas = byId<HTMLCanvasElement>('editorCanvas');
    fitCanvas(canvas);
    const context = canvas.getContext('webgpu');
    const matrix = encodeQr(editorData());
    if (!device || !context) {
        drawQr(canvas, matrix);
        return;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const animation = AllAnimationsList[styleNumber() % AllAnimationsList.length];
    context.configure({ device, format, alphaMode: 'opaque' });
    const animationState = animation.createState(device, matrix, editorSeed(), format);
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
    const select = (id: string) => byId<HTMLSelectElement>(id).value;
    let running = false;

    const reset = () => {
        actions.style.display = 'flex';
        options.hidden = false;
        progress.classList.remove('active');
        text.textContent = 'MP4 подходит для презентаций, GIF для мессенджеров. Кадры совпадают с превью для текущего seed.';
    };

    byId('btnExport').addEventListener('click', () => {
        reset();
        modal.classList.add('active');
    });
    byId('btnCancelExport').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => {
        if (e.target === e.currentTarget && !running) modal.classList.remove('active');
    });

    byId('btnConfirmExport').addEventListener('click', async () => {
        if (!device || running) return;
        const format = select('exportFormat') as ExportFormat;
        const size = format === 'gif' ? Math.min(Number(select('exportSize')), 720) : Number(select('exportSize'));
        const seconds = Number(select('exportSeconds'));
        const animation = AllAnimationsList[styleNumber() % AllAnimationsList.length];

        running = true;
        actions.style.display = 'none';
        options.hidden = true;
        progress.classList.add('active');
        bar.style.width = '0%';
        text.textContent = `Рендерим ${size}×${size}, ${seconds} с...`;
        try {
            const blob = await exportAnimation(device, animation, encodeQr(editorData()), editorSeed(), {
                format,
                size,
                seconds,
                fps: format === 'gif' ? 20 : 30,
                onProgress: done => (bar.style.width = Math.round(done * 100) + '%'),
            });
            download(blob, `animated-qr-${styleNumber()}-${size}.${format}`);
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

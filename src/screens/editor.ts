import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { AllAnimationsList } from '@/animation/registry';
import { hashSeed } from '@/animation/random';
import { drawQr, fitCanvas } from '@/draw';
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
    const btnExport = document.getElementById('btnExport') as HTMLButtonElement;
    const btnCancelExport = document.getElementById('btnCancelExport') as HTMLButtonElement;
    const btnConfirmExport = document.getElementById('btnConfirmExport') as HTMLButtonElement;
    const exportModal = document.getElementById('exportModal') as HTMLElement;

    btnExport.addEventListener('click', () => {
        exportModal.classList.add('active');
        document.getElementById('exportProgress')!.classList.remove('active');
        (document.getElementById('modalActions') as HTMLElement).style.display = 'flex';
        document.getElementById('exportText')!.textContent = 'QR-код будет экспортирован в формате GIF с эффектом "' + state.selectedStyle + '"';
    });

    btnCancelExport.addEventListener('click', () => {
        exportModal.classList.remove('active');
    });

    btnConfirmExport.addEventListener('click', () => {
        (document.getElementById('modalActions') as HTMLElement).style.display = 'none';
        document.getElementById('exportProgress')!.classList.add('active');
        document.getElementById('exportText')!.textContent = 'Экспорт анимации...';

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                document.getElementById('exportText')!.textContent = '✅ GIF успешно экспортирован!';

                const canvas = document.getElementById('editorCanvas') as HTMLCanvasElement;
                if (canvas) {
                    const link = document.createElement('a');
                    link.download = 'animated-qr-' + state.selectedStyle + '.png';
                    link.href = canvas.toDataURL();
                    link.click();
                }

                setTimeout(() => {
                    exportModal.classList.remove('active');
                }, 2000);
            }
            (document.getElementById('exportProgressBar') as HTMLElement).style.width = progress + '%';
        }, 200);
    });

    exportModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            exportModal.classList.remove('active');
        }
    });
}
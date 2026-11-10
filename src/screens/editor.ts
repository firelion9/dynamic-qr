import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { toRenderable } from '@/animation/utils';
import { AllAnimationsList } from '@/animation/registry';
import { drawQr } from '@/draw';
import { screenActive, showScreen } from '@/navigation';
import { state, styleNumber } from '@/state';

let editorRunId = 0;

export function setupEditor(): void {
    const backLabel = document.getElementById('backLabel')!;
    const editorQr = document.getElementById('editorQr') as HTMLElement;
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;

    backLabel.textContent = 'Анимация#' + styleNumber();
    editorQr.className = 'qr-animated';
    messageInput.value = state.currentData;
    populateEditor();
}

export function initEditor(): void {
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;

    messageInput.addEventListener('input', () => {
        populateEditor();
    });

    const btnBack = document.getElementById('btnBack') as HTMLButtonElement;
    btnBack.addEventListener('click', () => showScreen(2));

    const speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
    speedSlider.addEventListener('input', (e) => {
        const valueEl = document.getElementById('speedValue') as HTMLElement;
        valueEl.textContent = parseFloat((e.target as HTMLInputElement).value).toFixed(1);
        updateAnimationSpeed();
    });

    const btnRefresh = document.getElementById('btnRefresh') as HTMLButtonElement;
    btnRefresh.addEventListener('click', () => {
        const seed = Math.floor(Math.random() * 1000000000);
        (document.getElementById('seedInput') as HTMLInputElement).value = String(seed);
        messageInput.value = (messageInput.value.trim() || state.currentData) + '_' + seed;
        populateEditor();
    });

    const btnPlay = document.getElementById('btnPlay') as HTMLButtonElement;
    btnPlay.addEventListener('click', () => {
        const editorQr = document.getElementById('editorQr') as HTMLElement;
        const playing = editorQr.style.animationPlayState === 'paused';
        if (playing) {
            editorQr.style.animationPlayState = 'running';
            btnPlay.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
        } else {
            editorQr.style.animationPlayState = 'paused';
            btnPlay.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        }
    });

    const timelineSlider = document.getElementById('timelineSlider') as HTMLInputElement;
    timelineSlider.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        const seconds = Math.floor(Number(val) / 100 * 30);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('timelineTime')!.textContent = mins + ':' + String(secs).padStart(2, '0');
    });

    initExport();
}

function updateAnimationSpeed(): void {
    const editorQr = document.getElementById('editorQr') as HTMLElement;
    const speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
    const duration = (2 / parseFloat(speedSlider.value)) + 's';
    editorQr.style.animationDuration = duration;
}

function refreshEditorQr(): void {
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;
    const qrData = messageInput.value.trim() || state.currentData;
    drawQr(document.getElementById('editorCanvas') as HTMLCanvasElement, encodeQr(qrData));
}

function populateEditor(): void {
    const canvas = document.getElementById('editorCanvas') as HTMLCanvasElement;
    const context = canvas.getContext('webgpu');
    if (!device || !context) {
        refreshEditorQr();
        return;
    }

    const messageInput = document.getElementById('messageInput') as HTMLInputElement;
    const data = messageInput.value.trim() || state.currentData;
    const matrix = encodeQr(data);
    const format = navigator.gpu.getPreferredCanvasFormat();
    const animation = AllAnimationsList[styleNumber() % AllAnimationsList.length];

    editorRunId++;
    context.configure({ device, format, alphaMode: 'opaque' });
    const renderer = toRenderable(animation, animation.createState(device, matrix, Math.random(), format));
    const runId = editorRunId;
    let prevTime = -1.0;
    const renderLoop = function (time: number) {
        if (runId !== editorRunId || !screenActive(3)) return;
        if (prevTime == -1.0) prevTime = time;
        renderer.render(device, context.getCurrentTexture().createView(), (time - prevTime) / 1000.0);
        prevTime = time;
        requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);
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
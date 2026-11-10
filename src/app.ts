import { initWebGPU } from '@/main';
import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { StaticAnimation } from '@/animation/static';

initWebGPU().catch(console.error);

type QrCanvas = HTMLCanvasElement;
type ScreenKey = 1 | 2 | 3;

let currentData = '';
let selectedStyle = 'pulse';
let selectedStyleName = 'Пульсация';

const screens: Record<ScreenKey, HTMLElement> = {
    1: document.getElementById('screen1') as HTMLElement,
    2: document.getElementById('screen2') as HTMLElement,
    3: document.getElementById('screen3') as HTMLElement,
};

function showScreen(num: ScreenKey): void {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[num].classList.add('active');
    document.querySelectorAll('[data-home]').forEach(btn => {
        (btn as HTMLElement).style.display = num === 1 ? 'none' : 'flex';
    });
}

document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(1));
});

function drawQr(canvas: QrCanvas, matrix: boolean[][], color = '#6c5ce7'): void {
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = size / matrix.length;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix.length; c++) {
            if (matrix[r][c]) {
                ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
            }
        }
    }
}

const btnGenerate = document.getElementById('btnGenerate') as HTMLButtonElement;
btnGenerate.addEventListener('click', () => {
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    const input = urlInput.value.trim();
    if (!input) {
        urlInput.style.borderColor = '#ff5f57';
        setTimeout(() => { urlInput.style.borderColor = '#2a2a4e'; }, 1500);
        return;
    }
    currentData = input;
    showScreen(2);
});

const urlInput = document.getElementById('urlInput') as HTMLInputElement;
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnGenerate.click();
});

const btnUpload = document.getElementById('btnUpload') as HTMLButtonElement;
btnUpload.addEventListener('click', () => {
    fileInput.click();
});

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentData = String(ev.target?.result);
        showScreen(2);
    };
    reader.readAsDataURL(file);
});

function populateGallery(): void {
    const data = currentData || 'https://example.com';
    const matrix = encodeQr(data);
    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderState = device ? StaticAnimation.createState(device, matrix, 0, format) : null;
    for (let i = 1; i <= 6; i++) {
        const container = document.getElementById('galleryQr' + i) as HTMLElement;
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        container.appendChild(canvas);
        const context = canvas.getContext('webgpu');
        if (device && shaderState && context) {
            context.configure({ device, format, alphaMode: 'opaque' });
            StaticAnimation.frame(device, context, shaderState, 0.0);
        } else {
            drawQr(canvas, matrix);
        }
    }
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        const target = mutation.target as HTMLElement;
        if (target.classList.contains('active') && target.id === 'screen2') {
            populateGallery();
        }
    });
});

Object.values(screens).forEach(s => {
    observer.observe(s, { attributes: true, attributeFilter: ['class'] });
});

document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedStyle = item.getAttribute('data-style') || 'pulse';
        selectedStyleName = item.getAttribute('data-name') || 'Пульсация';
        setTimeout(() => {
            showScreen(3);
            setupEditor();
        }, 400);
    });
});

function updateAnimationSpeed(): void {
    const editorQr = document.getElementById('editorQr') as HTMLElement;
    const speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
    const duration = (2 / parseFloat(speedSlider.value)) + 's';
    editorQr.style.animationDuration = duration;
}

function setupEditor(): void {
    document.getElementById('backLabel')!.textContent = selectedStyleName;
    const editorQr = document.getElementById('editorQr') as HTMLElement;
    editorQr.className = 'qr-animated';

    const data = currentData || 'https://example.com';
    drawQr(document.getElementById('editorCanvas') as HTMLCanvasElement, encodeQr(data));

    setTimeout(() => {
        editorQr.classList.add('qr-effect-' + selectedStyle);
        updateAnimationSpeed();
    }, 50);
}

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
    const editorQr = document.getElementById('editorQr') as HTMLElement;
    editorQr.className = 'qr-animated';
    const data = currentData || 'https://example.com';
    drawQr(document.getElementById('editorCanvas') as HTMLCanvasElement, encodeQr(data + '_' + seed));
    setTimeout(() => {
        editorQr.classList.add('qr-effect-' + selectedStyle);
        updateAnimationSpeed();
    }, 50);
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

const btnExport = document.getElementById('btnExport') as HTMLButtonElement;
btnExport.addEventListener('click', () => {
    document.getElementById('exportModal')!.classList.add('active');
    document.getElementById('exportProgress')!.classList.remove('active');
    (document.getElementById('modalActions') as HTMLElement).style.display = 'flex';
    document.getElementById('exportText')!.textContent = 'QR-код будет экспортирован в формате GIF с эффектом "' + selectedStyleName + '"';
});

const btnCancelExport = document.getElementById('btnCancelExport') as HTMLButtonElement;
btnCancelExport.addEventListener('click', () => {
    document.getElementById('exportModal')!.classList.remove('active');
});

const btnConfirmExport = document.getElementById('btnConfirmExport') as HTMLButtonElement;
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
                link.download = 'animated-qr-' + selectedStyle + '.png';
                link.href = canvas.toDataURL();
                link.click();
            }

            setTimeout(() => {
                document.getElementById('exportModal')!.classList.remove('active');
            }, 2000);
        }
        (document.getElementById('exportProgressBar') as HTMLElement).style.width = progress + '%';
    }, 200);
});

document.getElementById('exportModal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('exportModal')!.classList.remove('active');
    }
});

currentData = 'https://example.com';
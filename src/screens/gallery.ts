import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { CATALOG, CatalogEntry } from '@/animation/catalog';
import { drawQr, fitCanvas } from '@/draw';
import { download, exportAnimation } from '@/export';
import { screenActive, showScreen } from '@/navigation';
import { state } from '@/state';
import { setupEditor } from './editor';

let runId = 0;

export function initGallery(): void {
    document.getElementById('btnGalleryBack')!.addEventListener('click', () => showScreen(1));

    const observer = new MutationObserver(() => {
        if (screenActive(2)) populateGallery();
    });
    observer.observe(document.getElementById('screen2')!, { attributes: true, attributeFilter: ['class'] });
}

function openEditor(entry: CatalogEntry): void {
    state.selectedStyle = entry.key;
    showScreen(3);
    setupEditor();
}

function populateGallery(): void {
    const list = document.getElementById('galleryGrid')!;
    const matrix = encodeQr(state.currentData);
    const format = navigator.gpu?.getPreferredCanvasFormat();
    const id = ++runId;
    list.innerHTML = '';

    for (const entry of CATALOG) {
        const row = document.createElement('article');
        row.className = 'anim-row';
        row.innerHTML = `
            <canvas></canvas>
            <div class="anim-info">
                <h3></h3>
                <p></p>
                <div class="anim-actions">
                    <button class="btn btn-primary btn-small" data-open>Настроить</button>
                    <button class="btn btn-ghost btn-small" data-gif>Скачать GIF</button>
                </div>
            </div>`;
        row.querySelector('h3')!.textContent = entry.title;
        row.querySelector('p')!.textContent = entry.description;
        list.appendChild(row);

        const canvas = row.querySelector('canvas')!;
        fitCanvas(canvas, 200);
        const seed = Math.random();
        row.addEventListener('click', () => openEditor(entry));
        row.querySelector<HTMLButtonElement>('[data-gif]')!.addEventListener('click', e => {
            e.stopPropagation();
            exportGif(e.currentTarget as HTMLButtonElement, entry, seed);
        });

        const context = canvas.getContext('webgpu');
        if (!device || !context || !format) {
            drawQr(canvas, matrix);
            continue;
        }
        context.configure({ device, format, alphaMode: 'opaque' });
        const animationState = entry.animation.createState(device, matrix, seed, format);
        let prev = -1;
        const loop = (now: number) => {
            if (id !== runId || !screenActive(2)) return;
            entry.animation.frame(device, context.getCurrentTexture().createView(), animationState, prev < 0 ? 0 : (now - prev) / 1000);
            prev = now;
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

async function exportGif(button: HTMLButtonElement, entry: CatalogEntry, seed: number): Promise<void> {
    if (!device) return;
    const label = button.textContent;
    button.disabled = true;
    try {
        const blob = await exportAnimation(device, entry.animation, encodeQr(state.currentData), seed, {
            format: 'gif',
            size: 480,
            seconds: 5,
            fps: 20,
            onProgress: done => (button.textContent = Math.round(done * 100) + '%'),
        });
        download(blob, `qr-${entry.key}.gif`);
    } catch (err) {
        console.error('Gallery export failed:', err);
    } finally {
        button.textContent = label;
        button.disabled = false;
    }
}

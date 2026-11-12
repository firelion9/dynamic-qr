import { encodeQr } from '@/qr/encode';
import { device } from '@/gpuState';
import { CATALOG, CatalogEntry } from '@/animation/catalog';
import { drawQr, fitCanvas } from '@/draw';
import { screenActive, showScreen } from '@/navigation';
import { readableColors, rgbToHex } from '@/animation/palette';
import { settings } from '@/settings';
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
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.innerHTML = `
            <canvas></canvas>
            <div class="anim-info">
                <h3></h3>
                <p></p>
            </div>`;
        row.querySelector('h3')!.textContent = entry.title;
        row.querySelector('p')!.textContent = entry.description;
        list.appendChild(row);

        const canvas = row.querySelector('canvas')!;
        fitCanvas(canvas, 200);
        const seed = Math.random();
        row.addEventListener('click', () => openEditor(entry));
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditor(entry);
            }
        });

        const context = device && canvas.getContext('webgpu');
        if (!context || !format) {
            const { dark, light } = readableColors(settings.palette, settings.inverted);
            drawQr(canvas, matrix, rgbToHex(dark), rgbToHex(light));
            continue;
        }
        context.configure({ device, format, alphaMode: 'opaque' });
        const animationState = entry.animation.createState(device, matrix, seed, format, { palette: settings.palette, inverted: settings.inverted });
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

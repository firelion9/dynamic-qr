import { encodeQr, QrMatrix } from '@/qr/encode';
import { device, FrameRenderer } from '@/gpuState';
import { QrAnimation, toRenderable } from '@/animation/utils';
import { AllAnimationsList } from '@/animation/registry';
import { download, exportAnimation } from '@/export';
import { drawQr, fitCanvas } from '@/draw';
import { screenActive, showScreen } from '@/navigation';
import { state } from '@/state';
import { setupEditor } from './editor';

interface GalleryItem {
    renderer: FrameRenderer;
    style: string;
    animation: QrAnimation<any>;
    matrix: QrMatrix;
    seed: number;
}

const galleryRenderers = new Map<number, GalleryItem>();

export function initGallery(): void {
    const screen2 = document.getElementById('screen2') as HTMLElement;
    const btnBack = document.getElementById('btnGalleryBack') as HTMLButtonElement;
    btnBack.addEventListener('click', () => showScreen(1));

    const observer = new MutationObserver(() => {
        if (screenActive(2)) {
            populateGallery();
        }
    });
    observer.observe(screen2, { attributes: true, attributeFilter: ['class'] });

    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            state.selectedStyle = item.getAttribute('data-style') || 'animation1';
            setTimeout(() => {
                showScreen(3);
                setupEditor();
            }, 400);
        });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-export-idx]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!device) {
                alert('WebGPU не инициализирован');
                return;
            }
            const idx = Number(btn.getAttribute('data-export-idx'));
            const item = galleryRenderers.get(idx);
            if (!item) return;

            btn.disabled = true;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span>⏳</span>';

            try {
                const options = { format: 'gif', size: 480, seconds: 5, fps: 20 } as const;
                const blob = await exportAnimation(device, item.animation, item.matrix, item.seed, options);
                download(blob, `animated-qr-${item.style}.gif`);

                btn.innerHTML = '<span>✅</span>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('Gallery export failed:', err);
                btn.innerHTML = '<span>❌</span>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }, 2000);
            }
        });
    });
}

function populateGallery(): void {
    const data = state.currentData;
    const matrix = encodeQr(data);
    const format = navigator.gpu.getPreferredCanvasFormat();
    galleryRenderers.clear();

    for (let i = 1; i <= 6; i++) {
        const container = document.getElementById('galleryQr' + i) as HTMLElement;
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        fitCanvas(canvas, 120);
        const context = canvas.getContext('webgpu');
        const animation = AllAnimationsList[i % AllAnimationsList.length];
        const seed = Math.random();
        const animationState = device ? animation.createState(device, matrix, seed, format) : null;
        if (device && animationState && context) {
            context.configure({ device, format, alphaMode: 'opaque' });
            const renderer = toRenderable(animation, animationState);
            const parentItem = container.closest('.gallery-item');
            const style = parentItem?.getAttribute('data-style') || `effect-${i}`;
            galleryRenderers.set(i, { renderer, style, animation, matrix, seed });

            let prevTime = -1.0;
            const renderLoop = function (time: number) {
                if (screenActive(2)) {
                    if (prevTime == -1.0) prevTime = time;
                    renderer.render(device, context.getCurrentTexture().createView(), (time - prevTime) / 1000.0);
                    prevTime = time;
                    requestAnimationFrame(renderLoop);
                } else {
                    prevTime = time;
                }
            };
            requestAnimationFrame(renderLoop);
        } else {
            drawQr(canvas, matrix);
        }
    }
}
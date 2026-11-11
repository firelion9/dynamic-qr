import { encodeQr } from '@/qr/encode';
import { device, FrameRenderer } from '@/gpuState';
import { toRenderable } from '@/animation/utils';
import { AllAnimationsList } from '@/animation/registry';
import { exportToGif } from '@/gif';
import { drawQr, fitCanvas } from '@/draw';
import { screenActive, showScreen } from '@/navigation';
import { state } from '@/state';
import { setupEditor } from './editor';

const galleryRenderers = new Map<number, { renderer: FrameRenderer; style: string }>();

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
                const gifBlob = await exportToGif(device, item.renderer, 30, 120, 120, 2.0);
                const url = URL.createObjectURL(gifBlob);
                const link = document.createElement('a');
                link.download = `animated-qr-${item.style}.gif`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);

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
        const animationState = device ? animation.createState(device, matrix, Math.random(), format) : null;
        if (device && animationState && context) {
            context.configure({ device, format, alphaMode: 'opaque' });
            const renderer = toRenderable(animation, animationState);
            const parentItem = container.closest('.gallery-item');
            const style = parentItem?.getAttribute('data-style') || `effect-${i}`;
            galleryRenderers.set(i, { renderer, style });

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
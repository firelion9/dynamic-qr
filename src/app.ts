import { initWebGPU } from '@/main';
import { device } from '@/gpuState';
import { showScreen } from '@/navigation';
import { initInput } from '@/screens/input';
import { initGallery } from '@/screens/gallery';
import { initEditor } from '@/screens/editor';
import { startBackground } from '@/background';

initWebGPU()
    .catch(console.error)
    .finally(() => (document.getElementById('gpuNotice')!.hidden = !!device));
startBackground(document.getElementById('bg') as HTMLCanvasElement);

document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(1));
});

initInput();
initGallery();
initEditor();
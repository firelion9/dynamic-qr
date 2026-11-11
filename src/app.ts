import { initWebGPU } from '@/main';
import { showScreen } from '@/navigation';
import { initInput } from '@/screens/input';
import { initGallery } from '@/screens/gallery';
import { initEditor } from '@/screens/editor';
import { startBackground } from '@/background';

initWebGPU().catch(console.error);
startBackground(document.getElementById('bg') as HTMLCanvasElement);

document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(1));
});

initInput();
initGallery();
initEditor();
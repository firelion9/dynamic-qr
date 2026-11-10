import { initWebGPU } from '@/main';
import { showScreen } from '@/navigation';
import { initInput } from '@/screens/input';
import { initGallery } from '@/screens/gallery';
import { initEditor } from '@/screens/editor';

initWebGPU().catch(console.error);

document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(1));
});

initInput();
initGallery();
initEditor();
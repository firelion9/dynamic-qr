import { initWebGPU } from '@/main';
import { device } from '@/gpuState';
import { goBack, showScreen, type ScreenKey } from '@/navigation';
import { initInput } from '@/screens/input';
import { initGallery } from '@/screens/gallery';
import { initEditor, setupEditor } from '@/screens/editor';
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

history.replaceState({ screen: 1 }, '');
addEventListener('popstate', e => {
    const screen: ScreenKey = e.state?.screen ?? 1;
    showScreen(screen, false);
    if (screen === 3) setupEditor();
});
addEventListener('keydown', e => {
    const typing = e.target instanceof HTMLInputElement && e.target.type === 'text';
    if (e.altKey && e.key === 'ArrowLeft' && !typing) {
        e.preventDefault();
        goBack();
    }
});

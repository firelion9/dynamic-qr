import { decodeQr } from '@/qr/decode';
import { state } from '@/state';
import { showScreen } from '@/navigation';

export function initInput(): void {
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const error = document.getElementById('inputError') as HTMLElement;

    const start = (text: string) => {
        state.currentData = text;
        error.hidden = true;
        showScreen(2);
    };
    const fail = (message: string) => {
        error.textContent = message;
        error.hidden = false;
    };

    document.getElementById('btnGenerate')!.addEventListener('click', () => {
        const text = urlInput.value.trim();
        if (text) start(text);
        else fail('Введите ссылку или текст');
    });
    urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnGenerate')!.click();
    });

    document.getElementById('btnUpload')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        const qr = await decodeQr(file).catch(() => null);
        if (qr) {
            urlInput.value = qr.text;
            start(qr.text);
        } else {
            fail('На картинке не нашёлся QR-код');
        }
    });
}

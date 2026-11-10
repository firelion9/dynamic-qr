import { state } from '@/state';
import { showScreen } from '@/navigation';

export function initInput(): void {
    const btnGenerate = document.getElementById('btnGenerate') as HTMLButtonElement;
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    const btnUpload = document.getElementById('btnUpload') as HTMLButtonElement;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;

    btnGenerate.addEventListener('click', () => {
        const input = urlInput.value.trim();
        if (!input) {
            urlInput.style.borderColor = '#ff5f57';
            setTimeout(() => { urlInput.style.borderColor = '#2a2a4e'; }, 1500);
            return;
        }
        state.currentData = input;
        showScreen(2);
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnGenerate.click();
    });

    btnUpload.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            state.currentData = String(ev.target?.result);
            showScreen(2);
        };
        reader.readAsDataURL(file);
    });
}
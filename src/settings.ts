import { DEFAULT_PALETTE, type Palette } from '@/animation/palette';

export interface Settings {
    palette: Palette;
    inverted: boolean;
    qrSize: number;
    speed: number;
    seed: string;
}

const KEY = 'dynamic-qr:settings';
const DEFAULTS: Settings = { palette: DEFAULT_PALETTE, inverted: false, qrSize: 0, speed: 1, seed: '123456789' };

export const settings: Settings = load();

function load(): Settings {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
        return { ...DEFAULTS };
    }
}

export function saveSettings(): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // Private mode or blocked storage: settings just live until reload.
    }
}

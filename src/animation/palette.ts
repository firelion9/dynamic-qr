export type Rgb = [number, number, number];

export interface Palette {
    neon: Rgb;
    accent: Rgb;
}

export const PALETTES: { name: string; palette: Palette }[] = [
    { name: 'Неон', palette: { neon: [0.1, 0.25, 1.0], accent: [0.6, 1.0, 0.1] } },
    { name: 'Закат', palette: { neon: [1.0, 0.2, 0.45], accent: [0.15, 0.9, 1.0] } },
    { name: 'Матрица', palette: { neon: [0.05, 0.85, 0.3], accent: [0.9, 1.0, 0.9] } },
    { name: 'Графит', palette: { neon: [0.45, 0.45, 0.5], accent: [1.0, 0.35, 0.3] } },
];

export const DEFAULT_PALETTE = PALETTES[0].palette;

export function hexToRgb(hex: string): Rgb {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as Rgb;
}

export function rgbToHex(rgb: Rgb): string {
    return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

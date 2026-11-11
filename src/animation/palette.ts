export type Rgb = [number, number, number];

export interface Palette {
    dark: Rgb;
    light: Rgb;
    neon: Rgb;
    accent: Rgb;
}

// Whole modules get a stricter limit than the shaders' per-pixel 0.28 / 0.72, so a camera has some margin.
const MAX_DARK = 0.22;
const MIN_LIGHT = 0.78;

function themed(neon: Rgb, accent: Rgb): Palette {
    return { dark: neon.map(v => v * 0.03 + 0.01) as Rgb, light: mix(neon, [1, 1, 1], 0.7), neon, accent };
}

export const PALETTES: { name: string; palette: Palette }[] = [
    { name: 'Неон', palette: themed([0.1, 0.25, 1.0], [0.6, 1.0, 0.1]) },
    { name: 'Закат', palette: themed([1.0, 0.2, 0.45], [0.15, 0.9, 1.0]) },
    { name: 'Матрица', palette: themed([0.05, 0.85, 0.3], [0.9, 1.0, 0.9]) },
    { name: 'Графит', palette: themed([0.45, 0.45, 0.5], [1.0, 0.35, 0.3]) },
    { name: 'Классика', palette: { dark: [0.0, 0.0, 0.0], light: [1.0, 1.0, 1.0], neon: [0.75, 0.75, 0.75], accent: [0.1, 0.1, 0.1] } },
];

export const DEFAULT_PALETTE = PALETTES[0].palette;
export const MONOCHROME: Pick<Palette, 'dark' | 'light'> = { dark: [0, 0, 0], light: [1, 1, 1] };

export function luma([r, g, b]: Rgb): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function readableDark(c: Rgb): Rgb {
    const l = luma(c);
    return l <= MAX_DARK ? c : (c.map(v => (v * MAX_DARK) / l) as Rgb);
}

export function readableColors(palette?: Palette): Palette {
    return palette ? { dark: readableDark(palette.dark), light: readableLight(palette.light), neon: palette.neon, accent: palette.accent } : DEFAULT_PALETTE;
}

export function readableLight(c: Rgb): Rgb {
    const l = luma(c);
    return l >= MIN_LIGHT ? c : mix(c, [1, 1, 1], (MIN_LIGHT - l) / (1 - l));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return a.map((v, i) => v + (b[i] - v) * t) as Rgb;
}

export function hexToRgb(hex: string): Rgb {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as Rgb;
}

export function rgbToHex(rgb: Rgb): string {
    return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

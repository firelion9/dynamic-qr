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
    return { dark: readableDark(neon.map(v => v * 0.03 + 0.01) as Rgb), light: readableLight(mix(neon, [1, 1, 1], 0.7)), neon, accent };
}

export const FLAME_PALETTE: Palette = {
    ...themed([1.0, 0.28, 0.02], [1.0, 0.88, 0.15]),
    light: [1.0, 1.0, 1.0],
};
export const WATER_PALETTE: Palette = {
    ...themed([0.05, 0.65, 1.0], [0.4, 0.95, 1.0]),
    light: [1.0, 1.0, 1.0],
};
export const GRUVBOX_PALETTE: Palette = {
    dark: hexToRgb('#282828'),
    light: hexToRgb('#fbf1c7'),
    neon: hexToRgb('#fe8019'),
    accent: hexToRgb('#b8bb26'),
};

export const PALETTES: { name: string; palette: Palette }[] = [
    { name: 'Потоп', palette: WATER_PALETTE },
    { name: 'Неон', palette: themed([0.1, 0.25, 1.0], [0.6, 1.0, 0.1]) },
    { name: 'Пламя', palette: FLAME_PALETTE },
    { name: 'Ретро', palette: GRUVBOX_PALETTE },
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

export function readableColors(palette = DEFAULT_PALETTE, inverted = false): Palette {
    const dark = readableDark(palette.dark);
    const light = readableLight(palette.light);
    return { ...palette, dark: inverted ? light : dark, light: inverted ? dark : light };
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

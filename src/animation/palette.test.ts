import { expect, it } from 'vitest';
import { hexToRgb, luma, PALETTES, readableDark, readableLight, Rgb } from './palette';

const COLORS: Rgb[] = ['#ffffff', '#000000', '#ffee00', '#1d47ff', '#ff0080', '#808080', '#00ff00'].map(hexToRgb);

it('keeps any colour on the right side of the threshold', () => {
    for (const c of COLORS) {
        expect(luma(readableDark(c))).toBeLessThanOrEqual(0.22 + 1e-9);
        expect(luma(readableLight(c))).toBeGreaterThanOrEqual(0.78 - 1e-9);
    }
});

it('leaves good colours and presets untouched', () => {
    expect(readableDark([0, 0, 0])).toEqual([0, 0, 0]);
    expect(readableLight([1, 1, 1])).toEqual([1, 1, 1]);
    for (const { palette } of PALETTES) {
        expect(readableDark(palette.dark)).toEqual(palette.dark);
        expect(readableLight(palette.light)).toEqual(palette.light);
    }
});

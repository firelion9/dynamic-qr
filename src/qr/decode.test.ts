import { beforeAll, describe, expect, it } from 'vitest';
import { decodeQr } from './decode';
import { encodeQr } from './encode';
import { loadZxing, render } from './test-utils';

beforeAll(loadZxing);

describe('decodeQr', () => {
    const cases = ['https://github.com/firelion9/dynamic-qr', 'Привет, ИТМО!', 'x'.repeat(500)];

    it.each(cases)('round-trips %#', async (text) => {
        const matrix = encodeQr(text);
        expect(await decodeQr(render(matrix))).toEqual({ text, matrix });
    });

    it('handles rotated image', async () => {
        const matrix = encodeQr('rotated');
        expect(await decodeQr(render(matrix, { rotate: true }))).toEqual({ text: 'rotated', matrix });
    });

    it('handles inverted colors', async () => {
        const matrix = encodeQr('inverted');
        expect((await decodeQr(render(matrix, { invert: true })))?.text).toBe('inverted');
    });

    it('returns null without QR', async () => {
        expect(await decodeQr(render([[false]]))).toBeNull();
    });
});

import { describe, expect, it } from 'vitest';
import { encodeQr } from './encode';

describe('encodeQr', () => {
    it('builds square matrix with finder patterns', () => {
        const m = encodeQr('hello');
        expect(m.length).toBe(m[0].length);
        expect((m.length - 17) % 4).toBe(0);
        for (const [r, c] of [[0, 0], [0, m.length - 7], [m.length - 7, 0]]) {
            expect(m[r][c] && m[r + 6][c + 6] && m[r + 3][c + 3]).toBe(true);
            expect(m[r + 1][c + 1]).toBe(false);
        }
    });

    it('grows with error correction level', () => {
        expect(encodeQr('https://example.com', 'H').length).toBeGreaterThan(encodeQr('https://example.com', 'L').length);
    });

    it('depends on text', () => {
        expect(encodeQr('a')).not.toEqual(encodeQr('b'));
    });

    it('throws when text does not fit', () => {
        expect(() => encodeQr('x'.repeat(3000))).toThrow();
    });
});

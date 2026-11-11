export function random(seed: number): () => number {
    let a = Math.floor(seed * 2 ** 32) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
}

export function hashSeed(text: string): number {
    let h = 0x811c9dc5;
    for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193);
    return (h >>> 0) / 2 ** 32;
}

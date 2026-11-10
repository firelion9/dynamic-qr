declare module 'qrcode/lib/core/error-correction-level.js' {
    export interface Level { bit: number }
    export const L: Level;
    export const M: Level;
    export const Q: Level;
    export const H: Level;
}

declare module 'qrcode/lib/core/error-correction-code.js' {
    import type { Level } from 'qrcode/lib/core/error-correction-level.js';
    export function getBlocksCount(version: number, level: Level): number;
    export function getTotalCodewordsCount(version: number, level: Level): number;
}

declare module 'qrcode/lib/core/format-info.js' {
    import type { Level } from 'qrcode/lib/core/error-correction-level.js';
    export function getEncodedBits(level: Level, mask: number): number;
}

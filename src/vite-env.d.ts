/// <reference types="vite/client" />

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module 'gifenc' {
  export function GIFEncoder(options?: any): any;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: any): any;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: any, format?: string): any;
}
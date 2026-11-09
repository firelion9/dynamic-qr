import QRCode from 'qrcode';

export type QrMatrix = boolean[][];
export type EcLevel = 'L' | 'M' | 'Q' | 'H';

export function encodeQr(text: string, ecLevel: EcLevel = 'H'): QrMatrix {
    const { size, data } = QRCode.create(text, { errorCorrectionLevel: ecLevel }).modules;
    return Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => data[row * size + col] === 1),
    );
}

import QRCode from 'qrcode';

export type QrMatrix = boolean[][];
export type EcLevel = 'L' | 'M' | 'Q' | 'H';

export function encodeQr(text: string, ecLevel: EcLevel = 'H', minVersion = 1): QrMatrix {
    let qr = QRCode.create(text, { errorCorrectionLevel: ecLevel });
    if (qr.version < minVersion) {
        qr = QRCode.create(text, { errorCorrectionLevel: ecLevel, version: minVersion });
    }
    const { size, data } = qr.modules;
    return Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => data[row * size + col] === 1),
    );
}

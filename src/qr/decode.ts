import type { QrMatrix } from './encode';

export interface DecodedQr {
    text: string;
    matrix: QrMatrix;
}

export async function decodeQr(_image: Blob | ImageData): Promise<DecodedQr | null> {
    throw new Error('decodeQr is not implemented yet');
}

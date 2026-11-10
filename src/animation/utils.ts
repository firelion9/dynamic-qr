import { FrameRenderer } from "@/gpuState";
import { QrMatrix } from "@/qr/encode";

export interface QrAnimation<S> {
    init: (device: GPUDevice) => Promise<void>;
    createState: (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat) => S;
    frame: (device: GPUDevice, context: GPUCanvasContext, state: S, delta: number) => void;
}

export interface BufferWithLayout {
    buffer: GPUBuffer;
    layout: GPUVertexBufferLayout;
}
export interface QrDataBuffers {
    qrSize: number;
    vertexCount: number;
    positionsBuffer: BufferWithLayout;
    qrAttributesBuffer: BufferWithLayout;
}

export function toRenderable<S>(animation: QrAnimation<S>, state: S): FrameRenderer {
    return {
        render: function (device: GPUDevice, context: GPUCanvasContext, delta: number): void {
            return animation.frame(device, context, state, delta);
        }
    }
}

export function qrDataToBuffers(device: GPUDevice, data: QrMatrix): QrDataBuffers {
    const n = data.length;
    const vertexCount = n * n * 2 * 3;
    const moduleSize = 1.0 / n;

    const positions = new Float32Array(vertexCount * 2);
    for (let y = 0, bufferOffset = 0; y < n; ++y) {
        for (let x = 0; x < n; ++x) {
            // 0,3 - 2
            //  | \  |
            //  4 - 1,5
            positions[bufferOffset++] = moduleSize * (x + 0);
            positions[bufferOffset++] = moduleSize * (y + 1);

            positions[bufferOffset++] = moduleSize * (x + 1);
            positions[bufferOffset++] = moduleSize * (y + 0);

            positions[bufferOffset++] = moduleSize * (x + 1);
            positions[bufferOffset++] = moduleSize * (y + 1);

            positions[bufferOffset++] = moduleSize * (x + 0);
            positions[bufferOffset++] = moduleSize * (y + 1);

            positions[bufferOffset++] = moduleSize * (x + 0);
            positions[bufferOffset++] = moduleSize * (y + 0);

            positions[bufferOffset++] = moduleSize * (x + 1);
            positions[bufferOffset++] = moduleSize * (y + 0);
        }
    }
    const positionsBuffer = device.createBuffer({
        size: positions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const positionsBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 8 /* 2 * f32 */,
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },  // position
        ],
    };
    device.queue.writeBuffer(positionsBuffer, 0, positions);

    const moduleAttributes = new Uint32Array(vertexCount * 3);
    for (let y = 0, bufferOffset = 0; y < n; ++y) {
        for (let x = 0; x < n; ++x) {
            for (let i = 0; i < 6; ++i) {
                moduleAttributes[bufferOffset++] = x;
                moduleAttributes[bufferOffset++] = y;
                moduleAttributes[bufferOffset++] = data[y][x] ? 1 : 0;
            }
        }
    }
    const moduleAttributesBuffer = device.createBuffer({
        size: moduleAttributes.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const moduleAttributesBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 12 /* 3 * u32 */,
        attributes: [
            { shaderLocation: 1, offset: 0, format: "uint32x2" },  // position
            { shaderLocation: 2, offset: 8, format: "uint32" },    // flags
        ],
    };
    device.queue.writeBuffer(moduleAttributesBuffer, 0, moduleAttributes);

    return {
        qrSize: n,
        vertexCount: vertexCount,
        positionsBuffer: { buffer: positionsBuffer, layout: positionsBufferLayout },
        qrAttributesBuffer: { buffer: moduleAttributesBuffer, layout: moduleAttributesBufferLayout },
    };
}

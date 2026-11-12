import { FrameRenderer } from "@/gpuState";
import { QrMatrix } from "@/qr/encode";
import { freeModules, qrLayout } from "@/qr/layout";
import { readableColors, type Palette } from "./palette";

export interface AnimationOptions {
    palette: Palette;
    inverted?: boolean;
}

export interface QrAnimation<S> {
    init: (device: GPUDevice) => Promise<void>;
    createState: (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, options?: AnimationOptions) => S;
    frame: (device: GPUDevice, outTexture: GPUTextureView, state: S, delta: number) => void;
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
    uniformBuffer: GPUBuffer;
    uniformBindGroup: GPUBindGroup;
    uniformLayout: GPUBindGroupLayout;
    time: number;
    seed: number;
    colors: Palette;
    inverted: boolean;
}

export function updateQrDataUniforms (data: QrDataBuffers, device: GPUDevice, delta: number) {
    data.time += delta;
    const { dark, light } = data.colors;
    device.queue.writeBuffer(data.uniformBuffer, 0, new Float32Array([data.time, data.seed, data.qrSize, data.inverted ? 1 : 0, ...dark, 0, ...light, 0]));
}

export function doDrawQrData (data: QrDataBuffers, pass: GPURenderPassEncoder) {
    pass.setBindGroup(0, data.uniformBindGroup);
    pass.setVertexBuffer(0, data.positionsBuffer.buffer);
    pass.setVertexBuffer(1, data.qrAttributesBuffer.buffer);
    pass.draw(data.vertexCount);
}

export async function compileShader (device: GPUDevice, shaderCode: string): Promise<GPUShaderModule> {
    const shaderModule = device.createShaderModule({
        code: shaderCode,
    });

    const compilationInfo = await shaderModule.getCompilationInfo();
    if (compilationInfo.messages.length > 0) {
        for (const msg of compilationInfo.messages) {
            console.warn(`Shader [${msg.type}] at line ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
        }
    } else {
        console.log("Shader compiled cleanly.");
    }
    return shaderModule
}

export function toRenderable<S>(animation: QrAnimation<S>, state: S): FrameRenderer {
    return {
        render: function (device: GPUDevice, outTexture: GPUTextureView, delta: number): void {
            return animation.frame(device, outTexture, state, delta);
        }
    }
}

export function qrDataToBuffers(device: GPUDevice, data: QrMatrix, seed: number, options?: AnimationOptions, frame = 4): QrDataBuffers {
    const inverted = !!options?.inverted;
    const colors = readableColors(options?.palette, inverted);
    const n = data.length + 2 * frame;
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

    const layout = qrLayout(data);
    const free = freeModules(layout);
    const moduleAttributes = new Uint32Array(vertexCount * 4);
    for (let y = 0, bufferOffset = 0; y < n; ++y) {
        for (let x = 0; x < n; ++x) {
            const [row, col] = [y - frame, x - frame];
            const inQr = row >= 0 && row < data.length && col >= 0 && col < data.length;
            const flags = inQr
                ? (data[row][col] ? 1 : 0) | (layout.reserved[row][col] ? 2 : 0) | (free[row][col] ? 4 : 0)
                : 2 | 8;
            const codeword = inQr ? layout.codeword[row][col] : -1;
            for (let i = 0; i < 6; ++i) {
                moduleAttributes[bufferOffset++] = x;
                moduleAttributes[bufferOffset++] = y;
                moduleAttributes[bufferOffset++] = flags;
                moduleAttributes[bufferOffset++] = codeword;
            }
        }
    }
    const moduleAttributesBuffer = device.createBuffer({
        size: moduleAttributes.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const moduleAttributesBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 16 /* 4 * u32 */,
        attributes: [
            { shaderLocation: 1, offset: 0, format: "uint32x2" },  // position
            { shaderLocation: 2, offset: 8, format: "uint32" },    // flags
            { shaderLocation: 3, offset: 12, format: "uint32" },   // codeword
        ],
    };
    device.queue.writeBuffer(moduleAttributesBuffer, 0, moduleAttributes);

    const uniformLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
        }],
    });
    const uniformBuffer = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformBindGroup = device.createBindGroup({
        layout: uniformLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    return {
        qrSize: n,
        vertexCount: vertexCount,
        positionsBuffer: { buffer: positionsBuffer, layout: positionsBufferLayout },
        qrAttributesBuffer: { buffer: moduleAttributesBuffer, layout: moduleAttributesBufferLayout },
        uniformBindGroup: uniformBindGroup,
        uniformBuffer: uniformBuffer,
        uniformLayout: uniformLayout,
        time: 0.0,
        seed: seed,
        colors,
        inverted,
    };
}

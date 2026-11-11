import shaderCode from '@/shaders/wave.wgsl?raw';
import { QrMatrix } from "@/qr/encode";
import { AnimationOptions, compileShader, doDrawQrData, QrAnimation, QrDataBuffers, qrDataToBuffers, updateQrDataUniforms } from "./utils";
import { readableColors } from "./palette";

let shaderModule: GPUShaderModule;

export const WaveAnimation: QrAnimation<WaveAnimationState> = {
    createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, options?: AnimationOptions): WaveAnimationState {
        let buffers = qrDataToBuffers(device, data, seed, readableColors(options?.palette));

        const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [buffers.uniformLayout] }),
            vertex: { module: shaderModule, entryPoint: "vertShader", buffers: [buffers.positionsBuffer.layout, buffers.qrAttributesBuffer.layout] },
            fragment: { module: shaderModule, entryPoint: "fragmentShader", targets: [{ format }] },
            primitive: { topology: "triangle-list" },
        });
        return { buffers, pipeline };
    },

    frame: function (device: GPUDevice, outTexture: GPUTextureView, state: WaveAnimationState, delta: number): void {
        updateQrDataUniforms(state.buffers, device, delta);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: outTexture,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
        });
        pass.setPipeline(state.pipeline);
        doDrawQrData(state.buffers, pass);
        pass.end();
        device.queue.submit([encoder.finish()]);
    },

    init: async function (device: GPUDevice): Promise<void> {
        shaderModule = await compileShader(device, shaderCode);
    }
}

export interface WaveAnimationState {
    buffers: QrDataBuffers;
    pipeline: GPURenderPipeline;
}
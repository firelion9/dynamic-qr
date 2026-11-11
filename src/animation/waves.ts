import shaderCode from '@/shaders/waves.wgsl?raw';
import { QrMatrix } from "@/qr/encode";
import { AnimationOptions, compileShader, doDrawQrData, QrAnimation, QrDataBuffers, qrDataToBuffers, updateQrDataUniforms } from "./utils";
import { expandPalette, readableColors } from './palette';

let shaderModule: GPUShaderModule;

export const WavesAnimation: QrAnimation<WavesAnimationState> = {
    createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, options?: AnimationOptions): WavesAnimationState {
        let buffers = qrDataToBuffers(device, data, seed, expandPalette(readableColors(options?.palette)));

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [buffers.uniformLayout],
        });
        const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: "vertShader", buffers: [buffers.positionsBuffer.layout, buffers.qrAttributesBuffer.layout] },
            fragment: { module: shaderModule, entryPoint: "fragmentShader", targets: [{ format }] },
            primitive: { topology: "triangle-list" },
        });
        return { buffers, pipeline };
    },

    frame: function (device: GPUDevice, outTexture: GPUTextureView, state: WavesAnimationState, delta: number): void {
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

export interface WavesAnimationState {
    buffers: QrDataBuffers;
    pipeline: GPURenderPipeline;
}

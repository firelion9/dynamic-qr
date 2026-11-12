import lumaCode from '@/shaders/luma.wgsl?raw';
import shaderCode from '@/shaders/waves.wgsl?raw';
import { QrMatrix } from "@/qr/encode";
import { AnimationOptions, compileShader, doDrawQrData, QrAnimation, QrDataBuffers, qrDataToBuffers, updateQrDataUniforms } from "./utils";

let shaderModule: GPUShaderModule;

export const WavesAnimation: QrAnimation<WavesAnimationState> = {
    createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat, options?: AnimationOptions): WavesAnimationState {
        let buffers = qrDataToBuffers(device, data, seed, options);

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [
                buffers.uniformLayout,
                device.createBindGroupLayout({
                    entries: [{
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                        buffer: { type: "uniform" },
                    }],
                }),
            ],
        });
        const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: "vertShader", buffers: [buffers.positionsBuffer.layout, buffers.qrAttributesBuffer.layout] },
            fragment: { module: shaderModule, entryPoint: "fragmentShader", targets: [{ format }] },
            primitive: { topology: "triangle-list" },
        });

        const waveColorsBuffer = device.createBuffer({ size: 4 * 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const waveBindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: waveColorsBuffer } },
            ],
        });
        return { buffers, pipeline, waveColorsBuffer, waveBindGroup };
    },

    frame: function (device: GPUDevice, outTexture: GPUTextureView, state: WavesAnimationState, delta: number): void {
        updateQrDataUniforms(state.buffers, device, delta);
        device.queue.writeBuffer(state.waveColorsBuffer, 0, new Float32Array([...state.buffers.colors.accent, 0, ...state.buffers.colors.neon, 0, ...state.buffers.colors.accent, 0, ...state.buffers.colors.neon, 0]));

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
        pass.setBindGroup(1, state.waveBindGroup);
        doDrawQrData(state.buffers, pass);
        pass.end();
        device.queue.submit([encoder.finish()]);
    },

    init: async function (device: GPUDevice): Promise<void> {
        shaderModule = await compileShader(device, lumaCode + shaderCode);
    }
}

export interface WavesAnimationState {
    buffers: QrDataBuffers;
    pipeline: GPURenderPipeline;
    waveBindGroup: GPUBindGroup;
    waveColorsBuffer: GPUBuffer;
}

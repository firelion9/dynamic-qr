import shaderCode from '@/shaders/static.wgsl?raw';
import { QrMatrix } from "@/qr/encode";
import { QrAnimation, QrDataBuffers, qrDataToBuffers } from "./utils";

let shaderModule: GPUShaderModule;

export const StaticAnimation: QrAnimation<StaticAnimationState> = {
    createState: function (device: GPUDevice, data: QrMatrix, seed: number, format: GPUTextureFormat): StaticAnimationState {
        let buffers = qrDataToBuffers(device, data);
        const pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: { module: shaderModule, entryPoint: "vertShader", buffers: [buffers.positionsBuffer.layout, buffers.qrAttributesBuffer.layout] },
            fragment: { module: shaderModule, entryPoint: "fragmentShader", targets: [{ format }] },
            primitive: { topology: "triangle-list" },
        });
        return { buffers, pipeline };
    },

    frame: function (device: GPUDevice, context: GPUCanvasContext, state: StaticAnimationState, delta: number): void {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
        });
        pass.setPipeline(state.pipeline);
        pass.setVertexBuffer(0, state.buffers.positionsBuffer.buffer);
        pass.setVertexBuffer(1, state.buffers.qrAttributesBuffer.buffer);
        pass.draw(state.buffers.vertexCount);
        pass.end();
        device.queue.submit([encoder.finish()]);
    },

    init: async function (device: GPUDevice): Promise<void> {
        shaderModule = device.createShaderModule({
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
    }
}

export interface StaticAnimationState {
    buffers: QrDataBuffers;
    pipeline: GPURenderPipeline;
}

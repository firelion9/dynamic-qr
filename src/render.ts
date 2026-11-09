import { device } from "@/gpuState";


export async function applyToCanvas(canvas: HTMLCanvasElement, shader: GPUShaderModule) {
    if (!device) {
        throw new Error("Device is not initialized in gpuState");
    }

    const context = canvas.getContext('webgpu');
    if (!context) throw new Error("WebGPU context unavailable");

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    const pipeline = device.createRenderPipeline({
        label: 'Shader pipeline',
        layout: 'auto',
        vertex: {
            module: shader,
            entryPoint: 'vs_main',
        },
        fragment: {
            module: shader,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            },
        ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.draw(3); // Draw 3 vertices
    renderPass.end();

    // Send to gPU
    device.queue.submit([encoder.finish()]);


}
import { device, FrameRenderer } from "@/gpuState";


export async function applyToCanvas(canvas: HTMLCanvasElement, frameRenderer: FrameRenderer) {
    if (!device) {
        throw new Error("Device is not initialized in gpuState");
    }

    const context = canvas.getContext('webgpu');
    if (!context) throw new Error("WebGPU context unavailable");

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    frameRenderer.render(device, context.getCurrentTexture().createView(), 0.0);
}

export function wrapCanvasAnimation(canvas: HTMLCanvasElement, frameRenderer: FrameRenderer): (delta: number) => void {
    if (!device) {
        throw new Error("Device is not initialized in gpuState");
    }

    const context = canvas.getContext('webgpu');
    if (!context) throw new Error("WebGPU context unavailable");

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    return function (delta: number) { frameRenderer.render(device, context.getCurrentTexture().createView(), delta); }
}

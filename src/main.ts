import shaderCode from '@/shaders/test.wgsl?raw';
import { setGPUState } from '@/gpuState';
import { encodeQr } from './qr/encode';
import { StaticAnimation } from './animation/static';
import { toRenderable } from './animation/utils';

export async function initWebGPU() {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported");
        return null;
    }

    const data = encodeQr("example.org");
    const animation = StaticAnimation;
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'low-power', // Prefers the Intel GPU
    });
    const device = await adapter?.requestDevice();

    if (!device) {
        console.error("Failed to receive device. Check that WebGPU is enabled in your browser and works correctly. Sometimes you need have things like Vulkan drivers installed (for Chrome for example). Also enable Vulkan in the browser settings");
        return null;
    }

    animation.init(device);

    const state = StaticAnimation.createState(device, data, 0, navigator.gpu.getPreferredCanvasFormat());

    setGPUState(device, toRenderable(animation, state));
}
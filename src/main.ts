import { setGPUState } from '@/gpuState';
import { encodeQr } from './qr/encode';
import { toRenderable } from './animation/utils';
import { FlippingAnimation } from './animation/flipping';
import { AllAnimationsList } from './animation/registry';

export async function initWebGPU() {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported");
        return null;
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'low-power', // Prefers the Intel GPU
    });
    const device = await adapter?.requestDevice();

    if (!device) {
        console.error("Failed to receive device. Check that WebGPU is enabled in your browser and works correctly. Sometimes you need have things like Vulkan drivers installed (for Chrome for example). Also enable Vulkan in the browser settings");
        return null;
    }

    await Promise.all(AllAnimationsList.map(anim => anim.init(device)));

    setGPUState(device);
}
import shaderCode from '@/shaders/test.wgsl?raw';
import { setGPUState } from '@/gpuState';

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

    setGPUState(device, shaderModule);
    return { device, shaderModule };
}
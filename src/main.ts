import shaderCode from '@/shaders/qr.wgsl?raw'

async function main() {

    if (!navigator.gpu) {
        console.error("WebGPU is not supported");
        return;
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'low-power', // Prefers the Intel GPU
    });
    const device = await adapter?.requestDevice();

    if (!device) {
        console.error("Failed to receive device. Check that WebGPU is enabled in your browser and works correctly. Sometimes you need have things like Vulkan drivers installed (for Chrome for example). Also enable Vulkan in the browser settings");
        return;
    }

    // This where shader is compiled, this could throw
    // if shader has errors - keep that in mind
    const shaderModule = device.createShaderModule({
        code: shaderCode,
    });

}

main();
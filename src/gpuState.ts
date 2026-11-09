export let device: GPUDevice;
export let shaderModule: GPUShaderModule;

export function setGPUState(dev: GPUDevice, mod: GPUShaderModule) {
    device = dev;
    shaderModule = mod;
}

export async function logErrors(){
     const error = await device.popErrorScope();
  if (error) {
    console.error("GPU Error detected:", error.message);
  }
}

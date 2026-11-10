import { QrAnimation } from "./animation/utils";

export interface FrameRenderer {
  render: (device: GPUDevice, outTexture: GPUTextureView, delta: number) => void;
}

export let device: GPUDevice;

export function setGPUState(dev: GPUDevice) {
    device = dev;
}

export async function logErrors(){
     const error = await device.popErrorScope();
  if (error) {
    console.error("GPU Error detected:", error.message);
  }
}

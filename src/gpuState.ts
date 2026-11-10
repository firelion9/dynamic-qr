import { QrAnimation } from "./animation/utils";

export interface FrameRenderer {
  render: (device: GPUDevice, context: GPUCanvasContext, delta: number) => void;
}

export let device: GPUDevice;
export let frameRenderer: FrameRenderer;

export function setGPUState(dev: GPUDevice, renderer: FrameRenderer) {
    device = dev;
    frameRenderer = renderer;
}

export async function logErrors(){
     const error = await device.popErrorScope();
  if (error) {
    console.error("GPU Error detected:", error.message);
  }
}

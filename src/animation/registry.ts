import { FlippingAnimation } from "./flipping";
import { StaticAnimation } from "./static";

export const AllAnimations = new Map([
    ["static", StaticAnimation],
    ["flipping", FlippingAnimation],
]);

export const AllAnimationsList = AllAnimations.values().toArray();
import { FlippingAnimation } from "./flipping";
import { SnakeAnimation, SnakeDuelAnimation } from "./snake";
import { StaticAnimation } from "./static";
import type { QrAnimation } from "./utils";

export const AllAnimations = new Map<string, QrAnimation<any>>([
    ["static", StaticAnimation],
    ["flipping", FlippingAnimation],
    ["snake", SnakeAnimation],
    ["snake-duel", SnakeDuelAnimation],
]);

export const AllAnimationsList = AllAnimations.values().toArray();
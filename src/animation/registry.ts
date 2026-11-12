import { FlippingAnimation } from "./flipping";
import { MazeAnimation } from "./maze";
import { SnakeAnimation, SnakeDuelAnimation } from "./snake";
import { BreathAnimation } from "./breath";
import { WaveAnimation } from "./wave";
import { StaticAnimation } from "./static";
import type { QrAnimation } from "./utils";
import { WavesAnimation } from "./waves";

export const AllAnimations = new Map<string, QrAnimation<any>>([
    ["static", StaticAnimation],
    ["flipping", FlippingAnimation],
    ["snake", SnakeAnimation],
    ["snake-duel", SnakeDuelAnimation],
    ["maze", MazeAnimation],
    ["breath", BreathAnimation],
    ["waves", WavesAnimation],
    ["wave", WaveAnimation],
]);

export const AllAnimationsList = [...AllAnimations.values()];
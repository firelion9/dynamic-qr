import { FlippingAnimation } from "./flipping";
import { MazeAnimation, MazeNightAnimation } from "./maze";
import { SnakeAnimation, SnakeDuelAnimation } from "./snake";
import { BreathAnimation } from "./breath";
import { StaticAnimation } from "./static";
import type { QrAnimation } from "./utils";
import { WavesAnimation } from "./waves";

export const AllAnimations = new Map<string, QrAnimation<any>>([
    ["static", StaticAnimation],
    ["flipping", FlippingAnimation],
    ["snake", SnakeAnimation],
    ["snake-duel", SnakeDuelAnimation],
    ["maze", MazeAnimation],
    ["maze-night", MazeNightAnimation],
    ["breath", BreathAnimation],
    ["waves", WavesAnimation],
]);

export const AllAnimationsList = AllAnimations.values().toArray();
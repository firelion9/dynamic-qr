import { FlameAnimation } from "./flame";
import { FloodAnimation } from "./flood";
import { LifeAnimation } from "./life";
import { TrainAnimation } from "./train";
import { SnakeAnimation, SnakeDuelAnimation } from "./snake";
import { FlippingAnimation } from "./flipping";
import { MazeAnimation } from "./maze";
import { MatrixAnimation } from "./matrix";
import { BreathAnimation } from "./breath";
import { WaveAnimation } from "./wave";
import { WavesAnimation } from "./waves";
import { StaticAnimation } from "./static";
import type { QrAnimation } from "./utils";

export const AllAnimations = new Map<string, QrAnimation<any>>([
    ["snake", SnakeAnimation],
    ["snake-duel", SnakeDuelAnimation],
    ["maze", MazeAnimation],
    ["train", TrainAnimation],
    ["flame", FlameAnimation],
    ["flood", FloodAnimation],
    ["life", LifeAnimation],
    ["flipping", FlippingAnimation],
    ["static", StaticAnimation],
    ["breath", BreathAnimation],
    ["waves", WavesAnimation],
    ["wave", WaveAnimation],
    ["matrix", MatrixAnimation],
]);

export const AllAnimationsList = [...AllAnimations.values()];

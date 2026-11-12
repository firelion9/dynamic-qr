import githubCode from '@/shaders/github.wgsl?raw';
import radarCode from '@/shaders/radar.wgsl?raw';
import { gridShaderAnimation } from './grid-shader';
import { radarShips } from './radar';

export const GithubAnimation = gridShaderAnimation(githubCode);
export const RadarAnimation = gridShaderAnimation(radarCode, radarShips);

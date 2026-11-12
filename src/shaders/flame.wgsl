struct Uniforms {
    time: f32,
    size: f32,
    tickProgress: f32,
    inverted: f32,
    neon: vec3f,
    pad1: f32,
    accent: vec3f,
    pad2: f32,
    dark: vec3f,
    pad3: f32,
    light: vec3f,
    pad4: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vertShader(@builtin(vertex_index) i: u32) -> VertexOutput {
    let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
    var out: VertexOutput;
    out.position = vec4f(p, 0.0, 1.0);
    out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return out;
}

fn cell(c: vec2i) -> u32 {
    let n = i32(u.size);
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) {
        return 2u;
    }
    return grid[c.y * n + c.x];
}

fn isDark(f: u32) -> bool { return (f & 1u) != 0u; }
fn shownDark(f: u32) -> bool { return isDark(f) != (u.inverted > 0.5); }
fn isReserved(f: u32) -> bool { return (f & 2u) != 0u; }
fn isFuel(f: u32) -> bool { return (f & 4u) != 0u; }
fn stage(f: u32) -> u32 { return (f >> 4u) & 15u; }
fn stageTicks(f: u32) -> u32 { return (f >> 8u) & 255u; }
fn cellHash(f: u32) -> f32 { return f32((f >> 16u) & 255u) / 255.0; }

fn hash2(p: vec2f) -> f32 {
    let p3 = fract(vec3f(p.xyx) * 0.1031);
    let p4 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p4.x + p4.y) * p4.z);
}

const DARK_LIMIT: f32 = 0.22;
const LIGHT_LIMIT: f32 = 0.78;

fn luma(c: vec3f) -> f32 {
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn clampLuma(c: vec3f, isLight: bool) -> vec3f {
    let l = luma(c);
    if (!isLight) {
        if (l > DARK_LIMIT) {
            return c * (DARK_LIMIT / max(l, 1e-4));
        }
        return c;
    } else {
        if (l < LIGHT_LIMIT) {
            return mix(c, vec3f(1.0), (LIGHT_LIMIT - l) / max(1.0 - l, 1e-4));
        }
        return c;
    }
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);

    let local = fract(p) - 0.5;
    let distFromCenter = max(abs(local.x), abs(local.y));

    let st = stage(f);
    let cellDark = shownDark(f);
    let bg = select(u.light, u.dark, u.inverted > 0.5);
    let fg = select(u.dark, u.light, u.inverted > 0.5);

    var color: vec3f;

    if (st == 1u) {
        let progress = clamp(f32(stageTicks(f)) / 2.0, 0.0, 1.0);
        let pulse = 0.85 + 0.15 * sin(u.time * 20.0 + f32(c.x * 7 + c.y * 3));
        let warmBase = mix(bg, u.neon, (0.7 + 0.3 * progress) * pulse);
        let centerEmber = mix(u.neon, u.accent, 0.85);

        if (distFromCenter < 0.28) {
            color = mix(warmBase, centerEmber, (0.28 - distFromCenter) / 0.28);
        } else {
            color = warmBase;
        }
    } else if (st == 2u) {
        let flameWave = sin(u.time * 22.0 + f32(c.x * 11 + c.y * 5) + local.x * 14.0) * 0.12;
        let flameLick = local.y + flameWave;

        if (distFromCenter < 0.18) {
            color = mix(u.accent, vec3f(1.0), 0.85);
        } else if (distFromCenter < 0.36) {
            let t = (distFromCenter - 0.18) / 0.18;
            color = mix(mix(u.accent, vec3f(1.0), 0.4), u.neon, t);
        } else {
            let edgeFire = mix(u.neon, u.accent, 0.5 + 0.5 * sin(u.time * 18.0 + local.x * 10.0));
            color = mix(edgeFire, fg, max(0.0, flameLick * 0.5));
        }

        let sparkGrid = vec2f(floor(p.x * 6.0), floor((p.y - u.time * 4.5) * 6.0));
        let spark = hash2(sparkGrid + f32(c.x * 17));
        if (spark > 0.88 && distFromCenter < 0.65) {
            color = mix(color, vec3f(1.0), (spark - 0.88) / 0.12);
        }
    } else if (st == 3u) {
        let coalBase = fg * 0.70;
        let ticks = stageTicks(f);

        let crack1 = ((i32((local.x + 0.5) * 8.0) * 3 + i32((local.y + 0.5) * 8.0) * 5 + i32(cellHash(f) * 13.0)) % 4) == 0;
        let crack2 = ((i32((local.x + 0.5) * 8.0) * 7 + i32((local.y + 0.5) * 8.0) * 2) % 5) == 0;
        let isCrack = crack1 || crack2;

        if (isCrack && ticks < 5u) {
            let fade = (5.0 - f32(ticks)) / 5.0;
            let crackGlow = mix(u.neon, u.accent, 0.6);
            color = mix(coalBase, crackGlow, fade * 0.95);
        } else {
            let n = hash2(vec2f(p.x * 4.0, p.y * 4.0));
            color = coalBase * (0.80 + 0.35 * n);
        }

        if (distFromCenter > 0.44) {
            color = color * 0.75;
        }
    } else if (st == 4u) {
        let t = clamp(f32(stageTicks(f)) / 3.0, 0.0, 1.0);
        let ashColor = mix(fg * 0.70, bg, 0.65);
        color = mix(ashColor, bg, smoothstep(0.10, 0.85, t));
    } else {
        if (cellDark) {
            color = fg;

            let upCell = cell(c + vec2i(0, -1));
            let downCell = cell(c + vec2i(0, 1));
            let leftCell = cell(c + vec2i(-1, 0));
            let rightCell = cell(c + vec2i(1, 0));
            let nearFire = (stage(upCell) == 2u) || (stage(downCell) == 2u) || (stage(leftCell) == 2u) || (stage(rightCell) == 2u);

            if (nearFire && distFromCenter > 0.36) {
                let heatSpill = (distFromCenter - 0.36) / 0.14;
                color = mix(color, u.neon, heatSpill * 0.60);
            } else if (distFromCenter > 0.46) {
                color = mix(fg, bg, 0.05);
            }
        } else {
            color = bg;
            if (distFromCenter > 0.46) {
                color = mix(bg, fg, 0.04);
            }
        }
    }

    if (st == 0u || st == 3u || st == 4u) {
        if (distFromCenter < 0.35) {
            color = clampLuma(color, !cellDark);
        }
    }

    return vec4f(color, 1.0);
}

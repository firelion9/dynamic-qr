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
        return 0u;
    }
    return grid[c.y * n + c.x];
}

fn isDark(f: u32) -> bool { return (f & 1u) != 0u; }
fn shownDark(f: u32) -> bool { return isDark(f) != (u.inverted > 0.5); }
fn isReserved(f: u32) -> bool { return (f & 2u) != 0u; }
fn isWater(f: u32) -> bool { return (f & 4u) != 0u; }

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
    let dist = max(abs(local.x), abs(local.y));

    let dark = shownDark(f);
    let water = isWater(f);

    let edge = smoothstep(0.48, 0.44, dist);
    let bg = select(u.light, u.dark, u.inverted > 0.5);
    let fg = select(u.dark, u.light, u.inverted > 0.5);
    var color: vec3f;

    if (dark) {
        color = mix(bg, fg, edge);
    } else if (water) {
        let waterColor = clampLuma(u.neon, u.inverted < 0.5);
        color = mix(bg, waterColor, edge);
    } else {
        color = bg;
    }

    return vec4f(color, 1.0);
}

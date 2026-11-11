struct Uniforms {
    time: f32,
    size: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

const DARK = 0.28;
const LIGHT = 0.72;
const SNAKE = array<vec3f, 4>(
    vec3f(0.05, 0.45, 0.16),
    vec3f(0.06, 0.24, 0.66),
    vec3f(0.45, 0.12, 0.58),
    vec3f(0.62, 0.26, 0.02),
);
const APPLE = array<u32, 7>(0x08u, 0x3eu, 0x7fu, 0x7fu, 0x7fu, 0x3eu, 0x1cu);

@vertex
fn vertShader(@builtin(vertex_index) i: u32) -> VertexOutput {
    let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
    var out: VertexOutput;
    out.position = vec4f(p, 0.0, 1.0);
    out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return out;
}

fn cell(c: vec2i) -> u32 {
    let n = i32(uniforms.size);
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) { return 10u; }
    return grid[c.y * n + c.x];
}

fn sprite(f: u32) -> u32 { return (f >> 4u) & 15u; }
fn index(f: u32) -> u32 { return (f >> 8u) & 255u; }
fn dir(f: u32) -> u32 { return (f >> 16u) & 3u; }
fn snake(f: u32) -> u32 { return (f >> 18u) & 3u; }
fn isSnake(f: u32) -> bool { return sprite(f) >= 1u && sprite(f) <= 4u; }

fn luma(c: vec3f) -> f32 {
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn clampLuma(c: vec3f, dark: bool, low: f32, high: f32) -> vec3f {
    let l = luma(c);
    if (dark) { return c * min(1.0, low / max(l, 1e-4)); }
    return mix(c, vec3f(1.0), max(0.0, (high - l) / (1.0 - l)));
}

fn readable(c: vec3f, p: vec2f) -> vec3f {
    let local = abs(fract(p) - 0.5);
    let dark = (cell(vec2i(floor(p))) & 1u) == 1u;
    let core = clampLuma(c, dark, DARK, LIGHT);
    let edge = clampLuma(c, dark, 0.42, 0.58);
    return mix(core, edge, smoothstep(0.3, 0.45, max(local.x, local.y)));
}

fn linked(f: u32, c: vec2i) -> bool {
    let g = cell(c);
    return isSnake(g) && snake(g) == snake(f) && (index(f) + 1u == index(g) || index(g) + 1u == index(f));
}

fn forward(s: vec2i, d: u32) -> vec2i {
    if (d == 0u) { return vec2i(s.y, s.x); }
    if (d == 1u) { return vec2i(6 - s.y, 6 - s.x); }
    if (d == 2u) { return vec2i(s.x, 6 - s.y); }
    return vec2i(6 - s.x, s.y);
}

fn apple(s: vec2i, detailed: bool) -> vec4f {
    let red = vec3f(0.8, 0.06, 0.08) * (0.9 + 0.1 * sin(uniforms.time * 6.0));
    if (!detailed) { return vec4f(red, 0.0); }
    if (s.y == 0 && s.x == 4) { return vec4f(0.15, 0.55, 0.1, 1.0); }
    if (s.y == 0 && s.x == 3) { return vec4f(0.35, 0.2, 0.05, 0.0); }
    if (s.y == 2 && s.x == 2) { return vec4f(1.0, 0.75, 0.75, 1.0); }
    if (((APPLE[s.y] >> u32(6 - s.x)) & 1u) == 1u) { return vec4f(red, 0.0); }
    return vec4f(0.06, 0.06, 0.09, 0.0);
}

fn body(f: u32, c: vec2i, s: vec2i, detailed: bool) -> vec4f {
    var col = SNAKE[snake(f)];
    if (index(f) % 2u == 1u) { col *= 0.82; }
    if (index(f) == 0u) { col *= 0.8; }
    if (sprite(f) == 2u || sprite(f) == 4u) { col = mix(col * 1.6, vec3f(1.0), 0.62); }
    if (!detailed) { return vec4f(col, 0.0); }

    let outline = col * 0.55;
    if (s.y == 0 && !linked(f, c + vec2i(0, -1))) { col = outline; }
    if (s.y == 6 && !linked(f, c + vec2i(0, 1))) { col = outline; }
    if (s.x == 0 && !linked(f, c + vec2i(-1, 0))) { col = outline; }
    if (s.x == 6 && !linked(f, c + vec2i(1, 0))) { col = outline; }
    if (s.x == 1 && s.y == 1) { col = mix(col, vec3f(1.0), 0.25); }
    if (index(f) != 0u) { return vec4f(col, 0.0); }

    let q = forward(s, dir(f));
    if ((q.x == 1 || q.x == 2) && (q.y == 1 || q.y == 2 || q.y == 4 || q.y == 5)) {
        let pupil = q.x == 1 && (q.y == 2 || q.y == 4);
        return vec4f(select(vec3f(1.0), vec3f(0.02), pupil), 1.0);
    }
    if (q.x == 0 && q.y == 3 && sin(uniforms.time * 9.0) > 0.3) { return vec4f(0.9, 0.1, 0.2, 1.0); }
    return vec4f(col, 0.0);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * uniforms.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let s = vec2i(floor(fract(p) * 7.0));
    let detailed = fwidth(p.x) < 1.0 / 6.0;

    var col = vec4f(select(vec3f(0.98, 0.98, 0.97), vec3f(0.06, 0.06, 0.09), (f & 1u) == 1u), 0.0);
    if (sprite(f) == 5u) { col = apple(s, detailed); }
    if (isSnake(f)) { col = body(f, c, s, detailed); }
    return vec4f(mix(readable(col.rgb, p), col.rgb, col.a), 1.0);
}

struct Uniforms {
    time: f32,
    size: f32,
    power: f32,
    death: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

const DARK = 0.28;
const LIGHT = 0.72;
const BG = vec3f(0.01, 0.01, 0.035);
const NEON = vec3f(0.1, 0.25, 1.0);
const TUBE = vec3f(0.5, 0.74, 1.0);
const CORE = vec3f(0.9, 0.96, 1.0);
const FILL = vec3f(0.7, 0.77, 0.97);
const PELLET = vec3f(1.0, 0.5, 0.15);
const ORB = vec3f(1.0, 0.35, 0.75);
const HERO = vec3f(0.6, 1.0, 0.1);
const OUTLINE = vec3f(0.04, 0.3, 0.04);
const GOLD = vec3f(1.0, 0.85, 0.25);
const SCARED = vec3f(0.18, 0.22, 0.75);
const GHOSTS = array<vec3f, 3>(vec3f(1.0, 0.08, 0.12), vec3f(1.0, 0.1, 0.6), vec3f(0.6, 0.15, 1.0));

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
    let k = clamp(c, vec2i(0), vec2i(n - 1));
    return grid[k.y * n + k.x];
}

fn bright(f: u32) -> bool { return (f & 1u) != 0u; }
fn lit(f: u32) -> bool { return (f & 4u) != 0u; }
fn open(f: u32) -> bool { return !bright(f) || lit(f); }
fn actor(f: u32) -> u32 { return (f >> 8u) & 7u; }
fn dir(f: u32) -> u32 { return (f >> 11u) & 3u; }
fn mood(f: u32) -> u32 { return (f >> 13u) & 3u; }

fn hash(p: vec3f) -> f32 {
    return fract(sin(dot(p, vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
}

fn luma(c: vec3f) -> f32 {
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn clampLuma(c: vec3f, light: bool, low: f32, high: f32) -> vec3f {
    let l = luma(c);
    if (!light) { return c * min(1.0, low / max(l, 1e-4)); }
    return mix(c, vec3f(1.0), max(0.0, (high - l) / (1.0 - l)));
}

fn readable(c: vec3f, p: vec2f, light: bool) -> vec3f {
    let local = abs(fract(p) - 0.5);
    let core = clampLuma(c, light, DARK, LIGHT);
    let edge = clampLuma(c, light, 0.42, 0.58);
    return mix(core, edge, smoothstep(0.3, 0.45, max(local.x, local.y)));
}

fn forward(s: vec2i, d: u32) -> vec2i {
    if (d == 0u) { return vec2i(s.y, s.x); }
    if (d == 1u) { return vec2i(6 - s.y, 6 - s.x); }
    if (d == 2u) { return vec2i(s.x, 6 - s.y); }
    return vec2i(6 - s.x, s.y);
}

fn wall(c: vec2i, s: vec2i, detailed: bool) -> vec4f {
    if (!detailed) { return vec4f(TUBE, 0.0); }
    let up = open(cell(c + vec2i(0, -1)));
    let down = open(cell(c + vec2i(0, 1)));
    let left = open(cell(c + vec2i(-1, 0)));
    let right = open(cell(c + vec2i(1, 0)));
    if ((up && left && s.x + s.y == 0) || (up && right && s.y == 0 && s.x == 6) ||
        (down && left && s.y == 6 && s.x == 0) || (down && right && s.x + s.y == 12)) {
        return vec4f(BG, 1.0);
    }

    var d = 9;
    if (up) { d = min(d, s.y); }
    if (down) { d = min(d, 6 - s.y); }
    if (left) { d = min(d, s.x); }
    if (right) { d = min(d, 6 - s.x); }
    if (open(cell(c + vec2i(-1, -1)))) { d = min(d, max(s.x, s.y)); }
    if (open(cell(c + vec2i(1, -1)))) { d = min(d, max(6 - s.x, s.y)); }
    if (open(cell(c + vec2i(-1, 1)))) { d = min(d, max(s.x, 6 - s.y)); }
    if (open(cell(c + vec2i(1, 1)))) { d = min(d, max(6 - s.x, 6 - s.y)); }

    if (d == 1) { return vec4f(CORE, 0.0); }
    if (d <= 2) { return vec4f(TUBE, 0.0); }
    return vec4f(FILL, 0.0);
}

fn ground(c: vec2i, s: vec2i, f: u32, detailed: bool) -> vec3f {
    if (!detailed) { return BG; }
    if ((s.y == 0 && !open(cell(c + vec2i(0, -1)))) || (s.y == 6 && !open(cell(c + vec2i(0, 1)))) ||
        (s.x == 0 && !open(cell(c + vec2i(-1, 0)))) || (s.x == 6 && !open(cell(c + vec2i(1, 0))))) {
        return NEON;
    }
    let m = abs(s - vec2i(3));
    if ((f & 16u) != 0u && m.x + m.y == 1) {
        return PELLET * (0.8 + 0.2 * sin(u.time * 3.0 + f32(c.x + c.y)));
    }
    return BG;
}

fn orb(s: vec2i, f: u32, detailed: bool) -> vec4f {
    if (!detailed) { return vec4f(select(ORB * 0.3, ORB, lit(f)), 0.0); }
    let r = length(vec2f(s) - 3.0);
    let pulse = 2.2 + 0.6 * sin(u.time * 6.0);
    if (r < pulse * 0.5) { return vec4f(mix(ORB, vec3f(1.0), 0.6), 0.0); }
    if (r < pulse) { return vec4f(ORB, 0.0); }
    return vec4f(BG, select(0.0, 1.0, lit(f)));
}

fn circle(s: vec2i) -> bool {
    let d = s - vec2i(3);
    return d.x * d.x + d.y * d.y <= 10;
}

fn edge(s: vec2i) -> bool {
    return !circle(s + vec2i(1, 0)) || !circle(s - vec2i(1, 0)) || !circle(s + vec2i(0, 1)) || !circle(s - vec2i(0, 1));
}

fn hero(s: vec2i, f: u32, detailed: bool) -> vec4f {
    var col = HERO;
    if (mood(f) == 1u) { col = mix(HERO, GOLD, 0.5 + 0.5 * sin(u.time * 18.0)); }
    if (mood(f) == 2u) {
        col = mix(vec3f(1.0, 0.2, 0.2), HERO, u.death);
        if (hash(vec3f(vec2f(s), 1.0)) > u.death) { return vec4f(BG, select(0.0, 1.0, lit(f))); }
    }
    if (!detailed) { return vec4f(col, 0.0); }

    let q = forward(s, dir(f));
    if (!circle(q)) { return vec4f(BG, select(0.0, 1.0, lit(f))); }
    let gap = select(1, 2, sin(u.time * 14.0) > 0.0);
    if (q.x <= gap && q.y >= 2 && q.y <= 4) {
        if (q.x == 0 && q.y != 3) { return vec4f(1.0, 1.0, 1.0, 1.0); }
        return vec4f(0.35, 0.02, 0.08, 1.0);
    }
    if (q.x == 3 && (q.y == 1 || q.y == 5)) { return vec4f(0.02, 0.02, 0.05, 1.0); }
    if (q.x == 4 && (q.y == 1 || q.y == 5)) { return vec4f(1.0, 1.0, 1.0, 1.0); }
    if (edge(q)) { return vec4f(OUTLINE, 1.0); }
    if (q.x == 2 && q.y == 2) { return vec4f(mix(col, vec3f(1.0), 0.6), 0.0); }
    return vec4f(col, 0.0);
}

fn ghost(s: vec2i, f: u32, c: vec2i, detailed: bool) -> vec4f {
    let scared = mood(f) == 1u;
    var col = GHOSTS[actor(f) - 2u];
    if (scared) {
        col = SCARED;
        if (u.power < 0.25 && sin(u.time * 20.0) > 0.0) { col = vec3f(0.9, 0.92, 1.0); }
    }
    if (!detailed) { return vec4f(col, 0.0); }

    let glitch = floor(u.time * 10.0);
    if ((s.y == 0 && (s.x == 0 || s.x == 6)) || (s.y == 6 && ((s.x + i32(glitch)) % 2 == 0))) { return vec4f(BG, 0.0); }
    if (hash(vec3f(vec2f(c * 7 + s), glitch)) < 0.06) { return vec4f(BG, 0.0); }

    if (scared) {
        if (s.y == 2 && (s.x == 2 || s.x == 4)) { return vec4f(1.0, 1.0, 1.0, 1.0); }
        if (s.y == 4 + (s.x % 2) && s.x >= 1 && s.x <= 5) { return vec4f(1.0, 1.0, 1.0, 1.0); }
        return vec4f(col, 0.0);
    }

    let ex = select(4, 1, s.x < 3);
    if (s.y >= 2 && s.y <= 3 && (s.x - ex == 0 || s.x - ex == 1)) {
        let look = array<vec2i, 4>(vec2i(0, 0), vec2i(1, 1), vec2i(0, 1), vec2i(1, 0))[dir(f)];
        if (s.x - ex == look.x && s.y - 2 == look.y) { return vec4f(0.02, 0.02, 0.1, 1.0); }
        return vec4f(1.0, 1.0, 1.0, 1.0);
    }
    if (s.x == 0) { return vec4f(col.bgr, 0.0); }
    return vec4f(col, 0.0);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let s = vec2i(floor(fract(p) * 7.0));
    let detailed = fwidth(p.x) < 1.0 / 6.0;

    var col: vec4f;
    if (actor(f) == 1u) {
        col = hero(s, f, detailed);
    } else if (actor(f) >= 2u) {
        col = ghost(s, f, c, detailed);
    } else if ((f & 32u) != 0u) {
        col = orb(s, f, detailed);
    } else if (open(f)) {
        col = vec4f(ground(c, s, f, detailed), 0.0);
    } else {
        col = wall(c, s, detailed);
    }
    return vec4f(mix(readable(col.rgb, p, bright(f)), col.rgb, col.a), 1.0);
}

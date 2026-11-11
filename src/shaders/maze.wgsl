struct Uniforms {
    time: f32,
    size: f32,
    power: f32,
    death: f32,
    neon: vec3f,
    accent: vec3f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

const PELLET = vec3f(1.0, 0.5, 0.15);
const ORB = vec3f(1.0, 0.35, 0.75);
const GOLD = vec3f(1.0, 0.85, 0.25);
const SCARED = vec3f(0.18, 0.22, 0.75);
const GHOSTS = array<vec3f, 3>(vec3f(1.0, 0.08, 0.12), vec3f(1.0, 0.1, 0.6), vec3f(0.6, 0.15, 1.0));

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

fn tile(c: vec2i, s: vec2i, f: u32, detailed: bool) -> vec3f {
    let m = abs(s - vec2i(3));
    if (detailed && (f & 16u) != 0u && m.x + m.y == 1) {
        return PELLET * (0.8 + 0.2 * sin(u.time * 3.0 + f32(c.x + c.y)));
    }
    return ground(c, s, detailed);
}

fn orb(s: vec2i, f: u32, detailed: bool) -> vec4f {
    if (!detailed) { return vec4f(select(ORB * 0.3, ORB, lit(f)), 0.0); }
    let r = length(vec2f(s) - 3.0);
    let pulse = 2.2 + 0.6 * sin(u.time * 6.0);
    if (r < pulse * 0.5) { return vec4f(mix(ORB, vec3f(1.0), 0.6), 0.0); }
    if (r < pulse) { return vec4f(ORB, 0.0); }
    return vec4f(background(), select(0.0, 1.0, lit(f)));
}

fn circle(s: vec2i) -> bool {
    let d = s - vec2i(3);
    return d.x * d.x + d.y * d.y <= 10;
}

fn edge(s: vec2i) -> bool {
    return !circle(s + vec2i(1, 0)) || !circle(s - vec2i(1, 0)) || !circle(s + vec2i(0, 1)) || !circle(s - vec2i(0, 1));
}

fn hero(s: vec2i, f: u32, detailed: bool) -> vec4f {
    var col = u.accent;
    if (mood(f) == 1u) { col = mix(u.accent, GOLD, 0.5 + 0.5 * sin(u.time * 18.0)); }
    if (mood(f) == 2u) {
        col = mix(vec3f(1.0, 0.2, 0.2), u.accent, u.death);
        if (hash(vec3f(vec2f(s), 1.0)) > u.death) { return vec4f(background(), select(0.0, 1.0, lit(f))); }
    }
    if (!detailed) { return vec4f(col, 0.0); }

    let q = forward(s, dir(f));
    if (!circle(q)) { return vec4f(background(), select(0.0, 1.0, lit(f))); }
    let gap = select(1, 2, sin(u.time * 14.0) > 0.0);
    if (q.x <= gap && q.y >= 2 && q.y <= 4) {
        if (q.x == 0 && q.y != 3) { return vec4f(1.0, 1.0, 1.0, 1.0); }
        return vec4f(0.35, 0.02, 0.08, 1.0);
    }
    if (q.x == 3 && (q.y == 1 || q.y == 5)) { return vec4f(0.02, 0.02, 0.05, 1.0); }
    if (q.x == 4 && (q.y == 1 || q.y == 5)) { return vec4f(1.0, 1.0, 1.0, 1.0); }
    if (edge(q)) { return vec4f(u.accent * 0.3, 1.0); }
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
    if ((s.y == 0 && (s.x == 0 || s.x == 6)) || (s.y == 6 && ((s.x + i32(glitch)) % 2 == 0))) { return vec4f(background(), 0.0); }
    if (hash(vec3f(vec2f(c * 7 + s), glitch)) < 0.06) { return vec4f(background(), 0.0); }

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
        col = vec4f(tile(c, s, f, detailed), 0.0);
    } else {
        col = wall(c, s, detailed);
    }
    return vec4f(mix(readable(col.rgb, p, bright(f)), col.rgb, col.a), 1.0);
}

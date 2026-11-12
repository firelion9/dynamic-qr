struct Uniforms {
    time: f32,
    size: f32,
    inverted: f32,
    neon: vec3f,
    accent: vec3f,
    dark: vec3f,
    light: vec3f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

const SNAKE = array<vec3f, 4>(
    vec3f(0.0),
    vec3f(1.0, 0.45, 0.1),
    vec3f(0.75, 0.2, 1.0),
    vec3f(0.1, 0.9, 1.0),
);
const APPLE = array<u32, 7>(0x08u, 0x3eu, 0x7fu, 0x7fu, 0x7fu, 0x3eu, 0x1cu);

fn cell(c: vec2i) -> u32 {
    let n = i32(u.size);
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) { return 10u; }
    return grid[c.y * n + c.x];
}

fn sprite(f: u32) -> u32 { return (f >> 4u) & 15u; }
fn index(f: u32) -> u32 { return (f >> 8u) & 255u; }
fn dir(f: u32) -> u32 { return (f >> 16u) & 3u; }
fn snake(f: u32) -> u32 { return (f >> 18u) & 3u; }
fn isSnake(f: u32) -> bool { return sprite(f) >= 1u && sprite(f) <= 4u; }
fn dark(f: u32) -> bool { return (f & 1u) != 0u; }
fn shownDark(f: u32) -> bool { return dark(f) != (u.inverted > 0.5); }
fn open(f: u32) -> bool { return shownDark(f) || sprite(f) != 0u; }

fn linked(f: u32, c: vec2i) -> bool {
    let g = cell(c);
    return isSnake(g) && snake(g) == snake(f) && (index(f) + 1u == index(g) || index(g) + 1u == index(f));
}

fn apple(s: vec2i, detailed: bool) -> vec4f {
    let red = vec3f(0.8, 0.06, 0.08) * (0.9 + 0.1 * sin(u.time * 6.0));
    if (!detailed) { return vec4f(red, 0.0); }
    if (s.y == 0 && s.x == 4) { return vec4f(0.15, 0.55, 0.1, 1.0); }
    if (s.y == 0 && s.x == 3) { return vec4f(0.35, 0.2, 0.05, 0.0); }
    if (s.y == 2 && s.x == 2) { return vec4f(1.0, 0.75, 0.75, 1.0); }
    if (((APPLE[s.y] >> u32(6 - s.x)) & 1u) == 1u) { return vec4f(red, 0.0); }
    return vec4f(0.06, 0.06, 0.09, 0.0);
}

fn body(f: u32, c: vec2i, s: vec2i, detailed: bool) -> vec4f {
    var col = select(SNAKE[snake(f)], u.accent, snake(f) == 0u);
    if (index(f) % 2u == 1u) { col *= 0.82; }
    if (index(f) == 0u) { col *= 0.8; }
    if (!shownDark(f)) { col = mix(col * 1.6, vec3f(1.0), 0.62); }
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
    if (q.x == 0 && q.y == 3 && sin(u.time * 9.0) > 0.3) { return vec4f(0.9, 0.1, 0.2, 1.0); }
    return vec4f(col, 0.0);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let s = vec2i(floor(fract(p) * 7.0));
    let detailed = fwidth(p.x) < 1.0 / 6.0;

    var col = vec4f(ground(c, s, detailed), 0.0);
    if (!open(f)) { col = wall(c, s, detailed); }
    if (sprite(f) == 5u) { col = apple(s, detailed); }
    if (isSnake(f)) { col = body(f, c, s, detailed); }
    return vec4f(mix(readable(col.rgb, p, !shownDark(f)), col.rgb, col.a), 1.0);
}

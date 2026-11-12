struct Uniforms {
    time: f32,
    size: f32,
    inverted: f32,
    textLength: f32,
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
@group(0) @binding(2) var<storage, read> glyphs: array<u32>;

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

fn trainForward(s: vec2i, d: u32) -> vec2i {
    if (d == 0u) { return vec2i(s.y, s.x); }
    if (d == 1u) { return vec2i(23 - s.y, 23 - s.x); }
    if (d == 2u) { return vec2i(s.x, 23 - s.y); }
    return vec2i(23 - s.x, s.y);
}

fn station(s: vec2i) -> vec4f {
    let col = u.accent;
    if (s.x >= 7 && s.x <= 16 && s.y >= 7 && s.y <= 16) {
        return vec4f(col, 1.0);
    }
    return vec4f(select(u.dark, u.light, u.inverted > 0.5), 1.0);
}

fn locomotive(f: u32, c: vec2i, s: vec2i) -> vec4f {
    let col = u.neon;

    if (s.x == 0 || s.x == 23 || s.y == 0 || s.y == 23) {
        return vec4f(select(u.dark, u.light, u.inverted > 0.5), 1.0);
    }

    let q = trainForward(s, dir(f));
    if (q.x >= 1 && q.x <= 3 && q.y >= 8 && q.y <= 15) {
        return vec4f(select(u.light, u.dark, u.inverted > 0.5), 1.0);
    }
    return vec4f(col, 1.0);
}

fn carriage(f: u32, c: vec2i, s: vec2i) -> vec4f {
    let col = u.neon;

    if (s.x == 0 || s.x == 23 || s.y == 0 || s.y == 23) {
        return vec4f(select(u.dark, u.light, u.inverted > 0.5), 1.0);
    }

    let numChars = max(1u, u32(u.textLength));
    let cycle = numChars + 1u;
    let idx = index(f);
    let part = (idx - 1u) % cycle;

    if (part < numChars && s.y >= 0 && s.y < 24) {
        let rowBits = glyphs[part * 24u + u32(s.y)];
        if (((rowBits >> u32(23 - s.x)) & 1u) == 1u) {
            return vec4f(select(u.light, u.dark, u.inverted > 0.5), 1.0);
        }
    }

    return vec4f(col, 1.0);
}

fn body(f: u32, c: vec2i, s: vec2i) -> vec4f {
    if (index(f) == 0u) {
        return locomotive(f, c, s);
    }
    return carriage(f, c, s);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let s = vec2i(floor(fract(p) * 24.0));

    var col = select(vec4f(u.light, 1.0), vec4f(u.dark, 1.0), shownDark(f));
    if (sprite(f) == 5u) { col = station(s); }
    if (isSnake(f)) { col = body(f, c, s); }
    return col;
}

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

const MATRIX_DARK = 0.16;
const MATRIX_LIGHT = 0.8;
const DIGITS = array<u32, 10>(0x7b6fu, 0x2c97u, 0x73e7u, 0x73cfu, 0x5bc9u, 0x79cfu, 0x79efu, 0x7249u, 0x7befu, 0x7bcfu);

fn cell(c: vec2i) -> u32 {
    let n = i32(u.size);
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) { return 10u; }
    return grid[c.y * n + c.x];
}

fn shownDark(f: u32) -> bool { return ((f & 1u) != 0u) != (u.inverted > 0.5); }
fn open(f: u32) -> bool { return shownDark(f); }

// Falling stream over one column: 1 at the head, fading to 0 along the tail.
fn stream(column: f32, y: f32, k: f32) -> f32 {
    let speed = 3.0 + 7.0 * hash(vec3f(column, k, 1.0));
    let len = 6.0 + 14.0 * hash(vec3f(column, k, 2.0));
    let period = u.size + len + 12.0 * hash(vec3f(column, k, 3.0));
    let head = fract(u.time * speed / period + hash(vec3f(column, k, 4.0))) * period;
    let d = head - y;
    if (d < 0.0 || d > len) { return 0.0; }
    return 1.0 - d / len;
}

fn rain(column: f32, y: f32) -> f32 {
    return max(stream(column, y, 0.0), stream(column, y, 1.0));
}

fn digit(c: vec2i, s: vec2i, rate: f32) -> bool {
    if (s.x < 2 || s.x > 4 || s.y < 1 || s.y > 5) { return false; }
    let id = u32(hash(vec3f(vec2f(c), floor(u.time * rate + hash(vec3f(vec2f(c), 9.0))))) * 10.0) % 10u;
    let bit = u32((4 - (s.y - 1)) * 3 + (2 - (s.x - 2)));
    return ((DIGITS[id] >> bit) & 1u) == 1u;
}

fn tint(intensity: f32) -> vec3f {
    return mix(u.neon, u.accent, smoothstep(0.85, 1.0, intensity)) * (0.35 + 0.65 * intensity);
}

// Every dark module shows a dim digit that slowly changes; falling streams light whole columns.
// Bright pixels near the centre of a dark module confuse scanners, so a stream lights the
// whole tile and the digit is cut out of it in a darker shade.
fn code(c: vec2i, s: vec2i, f: u32, detailed: bool) -> vec3f {
    let intensity = rain(f32(c.x), f32(c.y));
    let dark = shownDark(f);
    let level = select(intensity, max(intensity, 0.3), dark);
    if (level <= 0.0) { return u.light; }

    let stroke = detailed && digit(c, s, select(6.0, 1.5, intensity == 0.0));
    if (dark) {
        let tile = tint(level);
        return select(tile, tile * 0.25, stroke);
    }
    let lit = mix(u.light, u.neon, 0.35 * level);
    return select(lit, mix(lit, vec3f(1.0), level), stroke);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let s = vec2i(floor(fract(p) * 7.0));
    let detailed = fwidth(p.x) < 1.0 / 6.0;

    // Rain covers whole tiles, so modules get stricter caps than single sprites elsewhere.
    let col = clampLuma(code(c, s, f, detailed), !shownDark(f), MATRIX_DARK, MATRIX_LIGHT);
    return vec4f(readable(col, p, !shownDark(f)), 1.0);
}

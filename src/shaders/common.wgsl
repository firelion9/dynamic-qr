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


// Scanners read module centres, so the core keeps a strict light/dark luma and edges get some slack.
fn readable(c: vec3f, p: vec2f, light: bool) -> vec3f {
    let local = abs(fract(p) - 0.5);
    let core = clampLuma(c, light, DARK, LIGHT);
    let edge = clampLuma(c, light, 0.42, 0.58);
    return mix(core, edge, smoothstep(0.3, 0.45, max(local.x, local.y)));
}

fn hash(p: vec3f) -> f32 {
    return fract(sin(dot(p, vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
}

fn forward(s: vec2i, d: u32) -> vec2i {
    if (d == 0u) { return vec2i(s.y, s.x); }
    if (d == 1u) { return vec2i(6 - s.y, 6 - s.x); }
    if (d == 2u) { return vec2i(s.x, 6 - s.y); }
    return vec2i(6 - s.x, s.y);
}

fn background() -> vec3f {
    return u.dark;
}

fn ground(c: vec2i, s: vec2i, detailed: bool) -> vec3f {
    if (detailed && ((s.y == 0 && !open(cell(c + vec2i(0, -1)))) || (s.y == 6 && !open(cell(c + vec2i(0, 1)))) ||
        (s.x == 0 && !open(cell(c + vec2i(-1, 0)))) || (s.x == 6 && !open(cell(c + vec2i(1, 0)))))) {
        return u.neon;
    }
    return background();
}

fn wall(c: vec2i, s: vec2i, detailed: bool) -> vec4f {
    let tube = mix(u.neon, u.light, 0.8);
    let fill = u.light;
    if (!detailed) { return vec4f(fill, 0.0); }
    let up = open(cell(c + vec2i(0, -1)));
    let down = open(cell(c + vec2i(0, 1)));
    let left = open(cell(c + vec2i(-1, 0)));
    let right = open(cell(c + vec2i(1, 0)));
    if ((up && left && s.x + s.y == 0) || (up && right && s.y == 0 && s.x == 6) ||
        (down && left && s.y == 6 && s.x == 0) || (down && right && s.x + s.y == 12)) {
        return vec4f(background(), 1.0);
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

    if (d == 1) { return vec4f(mix(u.light, vec3f(1.0), 0.67), 0.0); }
    if (d <= 2) { return vec4f(tube, 0.0); }
    return vec4f(fill, 0.0);
}

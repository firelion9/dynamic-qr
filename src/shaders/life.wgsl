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

fn isDark(f: u32) -> bool {
    return (f & 1u) != 0u;
}

fn shownDark(f: u32) -> bool {
    return isDark(f) != (u.inverted > 0.5);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);

    let dark = shownDark(f);
    let col = select(u.light, u.dark, dark);
    return vec4f(col, 1.0);
}

struct Uniforms {
    time: f32,
    seed: f32,
    size: f32,
    inverted: f32,
    dark: vec3f,
    light: vec3f,
    neon: vec3f,
    accent: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;


struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) qrPosition: vec2<u32>,
    @location(2) flags: u32,
};
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
};

fn rand(point: vec2<f32>, time: f32, salt: f32) -> f32 {
    return fract(sin(dot(vec3<f32>(point, salt), vec3<f32>(42.4242, 1337.4242, 3301.1999))) * 1453.32143 + time * 67.6767);
}

@vertex
fn vertShader(input: VertexInput) -> VertexOutput {
    let shouldFlip = (input.flags & 2) == 0 && rand(vec2<f32>(input.qrPosition), sin(uniforms.time * 0.0001), uniforms.seed) < 0.007;
    var out: VertexOutput;
    out.position = vec4f(input.position.x * 2 - 1, 1 - input.position.y * 2, 0.0, 1.0);
    let darkSlot = ((input.flags & 1) == 1) != shouldFlip;
    out.color = select(uniforms.light, uniforms.dark, darkSlot);
    if (shouldFlip) { out.color = keepSide(uniforms.accent, darkSlot != (uniforms.inverted > 0.5)); }
    return out;
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    return vec4f(in.color, 1.0);
}

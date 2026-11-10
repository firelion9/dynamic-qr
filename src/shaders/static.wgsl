struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) qrPosition: vec2<u32>,
    @location(2) flags: u32,
};
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
};

@vertex
fn vertShader(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(input.position.x * 2 - 1, 1 - input.position.y * 2, 0.0, 1.0);
    if ((input.flags & 1) == 1) { out.color = vec3f(0.0, 0.0, 0.0); }
    else { out.color = vec3f(1.0, 1.0, 1.0); }
    return out;
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    return vec4f(in.color, 1.0);
}

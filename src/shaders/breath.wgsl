struct Uniforms {
    time: f32,
    seed: f32,
    size: f32,
    reserved: f32,
    dark: vec3f,
    light: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;


struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) qrPosition: vec2<u32>,
    @location(2) flags: u32,
};
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) primary: vec3<f32>,
    @location(1) secondary: vec3<f32>,
    @location(2) center: vec2<f32>,
    @location(3) pos: vec2<f32>,
    @interpolate(flat) @location(4) flags: u32,
};

fn rand(point: vec2<f32>, time: f32, salt: f32) -> f32 {
    let x = fract(sin(dot(vec3<f32>(point, salt), vec3<f32>(42.4242, 1337.4242, 3301.1999))) * 1453.32143 + time * 67.6767);
    return abs(x - 0.5) * 2;
}

@vertex
fn vertShader(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4<f32>(input.position.x * 2 - 1, 1 - input.position.y * 2, 0.0, 1.0);
    out.pos = vec2<f32>(input.position.x * 2 - 1, 1 - input.position.y * 2);
    if (((input.flags & 1) == 1)) { 
        out.primary = uniforms.dark; 
        out.secondary = uniforms.light;
    } else { 
        out.primary = uniforms.light;
        out.secondary = uniforms.light; 
    }
    out.center = (vec2<f32>(input.qrPosition) + 0.5) / uniforms.size * vec2<f32>(2, -2) + vec2<f32>(-1, 1);
    out.flags = input.flags;
    return out;
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    var p = 0.3;
    var q = 0.75;
    if ((in.flags & 2) == 0) {
        p = rand(in.center, uniforms.time * 0.01, uniforms.seed) * 0.25;
        q = rand(in.center, 0.0, uniforms.seed + 100) * 0.75;
    }

    let dir = (in.pos.xy - in.center.xy) * uniforms.size;
    let s = 1.25 + q;
    let dst = pow(dot(pow(abs(dir), vec2f(s, s)), vec2f(1, 1)), 1 / s);
    var alpha: f32 = smoothstep(0.5, 1.1, dst - p);
    return vec4f(mix(in.primary, in.secondary, vec3<f32>(alpha, alpha, alpha)), 1.0);
}

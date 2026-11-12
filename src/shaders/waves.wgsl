struct Uniforms {
    time: f32,
    seed: f32,
    size: f32,
    inverted: f32,
    dark: vec3f,
    light: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

const N_COLORS: u32 = 4;
struct Colors {
    waves: array<vec3f, N_COLORS>
};
@group(1) @binding(0) var<uniform> colors: Colors;

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) qrPosition: vec2<u32>,
    @location(2) flags: u32,
};
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) primary: vec3<f32>,
    @location(3) pos: vec2<f32>,
    @location(4) @interpolate(flat) flags: u32,
};

const PERIOD = 3.5;
const PI = 3.14159265;

fn rand(point: vec2<f32>, time: f32, salt: f32) -> f32 {
    let x = fract(sin(dot(vec3<f32>(point, salt), vec3<f32>(42.4242, 1337.4242, 3301.1999))) * 1453.32143 + time * 67.6767);
    return abs(x - 0.5) * 2;
}

fn randOffset(point: vec2<f32>, time: f32, salt: f32) -> f32 {
    return rand(point, time, salt) * 2 - 1;
}

@vertex
fn vertShader(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4<f32>(input.position.x * 2 - 1, 1 - input.position.y * 2, 0.0, 1.0);
    out.pos = vec2<f32>(input.position.x * 2 - 1, 1 - input.position.y * 2);
    if (((input.flags & 1) == 1)) { 
        out.primary = uniforms.dark; 
    } else {
        out.primary = uniforms.light;
    }
    out.flags = input.flags;
    return out;
}

fn waveCenter(idx: f32) -> vec2f {
    return vec2f(randOffset(vec2f(0, 0), floor((uniforms.time + idx) / PERIOD), uniforms.seed * 10 + idx), randOffset(vec2f(0, 0), floor((uniforms.time + idx) / PERIOD), uniforms.seed * 15 + idx));
}

fn waveProgress(idx: f32) -> f32 {
    return fract((uniforms.time + idx) / PERIOD);
}

fn waveRadius(idx: f32) -> f32 {
    return 0.01 + (1 - waveProgress(idx)) * 0.05 + 0.05 * rand(vec2f(0, 0), floor((uniforms.time + idx) / PERIOD), uniforms.seed * 50 + idx);
}

fn waveEnd(idx: f32) -> f32 {
    let center = waveCenter(idx);
    return distance(abs(center), vec2f(-1, -1)) + 0.2;
}

fn waveDst(pos: vec2f, idx: f32) -> f32 {
    let center = waveCenter(idx);
    return distance(pos.xy, center) / waveEnd(idx) - waveProgress(idx);
}

fn waveColor(idx: f32) -> vec3f {
    return colors.waves[u32(idx) % N_COLORS];
}

fn waveAt(pos: vec2f, idx: f32) -> vec4f {
    let radius = waveRadius(idx);
    let dst = waveDst(pos, idx);
    let spike = smoothstep(-radius, radius, dst);
    var alpha: f32 = sin(spike * PI) / 2;
    return vec4f(waveColor(idx), alpha);
}

fn applyWave(base: vec4f, pos: vec2f, idx: f32) -> vec4f {
    let wave = waveAt(pos, idx);
    return mix(base, vec4f(wave.rgb, 1.0), wave.a);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    var res = vec4f(in.primary, 1.0);
    res = applyWave(res, in.pos, 0);
    res = applyWave(res, in.pos, 1);
    res = applyWave(res, in.pos, 2);
    res = applyWave(res, in.pos, 3);

    return vec4f(keepSide(res.rgb, ((in.flags & 1) == 1) != (uniforms.inverted > 0.5)), 1.0);
}

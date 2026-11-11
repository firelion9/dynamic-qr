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
    @location(4) @interpolate(flat) flags: u32,
};

fn qhash(x: f32, y: f32) -> f32 {
    return fract(sin(x * 12.9898 + y * 78.233) * 43758.5453);
}

@vertex
fn vertShader(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let clip = vec2<f32>(input.position.x * 2 - 1, 1 - input.position.y * 2);
    out.position = vec4<f32>(clip, 0.0, 1.0);
    out.pos = clip;
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
    // Module cell (in module units) recovered from the interpolated quad centre.
    let cell = (in.center.xy + vec2<f32>(1, -1)) / vec2<f32>(2, -2) * uniforms.size - vec2<f32>(0.5, 0.5);

    // Distance of the cell centre from the middle of the square (module units).
    // The square's centre maps to clip (0, 0) and spans `size` modules across [-1, 1].
    let moduleDist = length(in.center.xy) * (uniforms.size * 0.5);

    // Ring expanding from the centre outwards; wraps around seamlessly.
    // `ring` is the current radius r, so the peak sits where x^2+y^2 == r^2.
    let bandHalf = 2.0;
    let maxR = uniforms.size * 0.5 * 1.5;
    let period = maxR + bandHalf;
    let ring = fract(uniforms.time * 0.3) * period - bandHalf;
    var distRing = abs(moduleDist - ring);
    if (distRing > period * 0.5) {
        distRing = period - distRing;
    }
    // wave == 1 right at the ring centre, falls to 0 outside it.
    let wave = smoothstep(bandHalf, 0.0, distRing);
    let jitter = qhash(cell.x, cell.y + uniforms.seed) * 0.25;

    // Superellipse shape; the exponent s controls the form:
    // s=2 is a perfect circle, s>2 tends to a square, s<2 a rounded blob.
    // Outside the wave it stays "as is"; approaching the peak it becomes
    // rounder, and at the peak it is exactly a circle (s == 2).
    let dir = (in.pos.xy - in.center.xy) * uniforms.size;
    let baseS = 1.75 + jitter * 0.3;
    let s = mix(baseS, 2.0, wave);
    let dst = pow(dot(pow(abs(dir), vec2f(s, s)), vec2f(1, 1)), 1 / s);
    let shrink = wave * 0.7;
    // Reserved modules (e.g. the corner finder patterns) use a fixed circular
    // shape with no jitter, matching the breath animation so they read cleanly.
    var alpha: f32 = smoothstep(0.5, 1.1, dst - shrink);
    if ((in.flags & 2) != 0u) {
        let sRes = 2.0;
        let dstRes = pow(dot(pow(abs(dir), vec2f(sRes, sRes)), vec2f(1, 1)), 1 / sRes);
        alpha = smoothstep(0.5, 1.1, dstRes - 0.3);
    }
    return vec4f(mix(in.primary, in.secondary, vec3f(alpha, alpha, alpha)), 1.0);
}
const DARK = 0.28;
const LIGHT = 0.72;

fn luma(c: vec3f) -> f32 {
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn clampLuma(color: vec3f, light: bool, low: f32, high: f32) -> vec3f {
    let c = clamp(color, vec3f(0.0), vec3f(1.0));
    let l = luma(c);
    if (!light) { return c * min(1.0, low / max(l, 1e-4)); }
    return mix(c, vec3f(1.0), max(0.0, (high - l) / (1.0 - l)));
}

// A tinted module must stay on the light or dark side a scanner expects.
fn keepSide(c: vec3f, dark: bool) -> vec3f {
    return clampLuma(c, !dark, DARK, LIGHT);
}

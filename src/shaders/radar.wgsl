// A radar screen: the beam sweeps around, modules glow behind it, ships leave trails and ping when the beam hits them.
// Marks come from radar.ts: 1 head, 2 body, 3 and 4 the same over modules that have to stay light, 5+ trail.
const TAU = 6.2831853;
const TURN = 1.8;

fn sinceBeam(v: vec2f) -> f32 {
    return fract((u.time * TURN - atan2(v.y, v.x)) / TAU);
}

fn isHead(m: u32) -> bool { return m == 1u || m == 3u; }
fn isBody(m: u32) -> bool { return m == 2u || m == 4u; }

fn segment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
    let ab = b - a;
    let t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    return length(p - a - ab * t);
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let dark = shownDark(f);
    let m = mark(f);
    let center = vec2f(u.size * 0.5);

    let v = p - center;
    let r = length(v) / (u.size * 0.5);
    let glow = exp(-sinceBeam(v) * 6.0);
    let ring = 1.0 - smoothstep(0.0, 0.015, abs(fract(r * 4.0 + 0.5) - 0.5) / 4.0);
    let axes = 1.0 - smoothstep(0.0, 0.06, min(abs(v.x), abs(v.y)));
    let lines = max(ring, axes) * 0.5;

    var col = mix(u.light, mix(u.neon, vec3f(1.0), 0.55), clamp(0.7 * glow + 0.3 * lines, 0.0, 1.0));
    if (dark) { col = mix(u.dark, u.neon, clamp(0.85 * glow + 0.35 * lines, 0.0, 1.0)); }
    if (m >= 5u) { col = mix(col, u.accent, 1.0 - 0.3 * f32(m - 5u)); }

    // Ships: a capsule from the head to the body; a ring runs out of the head right after the beam passes.
    var hull = 9.0;
    var ping = 0.0;
    for (var dy = -3; dy <= 3; dy++) {
        for (var dx = -3; dx <= 3; dx++) {
            let h = c + vec2i(dx, dy);
            if (!isHead(mark(cell(h)))) { continue; }
            let hc = vec2f(h) + 0.5;
            let age = sinceBeam(hc - center) * TAU / TURN;
            let radius = 0.6 + age * 2.5;
            ping = max(ping, (1.0 - smoothstep(0.08, 0.22, abs(length(p - hc) - radius))) * exp(-age * 1.2) * step(radius, 3.2));
            if (max(abs(dx), abs(dy)) > 1) { continue; }
            hull = min(hull, length(p - hc));
            for (var by = -1; by <= 1; by++) {
                for (var bx = -1; bx <= 1; bx++) {
                    let b = h + vec2i(bx, by);
                    if (isBody(mark(cell(b)))) { hull = min(hull, segment(p, hc, vec2f(b) + 0.5)); }
                }
            }
        }
    }
    col = mix(col, u.neon, ping);

    var res = readable(tile(col, dark), p, !dark);
    let blip = 1.0 - smoothstep(0.4, 0.47, hull);
    if (blip > 0.0) {
        let black = dark || m == 1u || m == 2u;
        res = mix(res, select(tile(u.accent, false), vec3f(0.0), black), blip);
    }
    return vec4f(res, 1.0);
}

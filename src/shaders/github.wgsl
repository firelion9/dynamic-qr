// A contribution graph that lives: commits land on random days with a pop and fade out a few seconds later.
// Every cell has its own clock; a commit stays for LIFE slots, so a day's level is the number of recent commits.
const SLOT = 0.7;
const LIFE = 4.0;

fn committed(c: vec2i, slot: f32) -> f32 {
    return step(0.8, hash(vec3f(vec2f(c), slot + u.seed * 13.0)));
}

@fragment
fn fragmentShader(in: VertexOutput) -> @location(0) vec4f {
    let p = in.uv * u.size;
    let c = vec2i(floor(p));
    let f = cell(c);
    let dark = shownDark(f);
    let page = select(vec3f(1.0), vec3f(0.05, 0.07, 0.09), u.inverted > 0.5);
    if ((f & 8u) != 0u) { return vec4f(page, 1.0); }

    let s = u.time / SLOT + hash(vec3f(vec2f(c), 7.0 + u.seed));
    let slot = floor(s);
    let age = fract(s) * SLOT;
    var level = 0.0;
    for (var i = 0.0; i < LIFE; i += 1.0) { level += committed(c, slot - i); }
    let landed = committed(c, slot) * exp(-age * 7.0);
    let gone = committed(c, slot - LIFE) * exp(-age * 7.0);

    var col = mix(u.light, u.neon, min(level, 2.0) * 0.5 + landed * 0.3);
    if (dark) { col = mix(u.accent, u.dark, min(level, 2.0) * 0.5); }

    // Rounded cells with a gap; finder and timing patterns stay solid so scanners still find them.
    let half = 0.39 + 0.07 * landed - 0.04 * gone;
    let q = abs(fract(p) - 0.5) - vec2f(half - 0.12);
    if (length(max(q, vec2f(0.0))) - 0.12 > 0.0 && !reserved(f)) { return vec4f(page, 1.0); }
    return vec4f(readable(tile(col, dark), p, !dark), 1.0);
}

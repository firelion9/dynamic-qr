// Shared header for shaders that draw straight from the QR grid (see grid-shader.ts).
struct Uniforms {
    time: f32,
    size: f32,
    inverted: f32,
    seed: f32,
    neon: vec3f,
    accent: vec3f,
    dark: vec3f,
    light: vec3f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

fn cell(c: vec2i) -> u32 {
    let n = i32(u.size);
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) { return 10u; }
    return grid[c.y * n + c.x];
}

fn reserved(f: u32) -> bool { return (f & 2u) != 0u; }
fn shownDark(f: u32) -> bool { return ((f & 1u) != 0u) != (u.inverted > 0.5); }
fn open(f: u32) -> bool { return shownDark(f); }
fn mark(f: u32) -> u32 { return f >> 8u; }

// These effects tint whole modules, so they get stricter caps than the per-pixel 0.28 / 0.72.
const TILE_DARK = 0.16;
const TILE_LIGHT = 0.8;

fn tile(col: vec3f, dark: bool) -> vec3f {
    return clampLuma(col, !dark, TILE_DARK, TILE_LIGHT);
}

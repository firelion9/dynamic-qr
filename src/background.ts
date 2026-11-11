const MODULE = 14;
const FLIPS_PER_SECOND = 40;

export function startBackground(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cols = 0;
    let rows = 0;
    let target: Float32Array;
    let alpha: Float32Array;

    const resize = () => {
        const dpr = devicePixelRatio;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(innerWidth / MODULE);
        rows = Math.ceil(innerHeight / MODULE);
        target = Float32Array.from({ length: cols * rows }, () => (Math.random() < 0.45 ? 1 : 0));
        alpha = Float32Array.from(target);
    };

    const draw = () => {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.fillStyle = '#9fb2ff';
        for (let i = 0; i < alpha.length; i++) {
            if (alpha[i] < 0.02) continue;
            ctx.globalAlpha = alpha[i] * 0.07;
            ctx.fillRect((i % cols) * MODULE, Math.floor(i / cols) * MODULE, MODULE - 2, MODULE - 2);
        }
        ctx.globalAlpha = 1;
    };

    let last = performance.now();
    const loop = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        for (let n = Math.round(FLIPS_PER_SECOND * dt * (cols * rows) / 5000); n > 0; n--) {
            const i = Math.floor(Math.random() * target.length);
            target[i] = 1 - target[i];
        }
        for (let i = 0; i < alpha.length; i++) alpha[i] += (target[i] - alpha[i]) * Math.min(1, dt * 3);
        draw();
        requestAnimationFrame(loop);
    };

    resize();
    addEventListener('resize', () => {
        resize();
        draw();
    });
    if (still) draw();
    else requestAnimationFrame(loop);
}

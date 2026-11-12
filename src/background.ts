const MODULE = 14;

export function startBackground(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    let cols = 0;
    let rows = 0;
    let alpha: Float32Array;

    const resize = () => {
        const dpr = devicePixelRatio;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(innerWidth / MODULE);
        rows = Math.ceil(innerHeight / MODULE);
        alpha = Float32Array.from({ length: cols * rows }, () => (Math.random() < 0.45 ? 1 : 0));
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

    addEventListener('resize', () => {
        resize();
        draw();
    });
    
    resize();
    draw();
}

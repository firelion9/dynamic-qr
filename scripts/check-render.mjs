// Renders every animation in headless Chrome and decodes the frames (see check.html).
// Needs Chrome with WebGPU; set CHROME_PATH if it is not in the default place.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const CHROME =
    process.env.CHROME_PATH ??
    (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const TIMEOUT_MS = 10 * 60 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = new URL('check.html', server.resolvedUrls.local[0]).href;

const profile = mkdtempSync(join(tmpdir(), 'qr-check-'));
const chrome = spawn(CHROME, ['--headless=new', '--enable-unsafe-webgpu', `--user-data-dir=${profile}`, '--remote-debugging-port=0', url], {
    stdio: 'ignore',
});

let exitCode = 1;
try {
    const port = await devtoolsPort(profile);
    const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
    const evaluate = await connect(target.webSocketDebuggerUrl);

    const started = Date.now();
    let result;
    while (!(result = await evaluate('window.checkResult')) && Date.now() - started < TIMEOUT_MS) await sleep(1000);
    if (!result) throw new Error('timed out');
    if (result.error) throw new Error(result.error);

    for (const row of result.rows) {
        const mark = row.failed.length ? 'FAIL' : 'ok  ';
        console.log(`${mark} ${row.key.padEnd(12)} ${row.passed}/${row.total}${row.failed.length ? '  ' + row.failed.join(', ') : ''}`);
    }
    exitCode = result.rows.every(row => !row.failed.length) ? 0 : 1;
} catch (err) {
    console.error('Render check failed:', err.message);
} finally {
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
    await server.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
process.exit(exitCode);

async function devtoolsPort(dir) {
    for (let i = 0; i < 100; i++) {
        try {
            return Number(readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
        } catch {
            await sleep(100);
        }
    }
    throw new Error(`could not start Chrome at ${CHROME}`);
}

async function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => ((ws.onopen = resolve), (ws.onerror = reject)));
    const pending = new Map();
    let id = 0;
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        pending.get(message.id)?.(message.result);
        pending.delete(message.id);
    };
    return expression =>
        new Promise(resolve => {
            pending.set(++id, result => resolve(result?.result?.value));
            ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
        });
}

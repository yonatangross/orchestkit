#!/usr/bin/env node
// Render a film page frame by frame in a running Chrome over the DevTools protocol.
// Frame i is renderAt(i / fps), saved as fNNN.png from the canvas pixels (no screenshot,
// no compositor), so the frames are exactly what the drawing code drew.
//
// Needs a Chrome started with --remote-debugging-port (default 9222). The script opens
// its own tab and closes it at the end, so it never touches the user's tabs.
//
// usage: render-frames.mjs <film-url> <out-dir> [--fps 30] [--seconds 32] [--from 0] [--to N] [--port 9222]
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: o, positionals: [url, outDir] } = parseArgs({
  allowPositionals: true,
  options: { fps: { type: 'string', default: '30' }, seconds: { type: 'string', default: '32' },
    from: { type: 'string', default: '0' }, to: { type: 'string' }, port: { type: 'string', default: '9222' } },
});
if (!url || !outDir) { console.error('usage: render-frames.mjs <film-url> <out-dir> [--fps 30] [--seconds 32]'); process.exit(2); }
const fps = Number(o.fps), total = Math.round(Number(o.seconds) * fps);
const from = Number(o.from), to = o.to === undefined ? total - 1 : Number(o.to);
if (total > 1000) console.warn(`warning: ${total} frames; many shared encoders cap at 1000`);
mkdirSync(outDir, { recursive: true });

const base = `http://127.0.0.1:${o.port}`;
const tab = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const wait = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
let code = 0;
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  for (let k = 0; k < 50 && !(await ev('typeof window.ready !== "undefined"')); k++) await new Promise(r => setTimeout(r, 100));
  console.log(await ev('window.ready'));
  const t0 = Date.now();
  for (let i = from; i <= to; i++) {
    const data = await ev(`renderAt(${i / fps}); document.getElementById('c').toDataURL('image/png')`);
    writeFileSync(`${outDir}/f${String(i).padStart(3, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
    if (i % 60 === 0) console.log(`frame ${i}/${to}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(`done: ${to - from + 1} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (err) {
  console.error(`render failed: ${err.message}`); code = 1;
} finally {
  ws.close(); await fetch(`${base}/json/close/${tab.id}`);
}
process.exit(code);

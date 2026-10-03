# JS art: the moving piece on a glyph page

Chat stays ASCII. A glyph **page** that explains a change (an explainer, a NOW vs
IDEAL plan, "show it moving") carries one small animated piece: an inline
`<canvas>` driven by a pure timeline function. This file is the contract and
four patterns to start from (three drawn, one from real numbers). `tests/unit/test-glyph-js-art.mjs` runs every
`js` block below in node with a stub canvas, so a pattern that breaks the
contract fails CI.

## The contract

| Part | Rule |
|---|---|
| `draw(ctx, t, mode)` | Pure. Same `t` and `mode` draw the same frame. It reads no clock, no `Math.random`, no state that a previous frame left. |
| `LOOP`, `HERO_T` | Loop length in seconds, and the one frame that tells the story best. |
| `CAPTION` | `{ now, ideal }`: one sentence per mode, plain words, at most 12 words. |
| `ALT` | One sentence (at most 25 words) that says what the piece shows. The kernel puts `ALT` plus the current caption on the canvas `aria-label`, so a screen reader hears the piece, not "image". |
| Real numbers | A piece that shows measured data reads it from a JSON array in the page (pattern 4). An unknown value is `null` and draws as `?`, never as a guessed bar. |
| `window.seek(t)` | Pauses and draws frame `t`. A capture script steps it to make an mp4 or gif. |
| `window.setMode(m)` | `'now'` or `'ideal'`. The toggle buttons carry `aria-pressed`. |
| Reduced motion | `prefers-reduced-motion: reduce` draws `HERO_T` once and never calls `requestAnimationFrame`. The toggle still works. |
| Pause | A Play/Pause button, so motion is never forced on the reader. |
| Randomness | `rng(seed)` (seeded) at the top level of the pattern, never inside `draw`. |
| Page | Self-contained: no network, no CDN, light paper colors from `C`, no em dash. |

Why pure: a piece that keeps state between frames (positions it moves by `dt`,
a `Math.random` per frame) cannot jump to frame `t`. Then it cannot be
captured frame by frame, and two screenshots of "the same" page differ.

**Incorrect** (state plus randomness, cannot seek):

```text
x += speed * dt;  if (Math.random() < 0.5) badge = 'b';
```

**Correct** (position is a function of t):

```text
x = 40 + ((t / LOOP + i / N) % 1) * (w - 80);
```

## Page skeleton

One piece per page, above the first beat. The pattern goes first in the
script, the kernel after it, because the kernel reads `LOOP`, `HERO_T`,
`ALT`, `CAPTION` and `draw`.

```html
<figure class="art">
  <div role="group" aria-label="Compare">
    <button data-mode="now" aria-pressed="true">Now</button>
    <button data-mode="ideal" aria-pressed="false">Ideal</button>
    <button id="art-play">Pause</button>
  </div>
  <canvas id="art" width="960" height="320" role="img"
          aria-label="Animated comparison of now and ideal"></canvas>
  <figcaption id="art-caption"></figcaption>
</figure>
<!-- pattern 4 only: the real numbers, one row per item. Write "<" in a
     string as \u003c so the JSON can never close this script tag. -->
<script type="application/json" id="art-data">
  [{ "label": "review", "now": 14, "ideal": 3 }]
</script>
<script>
  /* 1. one pattern block from below */
  /* 2. the kernel block */
</script>
```

## The kernel (paste once, after the pattern)

```js
// js-art kernel. Reads LOOP, HERO_T, ALT, CAPTION and draw() from the pattern.
const C = { ink: '#1a1a1a', muted: '#6b6b6b', line: '#e2e2e2',
  accent: '#2f6f4e', warn: '#b45309', stop: '#b91c1c' };
const cv = document.getElementById('art');
const ctx = cv.getContext('2d');
const still = !!(window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const playBtn = document.getElementById('art-play');
let mode = 'now';
let playing = false;
let last = HERO_T;

function rng(seed) { // mulberry32: same seed, same sequence
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function render(t) {
  last = ((t % LOOP) + LOOP) % LOOP;
  ctx.clearRect(0, 0, cv.width, cv.height);
  draw(ctx, last, mode);
}
function label() { if (playBtn) playBtn.textContent = playing ? 'Pause' : 'Play'; }
function play() {
  if (still) { render(HERO_T); return; } // reduced motion: one still frame
  playing = true;
  label();
  const start = performance.now() - last * 1000;
  requestAnimationFrame(function tick(now) {
    if (!playing) return;
    render((now - start) / 1000);
    requestAnimationFrame(tick);
  });
}
function pause() { playing = false; label(); }

window.seek = function (t) { pause(); render(t); };
window.setMode = function (m) {
  mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }
  const cap = document.getElementById('art-caption');
  if (cap) cap.textContent = CAPTION[m];
  cv.setAttribute('aria-label', ALT + ' ' + CAPTION[m]);
  render(last);
};
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => window.setMode(b.dataset.mode));
}
if (playBtn) {
  playBtn.hidden = still;
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
}
window.setMode('now');
play();
```

## Pattern 1: flow dots

Items travel along a path. Spacing and speed carry the message: in NOW they
bunch up at the start, in IDEAL they move at one even pace.

```js
const LOOP = 8;
const HERO_T = 3.2;
const ALT = 'Twelve dots travel left to right along one line.';
const CAPTION = {
  now: 'Now: work moves in bursts and piles up at the start.',
  ideal: 'Ideal: work moves at one steady pace.',
};
const N = 12;
const DRAG = Array.from({ length: N }, (_, i) => rng(7 + i)());

function draw(ctx, t, mode) {
  const w = ctx.canvas.width;
  const y = ctx.canvas.height / 2;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke();
  for (let i = 0; i < N; i++) {
    const phase = (t / LOOP + i / N) % 1;
    const p = mode === 'now' ? Math.pow(phase, 1 + DRAG[i] * 2) : phase;
    ctx.fillStyle = mode === 'now' ? C.warn : C.accent;
    ctx.beginPath(); ctx.arc(40 + p * (w - 80), y, 8, 0, Math.PI * 2); ctx.fill();
  }
}
```

## Pattern 2: gate

Items arrive at a gate and wait until it opens. In NOW the gate opens once,
late, for a short time (a person checks by hand), and the line grows. In
IDEAL it checks each item as it arrives. Each item's place is computed from
`t` alone: its arrival time and the first open window after it.

```js
const LOOP = 10;
const HERO_T = 6;
const ALT = 'Dots arrive at a gate, wait in a line while it is red, and pass when it is green.';
const CAPTION = {
  now: 'Now: the gate opens only when someone checks by hand.',
  ideal: 'Ideal: the gate checks each item as it arrives.',
};
const N = 10;
const GAP = 0.25;    // seconds between two items through the gate
const TRAVEL = 2;    // seconds from the gate to the right edge
const OPEN = { now: [[7, 8.5]], ideal: [[0, LOOP]] };

function passTime(arrive, prev, mode) {
  const ready = Math.max(arrive, prev + GAP);
  for (const [a, b] of OPEN[mode]) if (ready < b) return Math.max(ready, a);
  return Infinity; // still waiting when the loop ends
}
function draw(ctx, t, mode) {
  const w = ctx.canvas.width;
  const y = ctx.canvas.height / 2;
  const gx = w / 2;
  const open = OPEN[mode].some(([a, b]) => t >= a && t < b);
  ctx.fillStyle = open ? C.accent : C.stop;
  ctx.fillRect(gx - 4, y - 40, 8, 80);
  let prev = -Infinity;
  let waiting = 0;
  for (let i = 0; i < N; i++) {
    const arrive = i * 0.6;
    const pass = passTime(arrive, prev, mode);
    prev = pass;
    if (t < arrive) continue;
    let x;
    if (t < pass) { x = gx - 24 - waiting * 20; waiting++; }
    else x = gx + 24 + ((t - pass) / TRAVEL) * (w / 2 - 64);
    if (x > w - 20) continue;
    ctx.fillStyle = t < pass ? C.warn : C.accent;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = C.muted;
  ctx.font = '16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('waiting: ' + waiting, 40, 40);
}
```

## Pattern 3: before/after meter

The same scene in two modes, so the toggle is the whole explanation. In NOW
the bar rises and falls back (work redone), in IDEAL it fills once and stays.

```js
const LOOP = 6;
const HERO_T = 4.5;
const ALT = 'One progress bar that shows how much of the work is done.';
const CAPTION = {
  now: 'Now: half the work is redone, so the bar never fills.',
  ideal: 'Ideal: done once, the bar fills and stays full.',
};

function level(t, mode) {
  const u = t / LOOP;
  if (mode === 'ideal') return Math.min(1, u * 1.25);
  return 0.1 + 0.35 * Math.abs(Math.sin(2 * Math.PI * u));
}
function draw(ctx, t, mode) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const v = level(t, mode);
  ctx.fillStyle = C.line;
  ctx.fillRect(40, h / 2 - 20, w - 80, 40);
  ctx.fillStyle = mode === 'now' ? C.warn : C.accent;
  ctx.fillRect(40, h / 2 - 20, (w - 80) * v, 40);
  ctx.fillStyle = C.ink;
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(Math.round(v * 100) + ' % done', 40, h / 2 - 32);
}
```

## Pattern 4: real-data bars

The operator wants pieces built from real numbers, not only synthetic dots.
The data sits in the page as a JSON array (see the skeleton), one row per
item, both modes in the same unit. Bars grow in, then hold, so the capture
still has motion. Fill the array from the command that measured it, and keep
`null` for a value you do not have: it draws `?` and no bar.

```js
const DATA = JSON.parse(document.getElementById('art-data').textContent);
const LOOP = 6;
const HERO_T = 5;
const ALT = 'Bar chart of hours per step, now against ideal, from the numbers in this page.';
const CAPTION = {
  now: 'Now: hours each step takes today.',
  ideal: 'Ideal: hours each step takes after the change.',
};
const MAX = Math.max(1, ...DATA.flatMap((d) => [d.now, d.ideal]).filter((v) => typeof v === 'number'));

function draw(ctx, t, mode) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const grow = Math.min(1, t / 1.5); // grow in, then hold
  const row = (h - 40) / Math.max(1, DATA.length);
  const track = w - 280;
  ctx.font = '15px ui-sans-serif, system-ui, sans-serif';
  DATA.forEach((d, i) => {
    const y = 20 + i * row;
    const v = d[mode];
    const known = typeof v === 'number';
    const bw = known ? track * (v / MAX) * grow : 0;
    ctx.fillStyle = C.ink;
    ctx.fillText(String(d.label), 40, y + row / 2 + 5);
    ctx.fillStyle = C.line;
    ctx.fillRect(180, y + row * 0.2, track, row * 0.6);
    ctx.fillStyle = mode === 'now' ? C.warn : C.accent;
    ctx.fillRect(180, y + row * 0.2, bw, row * 0.6);
    ctx.fillStyle = C.muted;
    ctx.fillText(known ? String(v) : '?', 190 + bw, y + row / 2 + 5);
  });
}
```

## Capture to mp4 or gif

Because `draw` is pure, a headless browser can step `window.seek(i / fps)`
for `i` in `0 .. LOOP * fps` and screenshot the canvas each step; `ffmpeg`
joins the frames. No screen recording, no dropped frames, and the same
input always gives the same file.

## Before you call it done

Same rule as `page-route.md` section 4: open the page, look at it in both
modes and with reduced motion on, and read the pixels. A test that runs the
script proves the contract, not that the piece explains anything.

#!/usr/bin/env node
// ============================================================================
// glyph js-art: every pattern in references/js-art.md keeps the contract
// ============================================================================
// WHAT THIS GUARDS
//
//   A glyph page carries one animated piece built from the kernel and one
//   pattern in src/skills/glyph/references/js-art.md. This test runs each
//   pattern plus the kernel in node, against a stub canvas and DOM, and checks:
//
//   1. seek(t) is deterministic: same t, same draw log; t and t + LOOP match.
//   2. NOW and IDEAL draw different frames at HERO_T.
//   3. Reduced motion draws one frame and never calls requestAnimationFrame.
//   4. draw() reads no clock and no Math.random.
//   5. The canvas aria-label carries ALT plus the caption (a text alt for
//      screen readers), and captions and ALT stay short.
//   6. The real-data pattern draws from the page JSON: other numbers give
//      another frame, and a null value draws "?" instead of a bar.
//   7. The skeleton carries the ids the kernel reads, and SKILL.md routes
//      pages to the reference.
//
//   Two negative arms (a Math.random pattern, a stateful pattern) must FAIL
//   the same checks, so a green run cannot come from a harness that sees
//   nothing.
//
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = path.join(ROOT, 'src/skills/glyph/references/js-art.md');
const SKILL = path.join(ROOT, 'src/skills/glyph/SKILL.md');
const ROUTE = path.join(ROOT, 'src/skills/glyph/references/page-route.md');
const BUILT = path.join(ROOT, 'plugins/ork/skills/glyph/references/js-art.md');

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(detail ? `${name}: ${detail}` : name);
}

const md = readFileSync(REF, 'utf8');
const jsBlocks = [...md.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
const htmlBlocks = [...md.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
check('reference has a kernel and four patterns', jsBlocks.length === 5, `found ${jsBlocks.length} js blocks`);
const [kernel, ...patterns] = jsBlocks;

// ---- stub DOM + canvas ------------------------------------------------------
function makeCtx(canvas, log) {
  const record = (name) => (...args) => log.push([name, ...args]);
  return new Proxy({ canvas }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return record(String(prop));
    },
    set(target, prop, value) {
      if (prop === 'canvas') target.canvas = value;
      else log.push(['set', String(prop), value]);
      return true;
    },
  });
}

const SAMPLE_DATA = [
  { label: 'review', now: 14, ideal: 3 },
  { label: 'deploy', now: 6, ideal: 2 },
  { label: 'unknown', now: null, ideal: 1 },
];

function boot(source, { reduced = false, data = SAMPLE_DATA } = {}) {
  const log = [];
  const canvasAttrs = {};
  const canvas = { width: 960, height: 320, attrs: canvasAttrs, setAttribute: (k, v) => { canvasAttrs[k] = v; } };
  canvas.getContext = () => makeCtx(canvas, log);
  const caption = { textContent: '' };
  const playBtn = { hidden: false, textContent: '', addEventListener() {} };
  const buttons = ['now', 'ideal'].map((m) => {
    const attrs = {};
    return { dataset: { mode: m }, attrs, setAttribute: (k, v) => { attrs[k] = v; }, addEventListener() {} };
  });
  const els = {
    art: canvas, 'art-caption': caption, 'art-play': playBtn,
    'art-data': { textContent: JSON.stringify(data) },
  };
  let rafCalls = 0;
  let randomCalls = 0;
  const strictMath = Object.create(Math);
  strictMath.random = () => { randomCalls++; return 0.5; };
  const window = {
    matchMedia: (q) => ({ matches: reduced && q.includes('prefers-reduced-motion') }),
  };
  const sandbox = {
    window,
    document: {
      getElementById: (id) => els[id] ?? null,
      querySelectorAll: (sel) => (sel === '[data-mode]' ? buttons : []),
    },
    requestAnimationFrame: () => { rafCalls++; return rafCalls; },
    performance: { now: () => 0 },
    Math: strictMath,
    console,
  };
  vm.createContext(sandbox);
  // const declarations stay script-scoped, so expose the pattern constants.
  vm.runInContext(`${source}\n${kernel}\nwindow.__art = { LOOP, HERO_T, ALT, CAPTION };`, sandbox);
  return {
    log, caption, playBtn, buttons, window, canvas,
    rafCalls: () => rafCalls,
    randomCalls: () => randomCalls,
    frame(t, mode) {
      if (mode) window.setMode(mode);
      log.length = 0;
      window.seek(t);
      return JSON.stringify(log);
    },
  };
}

function finiteArgs(logJson) {
  for (const entry of JSON.parse(logJson)) {
    for (const v of entry.slice(1)) if (typeof v === 'number' && !Number.isFinite(v)) return false;
    // JSON turns NaN and Infinity into null; a null numeric arg is the same failure.
    if (entry[0] !== 'set' && entry.slice(1).some((v) => v === null)) return false;
  }
  return true;
}

// Returns the list of contract breaks for one pattern (empty = keeps the contract).
function contractBreaks(source) {
  const breaks = [];
  let art;
  try { art = boot(source); } catch (e) { return [`throws on boot: ${e.message}`]; }
  const { LOOP, HERO_T, ALT, CAPTION } = art.window.__art;
  if (art.rafCalls() < 1) breaks.push('motion allowed but requestAnimationFrame never called');
  if (art.caption.textContent !== CAPTION.now) breaks.push('caption not set to CAPTION.now on boot');
  if (art.buttons[0].attrs['aria-pressed'] !== 'true') breaks.push('Now button not aria-pressed on boot');
  const altWords = String(ALT ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (altWords === 0 || altWords > 25) breaks.push(`ALT missing or over 25 words (${altWords})`);
  if (art.canvas.attrs['aria-label'] !== `${ALT} ${CAPTION.now}`) breaks.push('canvas aria-label is not ALT plus the NOW caption');

  const randomBefore = art.randomCalls();
  const a = art.frame(HERO_T, 'now');
  const b = art.frame(HERO_T, 'now');
  const wrap = art.frame(HERO_T + LOOP, 'now');
  if (a.length < 10) breaks.push('seek drew nothing');
  if (a !== b) breaks.push('seek(t) twice drew different frames (state between frames)');
  if (a !== wrap) breaks.push('seek(t) and seek(t + LOOP) differ');
  if (!finiteArgs(a)) breaks.push('a draw call got NaN or Infinity');
  const ideal = art.frame(HERO_T, 'ideal');
  if (ideal === a) breaks.push('NOW and IDEAL draw the same frame at HERO_T');
  if (art.buttons[1].attrs['aria-pressed'] !== 'true') breaks.push('Ideal button not aria-pressed after setMode');
  if (art.canvas.attrs['aria-label'] !== `${ALT} ${CAPTION.ideal}`) breaks.push('canvas aria-label does not follow the mode');
  for (let t = 0; t < LOOP; t += LOOP / 7) {
    if (!finiteArgs(art.frame(t, 'now')) || !finiteArgs(art.frame(t, 'ideal'))) {
      breaks.push(`non-finite draw arg at t=${t.toFixed(2)}`);
      break;
    }
  }
  if (art.randomCalls() !== randomBefore) breaks.push('draw() calls Math.random');

  const still = boot(source, { reduced: true });
  if (still.rafCalls() !== 0) breaks.push('reduced motion still calls requestAnimationFrame');
  if (still.log.length === 0) breaks.push('reduced motion drew no still frame');
  if (!still.playBtn.hidden) breaks.push('reduced motion leaves the Play button visible');

  for (const word of ['Math.random', 'Date.now', 'performance.now', 'new Date']) {
    if (source.includes(word)) breaks.push(`pattern source uses ${word}`);
  }
  for (const m of ['now', 'ideal']) {
    const words = String(CAPTION[m] ?? '').trim().split(/\s+/).length;
    if (!CAPTION[m] || words > 12) breaks.push(`CAPTION.${m} missing or over 12 words (${words})`);
  }
  return breaks;
}

// ---- positive arms: every shipped pattern keeps the contract ----------------
patterns.forEach((src, i) => {
  const breaks = contractBreaks(src);
  check(`pattern ${i + 1} keeps the contract`, breaks.length === 0, breaks.join('; '));
});

// ---- real data: pattern 4 reads the page JSON, null draws "?" ---------------
{
  const realData = patterns[3] ?? '';
  check('pattern 4 reads #art-data', realData.includes("getElementById('art-data')"));
  const a = boot(realData);
  const { HERO_T } = a.window.__art;
  const frameA = a.frame(HERO_T, 'now');
  const other = SAMPLE_DATA.map((d) => ({ ...d, now: d.now === null ? null : d.now * 3 + 1 }));
  const frameB = boot(realData, { data: other }).frame(HERO_T, 'now');
  check('pattern 4: other numbers give another frame', frameA !== frameB);
  const texts = JSON.parse(frameA).filter((e) => e[0] === 'fillText').map((e) => e[1]);
  check('pattern 4: null value draws "?"', texts.includes('?'), JSON.stringify(texts));
  check('pattern 4: known value is printed', texts.includes('14'), JSON.stringify(texts));
  const empty = boot(realData, { data: [] }).frame(HERO_T, 'ideal');
  check('pattern 4: empty array draws without NaN', finiteArgs(empty));
}

// ---- negative arms: the harness must catch a broken pattern -----------------
const base = patterns[0];
const randomPattern = base.replace(
  'const phase = (t / LOOP + i / N) % 1;',
  'const phase = (t / LOOP + i / N + Math.random() * 0.1) % 1;',
);
const statefulPattern = base
  .replace('function draw(ctx, t, mode) {', 'let drift = 0;\nfunction draw(ctx, t, mode) {\n  drift += 3;')
  .replace('const y = ctx.canvas.height / 2;', 'const y = ctx.canvas.height / 2 + drift;');
check('negative arm: random mutation applied', randomPattern !== base);
check('negative arm: stateful mutation applied', statefulPattern.includes('drift += 3'));
const rb = contractBreaks(randomPattern);
check('negative arm: Math.random in draw is caught', rb.some((b) => b.includes('Math.random')), rb.join('; ') || 'no break reported');
const sb = contractBreaks(statefulPattern);
check('negative arm: state between frames is caught', sb.some((b) => b.includes('state between frames')), sb.join('; ') || 'no break reported');

// ---- skeleton, routing, hygiene ---------------------------------------------
const skeleton = htmlBlocks[0] ?? '';
for (const needle of ['id="art"', 'id="art-play"', 'id="art-caption"', 'data-mode="now"', 'data-mode="ideal"', 'aria-pressed', 'role="img"']) {
  check(`skeleton carries ${needle}`, skeleton.includes(needle));
}
const skill = readFileSync(SKILL, 'utf8');
check('SKILL.md routes pages to references/js-art.md', skill.includes('references/js-art.md'));
check('SKILL.md keeps chat ASCII-only', /chat stays ascii/i.test(skill));
check('page-route.md points at the JS piece', readFileSync(ROUTE, 'utf8').includes('js-art.md'));
check('reference has no em or en dash', !/[–—]/.test(md));
check('reference names prefers-reduced-motion', md.includes('prefers-reduced-motion'));
check('skeleton carries the art-data JSON script', skeleton.includes('type="application/json" id="art-data"'));
const PLAY = path.join(ROOT, 'docs/feat--glyph-js-art/index.html');
if (existsSync(PLAY)) {
  const page = readFileSync(PLAY, 'utf8');
  check('playground embeds the kernel verbatim', page.includes(JSON.stringify(kernel)));
  patterns.forEach((src, i) => check(`playground embeds pattern ${i + 1} verbatim`, page.includes(JSON.stringify(src))));
}
check('built plugin copy exists', existsSync(BUILT), 'run npm run build');
if (existsSync(BUILT)) check('built plugin copy matches source', readFileSync(BUILT, 'utf8') === md, 'run npm run build');

console.log('='.repeat(70));
console.log('  glyph js-art: patterns keep the seek / reduced-motion contract');
console.log('='.repeat(70));
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`\nFAILED: ${failures.length} check(s) failed, ${passed} passed`);
  process.exit(1);
}
console.log(`SUCCESS: ${passed} checks passed`);
process.exit(0);

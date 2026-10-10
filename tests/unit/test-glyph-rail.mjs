#!/usr/bin/env node
// ============================================================================
// glyph rail: the sections rail partial keeps its reading contract
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/glyph/templates/rail/ is a page partial any harness can inline:
//   rail.html (markup), rail.css, rail.js. This test runs rail.js in node
//   against a fake DOM of 9 sections in an 800 px window, where the last two
//   sections are shorter than the window, so the page ends before their tops
//   reach the reading line. It checks:
//
//   1. The top of the page marks 01; the page end marks the LAST section (09).
//   2. Twelve presses of "]" with focus in the rail reach 09 and stop there;
//      one "[" from 09 marks 08.
//   3. A click on 09 marks 09, and a click on 08 marks 08.
//   4. A "]" pressed outside the rail does nothing (WCAG 2.1.4: no page-wide
//      single-key shortcut).
//   5. Vacuity: two weakened copies of rail.js FAIL checks 1 and 4, so the
//      harness can tell a broken rail from a good one.
//   6. rail.html lists entries whose ids rail.js reads (pk-rail, pk-rail-bar,
//      pk-rail-now, pk-rail-say, pk-rail-toggle), and the built plugin copy
//      matches the source.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'src/skills/glyph/templates/rail');
const BUILT = path.join(ROOT, 'plugins/ork/skills/glyph/templates/rail');
const FILES = ['rail.js', 'rail.css', 'rail.html', 'README.md'];

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(detail ? `${name}: ${detail}` : name);
}

const HEIGHTS = [700, 500, 500, 900, 500, 500, 400, 300, 300];
const WINDOW_H = 800;

// Run one rail.js source against a fresh fake DOM; resolve to the measurements.
async function measure(src) {
  const TOTAL = HEIGHTS.reduce((a, b) => a + b, 0);
  const MAX = TOTAL - WINDOW_H;
  const tops = [];
  HEIGHTS.reduce((acc, h, i) => { tops[i] = acc; return acc + h; }, 0);

  const listeners = new Map();
  const on = (t, type, fn) => {
    if (!listeners.has(t.__id)) listeners.set(t.__id, {});
    const byType = listeners.get(t.__id);
    (byType[type] = byType[type] || []).push(fn);
  };
  const emit = (t, type, ev) => ((listeners.get(t.__id) || {})[type] || []).forEach((fn) => fn(ev));

  const win = { __id: 'window', scrollY: 0, innerHeight: WINDOW_H, innerWidth: 1280 };
  win.addEventListener = (type, fn) => on(win, type, fn);
  const doc = { __id: 'document', documentElement: { scrollHeight: TOTAL } };
  doc.addEventListener = (type, fn) => on(doc, type, fn);
  const scrollTo = (y) => { win.scrollY = Math.max(0, Math.min(y, MAX)); emit(win, 'scroll', {}); };

  const links = HEIGHTS.map((_, i) => {
    const attrs = {};
    const label = { b: { textContent: String(i + 1).padStart(2, '0') }, span: { textContent: `Section ${i + 1}` } };
    const a = {
      __id: `link${i}`,
      getAttribute: (k) => (k === 'href' ? `#s-${i}` : attrs[k]),
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
      hasAttr: (k) => k in attrs,
      querySelector: (sel) => label[sel],
      scrollIntoView: () => {},
      closest: (sel) => (sel === 'a' || sel === 'a.pk-rail-sec' ? a : null),
    };
    return a;
  });
  const sections = HEIGHTS.map((_, i) => ({
    __id: `s-${i}`,
    getBoundingClientRect: () => ({ top: tops[i] - win.scrollY }),
    scrollIntoView: () => scrollTo(tops[i]),
  }));
  const classes = new Set();
  const rail = {
    __id: 'rail',
    querySelectorAll: () => links,
    classList: {
      contains: (c) => classes.has(c),
      remove: (c) => classes.delete(c),
      toggle: (c, yes) => { if (yes) classes.add(c); else classes.delete(c); },
    },
    addEventListener: (type, fn) => on(rail, type, fn),
  };
  const toggle = { __id: 'toggle', addEventListener: (type, fn) => on(toggle, type, fn), setAttribute: () => {} };
  const els = {
    'pk-rail': rail,
    'pk-rail-bar': { style: {} },
    'pk-rail-now': { textContent: '' },
    'pk-rail-say': { textContent: '' },
    'pk-rail-toggle': toggle,
  };
  sections.forEach((s, i) => { els[`s-${i}`] = s; });
  doc.getElementById = (id) => els[id] || null;
  vm.runInNewContext(src, { window: win, document: doc, setTimeout, requestAnimationFrame: (fn) => fn() });

  const marked = () => {
    const lit = links.map((l, i) => (l.hasAttr('aria-current') ? i : -1)).filter((i) => i >= 0);
    return lit.length === 1 ? lit[0] + 1 : lit.length === 0 ? 0 : -1;
  };
  const key = (from, k) => {
    const ev = { key: k, target: from, metaKey: false, ctrlKey: false, altKey: false };
    if (links.includes(from)) emit(rail, 'keydown', ev);
    emit(doc, 'keydown', ev);
  };
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const click = async (i) => { emit(rail, 'click', { target: links[i] }); scrollTo(tops[i]); await tick(); };

  const out = {};
  scrollTo(0); out.top = marked();
  scrollTo(MAX); out.pageEnd = marked();
  scrollTo(0);
  out.presses = [];
  for (let i = 0; i < 12; i++) { key(links[0], ']'); out.presses.push(marked()); }
  key(links[0], '['); out.backOne = marked();
  scrollTo(0); await click(8); out.click9 = marked();
  scrollTo(0); await click(7); out.click8 = marked();
  scrollTo(0);
  const before = win.scrollY;
  key(doc, ']');
  out.keyOutsideScrolls = win.scrollY !== before;
  return out;
}

const railJs = readFileSync(path.join(DIR, 'rail.js'), 'utf8');

// 1 to 4: the real rail keeps the contract
const got = await measure(railJs);
check('top of the page marks 01', got.top === 1, `marked ${got.top}`);
check('page end marks the last section', got.pageEnd === 9, `marked ${got.pageEnd}`);
check('twelve "]" presses reach 09 and stop', got.presses.at(-1) === 9 && got.presses.includes(8), JSON.stringify(got.presses));
check('one "[" from 09 marks 08', got.backOne === 8, `marked ${got.backOne}`);
check('a click on 09 marks 09', got.click9 === 9, `marked ${got.click9}`);
check('a click on 08 marks 08', got.click8 === 8, `marked ${got.click8}`);
check('"]" outside the rail does nothing', got.keyOutsideScrolls === false);

// 5: vacuity, two weakened copies must fail
const pageEndLine = 'if (atPageEnd()) { idx = asked >= 0 ? asked : links.length - 1; }';
check('mutant 1 source applies', railJs.includes(pageEndLine));
const noPageEnd = await measure(railJs.replace(pageEndLine, ''));
check('mutant 1 (no page-end rule) is caught', noPageEnd.pageEnd !== 9, `marked ${noPageEnd.pageEnd}`);
const keysOnRail = 'rail.addEventListener("keydown"';
check('mutant 2 source applies', railJs.includes(keysOnRail));
const pageWideKeys = await measure(railJs.replace(keysOnRail, 'document.addEventListener("keydown"'));
check('mutant 2 (page-wide keys) is caught', pageWideKeys.keyOutsideScrolls === true);

// 6: the markup names what rail.js reads, and the build carries the partial
const html = readFileSync(path.join(DIR, 'rail.html'), 'utf8');
for (const id of ['pk-rail', 'pk-rail-bar', 'pk-rail-now', 'pk-rail-say', 'pk-rail-toggle', 'pk-rail-list']) {
  check(`rail.html carries id="${id}"`, html.includes(`id="${id}"`));
}
check('rail.html entries use class pk-rail-sec', (html.match(/class="pk-rail-sec"/g) || []).length >= 3);
check('rail.html skip link targets #pk-main', html.includes('href="#pk-main"'));
const css = readFileSync(path.join(DIR, 'rail.css'), 'utf8');
check('rail.css token defaults have zero specificity', css.includes(':where(:root)'));
check('rail.css sizes the rail border-box (no slide under on a page without a reset)', css.includes('.pk-rail, .pk-rail * { box-sizing: border-box; }'));
for (const f of FILES) {
  const built = path.join(BUILT, f);
  check(`built plugin copy of ${f} exists`, existsSync(built), 'run npm run build');
  if (existsSync(built)) check(`built plugin copy of ${f} matches source`, readFileSync(built, 'utf8') === readFileSync(path.join(DIR, f), 'utf8'), 'run npm run build');
}

console.log('='.repeat(70));
console.log('  glyph rail: the sections rail partial keeps its reading contract');
console.log('='.repeat(70));
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`\nFAILED: ${failures.length} check(s) failed, ${passed} passed`);
  process.exit(1);
}
console.log(`SUCCESS: ${passed} checks passed`);
process.exit(0);

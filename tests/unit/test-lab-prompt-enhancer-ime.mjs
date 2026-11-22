#!/usr/bin/env node
// ============================================================================
// prompt-enhancer-mod lab page: the Enter that confirms an IME composition must not send
// ============================================================================
// WHAT THIS GUARDS
//
//   docs/site/public/lab/prompt-enhancer-mod.html is the page the site serves, and it is a copy
//   that docs/site/scripts/lab-manifest.mjs rebuilds from its source,
//   docs/feat--prompt-enhancer-mod/index.html (named by the lab manifest fragment), so a fix in the
//   copy alone is reverted by the next build. Both files are checked here. Their draft box sends
//   on Enter. In a Japanese, Chinese or Korean input method the Enter key that CONFIRMS a
//   composition is also a keydown with key "Enter"; the page must ignore it (event.isComposing,
//   and keyCode 229 for browsers that report the composition end that way). Found by Chrome's
//   Modern Web Guidance legacy-scan 1.0.0, guide ime-safe-enter-submit.
//
//   The page script runs here in a vm against a minimal stub of the DOM it touches, and the
//   keydown handler is called with real-shaped events. Nothing is mocked in the page itself.
//   Each case asserts what the user would see: the status line and whether the default action
//   was cancelled.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = [
  ['source', 'docs/feat--prompt-enhancer-mod/index.html'],
  ['lab copy', 'docs/site/public/lab/prompt-enhancer-mod.html'],
];

// The page's own script: the first inline script after </main>.
function pageScript(file) {
  const page = readFileSync(join(root, file), 'utf8');
  const afterMain = page.slice(page.indexOf('</main>'));
  const openTag = '<script>';
  const start = afterMain.indexOf(openTag);
  const end = start === -1 ? -1 : afterMain.indexOf('</script>', start);
  assert.ok(end !== -1, `${file} must keep its inline script after </main>`);
  return afterMain.slice(start + openTag.length, end);
}
let source = '';

function loadPage(draftText) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: id === 'draft' ? draftText : '',
        textContent: '',
        hidden: false,
        listeners: {},
        addEventListener(type, fn) {
          this.listeners[type] = fn;
        },
        setAttribute() {},
        focus() {},
      });
    }
    return elements.get(id);
  };
  const document = { getElementById: element };
  vm.runInNewContext(source, { document, String });
  return { draft: element('draft'), status: element('status') };
}

function keydown(page, init) {
  let prevented = false;
  page.draft.listeners.keydown({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13, ...init, preventDefault: () => { prevented = true; } });
  return { prevented };
}

let failed = 0;
let pageName = '';
function check(label, fn) {
  try {
    fn();
    console.log(`  ok [${pageName}] ${label}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL [${pageName}] ${label}: ${error.message}`);
  }
}

console.log('prompt-enhancer-mod lab page, Enter handling');
for (const [name, file] of PAGES) {
pageName = name;
source = pageScript(file);

check('a plain Enter sends, and cancels the newline', () => {
  const p = loadPage('hello');
  const { prevented } = keydown(p, {});
  assert.equal(p.status.textContent, 'Mock sent: hello');
  assert.equal(prevented, true);
});

check('Enter that confirms an IME composition (isComposing) does not send', () => {
  const p = loadPage('こんにちは');
  const { prevented } = keydown(p, { isComposing: true, keyCode: 13 });
  assert.equal(p.status.textContent, '', 'a composing Enter must not send');
  assert.equal(prevented, false, 'the page must leave the composing Enter to the input method');
});

check('Enter reported with keyCode 229 (composition end in some browsers) does not send', () => {
  const p = loadPage('你好');
  const { prevented } = keydown(p, { isComposing: false, keyCode: 229 });
  assert.equal(p.status.textContent, '', 'a keyCode 229 Enter must not send');
  assert.equal(prevented, false);
});

check('Shift+Enter does not send (unchanged)', () => {
  const p = loadPage('hello');
  keydown(p, { shiftKey: true });
  assert.equal(p.status.textContent, '');
});

check('the next plain Enter after a composition still sends', () => {
  const p = loadPage('안녕');
  keydown(p, { isComposing: true, keyCode: 229 });
  assert.equal(p.status.textContent, '');
  keydown(p, {});
  assert.equal(p.status.textContent, 'Mock sent: 안녕');
});

check('a draft ending in ++ still opens the enhance step on a plain Enter', () => {
  const p = loadPage('add a login page++');
  keydown(p, {});
  assert.equal(p.status.textContent, 'Enhanced below. Edit it before sending.');
});
}

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log('all passed');

#!/usr/bin/env node
/**
 * Behaviour gate for the test files ork:cover generates (SKILL.md Phase 3b).
 *
 * A test is kept only when it asserts behaviour. Rejected, per test case:
 *   a  every assertion is on mock calls (toHaveBeenCalled*, assert_called*, .mock.calls)
 *   b  no assertion, or only a not-to-throw assertion, unless the test name or a comment
 *      states that not throwing is the contract ("does not throw", "never raises")
 *   c  it reads or greps the source under test (readFileSync / open() of a code file,
 *      inspect.getsource, a grep subprocess) instead of executing it
 *
 * Static heuristics, one file at a time, node stdlib only. Comments and string contents
 * are masked before any code pattern is matched, so `"expect("` in a string counts for
 * nothing. Assertion helpers are recognised only when named expect* / assert*.
 *
 * A file with no recognised test case, or a case whose body cannot be seen, is
 * `unchecked`: reported for review, never a reason to delete anything. A file is `drop`
 * only when at least one case was recognised and every recognised case was rejected.
 *
 * Usage: node check-behaviour-tests.mjs [--json] <test-file>...
 * Exit:  0 nothing rejected (keep or unchecked) · 1 at least one test rejected · 2 usage or read error
 */
import { readFileSync, realpathSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const JS_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const PY_EXT = new Set(['.py']);

export function languageFor(filename) {
  const ext = extname(filename).toLowerCase();
  if (JS_EXT.has(ext)) return 'js';
  if (PY_EXT.has(ext)) return 'python';
  return null;
}

// ---------------------------------------------------------------------------
// Masking: same length as the input, newlines kept, comments and string bodies
// blanked. Offsets in the mask are offsets in the original.
// ---------------------------------------------------------------------------

const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await',
]);

function blank(out, a, b) {
  for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
}

function skipQuoted(src, i, q) {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === q) return j + 1;
    if (c === '\n') return j;
    j++;
  }
  return src.length;
}

function skipTemplate(src, i) {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') return j + 1;
    if (c === '$' && src[j + 1] === '{') { j = skipJsCodeToBrace(src, j + 2); continue; }
    j++;
  }
  return src.length;
}

function skipJsCodeToBrace(src, j) {
  let depth = 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'") { j = skipQuoted(src, j, c); continue; }
    if (c === '`') { j = skipTemplate(src, j); continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j + 1;
    j++;
  }
  return src.length;
}

function skipRegex(src, i) {
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const c = src[j];
    if (c === '\n') return -1;
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      j++;
      while (/[a-z]/i.test(src[j] || '')) j++;
      return j;
    }
    j++;
  }
  return -1;
}

export function maskJs(src) {
  const out = src.split('');
  const comments = [];
  const strings = [];
  let lastSig = '';
  let word = '';
  let lastWord = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      const e = src.indexOf('\n', i);
      const end = e === -1 ? src.length : e;
      comments.push([i, end]);
      blank(out, i, end);
      i = end;
      continue;
    }
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e === -1 ? src.length : e + 2;
      comments.push([i, end]);
      blank(out, i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const end = c === '`' ? skipTemplate(src, i) : skipQuoted(src, i, c);
      strings.push([i, end]);
      blank(out, i + 1, Math.max(i + 1, end - 1));
      i = end;
      lastSig = c;
      word = '';
      continue;
    }
    if (c === '/') {
      const regexAllowed = /[\w$]/.test(lastSig)
        ? REGEX_KEYWORDS.has(lastWord)
        : !(lastSig === ')' || lastSig === ']' || lastSig === '}');
      if (regexAllowed) {
        const end = skipRegex(src, i);
        if (end !== -1) {
          blank(out, i + 1, end);
          i = end;
          lastSig = '/';
          word = '';
          continue;
        }
      }
    }
    if (/[\w$]/.test(c)) {
      word += c;
      lastWord = word;
      lastSig = c;
    } else {
      word = '';
      if (!/\s/.test(c)) lastSig = c;
    }
    i++;
  }
  return { masked: out.join(''), comments, strings };
}

export function maskPython(src) {
  const out = src.split('');
  const comments = [];
  const strings = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '#') {
      const e = src.indexOf('\n', i);
      const end = e === -1 ? src.length : e;
      comments.push([i, end]);
      blank(out, i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let end;
      if (src.startsWith(c.repeat(3), i)) {
        let j = i + 3;
        while (j < src.length && !src.startsWith(c.repeat(3), j)) j += src[j] === '\\' ? 2 : 1;
        end = Math.min(src.length, j + 3);
      } else {
        end = skipQuoted(src, i, c);
      }
      strings.push([i, end]);
      blank(out, i + 1, Math.max(i + 1, end - 1));
      i = end;
      continue;
    }
    i++;
  }
  return { masked: out.join(''), comments, strings };
}

// ---------------------------------------------------------------------------
// Small scanning helpers over masked text
// ---------------------------------------------------------------------------

function matchParen(masked, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const close = pairs[masked[open]];
  let depth = 0;
  for (let j = open; j < masked.length; j++) {
    const c = masked[j];
    if (c === masked[open]) depth++;
    else if (c === close && --depth === 0) return j;
  }
  return masked.length - 1;
}

function skipSpace(masked, j) {
  while (j < masked.length && /\s/.test(masked[j])) j++;
  return j;
}

function lineAt(src, offset) {
  let line = 1;
  for (let k = 0; k < offset && k < src.length; k++) if (src[k] === '\n') line++;
  return line;
}

function lineBounds(src, offset) {
  const start = src.lastIndexOf('\n', offset - 1) + 1;
  const e = src.indexOf('\n', offset);
  return [start, e === -1 ? src.length : e];
}

function commentText(src, comments, a, b) {
  return comments.filter(([s, e]) => s < b && e > a).map(([s, e]) => src.slice(s, e)).join('\n');
}

// Comment lines sitting directly above `offset` (a decorator or blank line ends the run
// only when it is not a comment).
function commentsAbove(src, comments, offset) {
  const [lineStart] = lineBounds(src, offset);
  let cursor = lineStart;
  const found = [];
  for (;;) {
    if (cursor === 0) break;
    const [prevStart, prevEnd] = lineBounds(src, cursor - 1);
    const text = src.slice(prevStart, prevEnd).trim();
    const isComment = comments.some(([s, e]) => s <= prevEnd && e > prevStart) &&
      /^(\/\/|\/\*|\*|#)/.test(text);
    const isDecorator = /^@/.test(text);
    if (!isComment && !isDecorator) break;
    if (isComment) found.push(text);
    cursor = prevStart;
  }
  return found.join('\n');
}

// ---------------------------------------------------------------------------
// Test case discovery
// ---------------------------------------------------------------------------

// it / test (Jest, Vitest, Mocha, Playwright, node:test), fit / xit / xtest (Jasmine, Jest),
// Deno.test, and tap's t.test / tap.test. fdescribe / xdescribe are suites, not cases.
const JS_TEST_START =
  /(?<![\w$.])(Deno\.test|(?:t|tap)\.test|it|test|fit|xit|xtest)((?:\.(?:only|skip|ignore|concurrent|sequential|fails|failing|fixme|slow|todo|each|for|(?:skipIf|runIf)\s*\([^()]*\)))*)\s*([(`])/g;
const INLINE_FN = /=>|\bfunction\b|\bfn\s*\(/;

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function topLevelArgs(masked, open, close) {
  const out = [];
  let depth = 0;
  let from = open + 1;
  for (let j = open + 1; j < close; j++) {
    const c = masked[j];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push([from, j]);
      from = j + 1;
    }
  }
  out.push([from, close]);
  return out;
}

// Body range of a function declared in this file under `name`:
// `function name(...) {...}` or `const name = (...) => {...}` / `= function (...) {...}`.
function resolveFunction(masked, name) {
  const id = escapeRegExp(name);
  const decl = new RegExp(`(?<![\\w$.])(?:async\\s+)?function\\s*\\*?\\s*${id}\\s*\\(`).exec(masked);
  if (decl) {
    const paramsClose = matchParen(masked, decl.index + decl[0].length - 1);
    const brace = masked.indexOf('{', paramsClose);
    if (brace !== -1) return { start: decl.index, bodyStart: brace, end: matchParen(masked, brace) + 1 };
  }
  const bound = new RegExp(`(?<![\\w$.])(?:const|let|var)\\s+${id}\\s*=\\s*`).exec(masked);
  if (bound) {
    const from = bound.index + bound[0].length;
    const arrow = /^(?:async\s*)?(?:function\b[^{]*|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*)/.exec(masked.slice(from));
    if (arrow) {
      const at = skipSpace(masked, from + arrow[0].length);
      if (masked[at] === '{') return { start: bound.index, bodyStart: at, end: matchParen(masked, at) + 1 };
      return { start: bound.index, bodyStart: at, end: lineBounds(masked, at)[1] };
    }
  }
  return null;
}

// Names the case callback gives its test context (`(t) =>`, `function (t)`), for tap / ava asserts.
function contextParams(argsText) {
  const names = new Set();
  for (const m of argsText.matchAll(/(?:^|[,(\s])(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)\s*[,)]\s*=>|(?:^|[,(\s])([A-Za-z_$][\w$]*)\s*=>|\bfunction\b[^(]*\(\s*([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1] || m[2] || m[3]);
  }
  return names;
}

function findJsTests(src, masked, strings) {
  const tests = [];
  JS_TEST_START.lastIndex = 0;
  let m;
  while ((m = JS_TEST_START.exec(masked))) {
    const start = m.index;
    const modifiers = m[2] || '';
    let open = m.index + m[0].length - 1;
    if (/\.(each|for)\b/.test(modifiers)) {
      const tableEnd = m[3] === '`' ? masked.indexOf('`', open + 1) : matchParen(masked, open);
      open = skipSpace(masked, tableEnd + 1);
      if (masked[open] !== '(') continue;
    } else if (m[3] !== '(') {
      continue;
    }
    const close = matchParen(masked, open);
    JS_TEST_START.lastIndex = close + 1;
    const args = masked.slice(open + 1, close);
    if (/\.todo\b/.test(modifiers)) continue;
    let first = skipSpace(masked, open + 1);
    const nameKey = masked[first] === '{' ? /\bname\s*:\s*/.exec(args) : null;
    if (nameKey) first = open + 1 + nameKey.index + nameKey[0].length;
    const lit = strings.find(([s]) => s === first);
    const name = lit ? src.slice(lit[0] + 1, lit[1] - 1) : args.trim().split(/[,\s]/)[0];
    const test = { name, start, end: close + 1, ranges: [[open + 1, close]], receivers: contextParams(args) };
    if (!INLINE_FN.test(args)) {
      const parts = topLevelArgs(masked, open, close).map(([a, b]) => masked.slice(a, b).trim());
      const ref = parts.length >= 2 && /^[A-Za-z_$][\w$]*$/.test(parts[1]) ? parts[1] : null;
      if (!ref) continue;
      const fn = resolveFunction(masked, ref);
      if (fn) {
        test.ranges.push([fn.bodyStart, fn.end]);
        test.fnStart = fn.start;
        for (const p of contextParams(masked.slice(fn.start, fn.bodyStart))) test.receivers.add(p);
      } else {
        test.unresolved = ref;
      }
    }
    tests.push(test);
  }
  return tests;
}

const PY_TEST_DEF = /^([ \t]*)(?:async[ \t]+)?def[ \t]+(test\w*)[ \t]*\(/gm;

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function findPythonTests(src, masked) {
  const tests = [];
  PY_TEST_DEF.lastIndex = 0;
  let m;
  while ((m = PY_TEST_DEF.exec(masked))) {
    const defIndent = m[1].length;
    const open = m.index + m[0].length - 1;
    const close = matchParen(masked, open);
    const colon = masked.indexOf(':', close);
    if (colon === -1) continue;
    const [, colonLineEnd] = lineBounds(masked, colon);
    let end = colonLineEnd;
    if (masked.slice(colon + 1, colonLineEnd).trim() === '') {
      let cursor = colonLineEnd + 1;
      while (cursor < masked.length) {
        const [ls, le] = lineBounds(masked, cursor);
        const line = masked.slice(ls, le);
        if (line.trim() !== '' && indentOf(line) <= defIndent) break;
        if (line.trim() !== '') end = le;
        cursor = le + 1;
      }
    }
    tests.push({ name: m[2], start: m.index + defIndent, end, ranges: [[colon + 1, end]], receivers: new Set() });
  }
  return tests;
}

// ---------------------------------------------------------------------------
// Assertion classification
// ---------------------------------------------------------------------------

const JS_MOCK_MATCHER =
  /^(?:toHaveBeenCalled|toBeCalled|toHaveBeenLastCalledWith|toHaveBeenNthCalledWith|lastCalledWith|nthCalledWith|toHaveReturned|toReturn|toHaveLastReturnedWith|toHaveNthReturnedWith|called|calledWith|calledOnce|calledTwice|calledThrice|calledWithExactly|calledWithMatch|calledOnceWith|calledBefore|calledAfter|calledOn|callCount)/;
const JS_MOCK_ARG =
  /\.mock\.(?:calls|lastCall|results|instances|contexts|invocationCallOrder|callCount)\b|\.(?:callCount|calledOnce|calledTwice|calledThrice|calledWith|notCalled|firstCall|secondCall|lastCall|getCall|getCalls|called)\b/;
const JS_MOCK_ASSERT_METHOD =
  /^(?:called|notCalled|calledOnce|calledTwice|calledThrice|calledWith|calledWithExactly|calledWithMatch|calledOnceWithExactly|alwaysCalledWith|neverCalledWith|callCount|callOrder|calledOn|alwaysCalledOn)$/;
const THROW_NAME = /^(?:toThrow\w*|throw|throws)$/;

function readChain(masked, j, calls = []) {
  const names = [];
  for (;;) {
    const k = skipSpace(masked, j);
    if (masked[k] !== '.') break;
    const id = /^[A-Za-z_$][\w$]*/.exec(masked.slice(skipSpace(masked, k + 1)));
    if (!id) break;
    names.push(id[0]);
    j = skipSpace(masked, k + 1) + id[0].length;
    const after = skipSpace(masked, j);
    if (masked[after] === '(' || masked[after] === '[') {
      j = matchParen(masked, after) + 1;
      if (masked[after] === '(') calls.push([after, j - 1]);
    }
  }
  return names;
}

// Tautologies: an assertion whose operands are all literals, or the same name twice, checks
// no code (`expect(true).toBe(true)`, `assert 1 == 1`) and counts as no assertion (rule b).
const JS_LITERAL =
  /^(?:true|false|null|undefined|NaN|-?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?n?|0[xXoObB][\da-fA-F_]+|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`$\\]*`|\/(?:[^/\\\n]|\\.)+\/[a-z]*)$/;
const PY_LITERAL =
  /^(?:True|False|None|-?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?j?|[rRbBuU]{0,2}(?:'[^'\n]*'|"[^"\n]*"))$/;
const PLAIN_NAME = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

function unwrap(masked, raw) {
  let m = masked.trim();
  let r = raw.trim();
  while (m.startsWith('(') && matchParen(m, 0) === m.length - 1) {
    m = m.slice(1, -1).trim();
    r = r.slice(1, -1).trim();
  }
  return r;
}

function argTexts(masked, raw, open, close) {
  if (!masked.slice(open + 1, close).trim()) return [];
  return topLevelArgs(masked, open, close).map(([a, b]) => unwrap(masked.slice(a, b), raw.slice(a, b)));
}

function isTautology(operands, literal) {
  if (operands.length === 0) return false;
  if (operands.every((o) => literal.test(o))) return true;
  return operands.length >= 2 && operands[0] === operands[1] && PLAIN_NAME.test(operands[0]);
}

// Supertest: `request(app).post(...).expect(201)` asserts on the response through the chain.
function httpRoots(src, masked) {
  const roots = new Set(['request', 'supertest']);
  for (const m of src.matchAll(/\bimport\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s+['"]supertest['"]|([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]supertest['"]\s*\)/g)) {
    roots.add(m[1] || m[2]);
  }
  const base = [...roots].map(escapeRegExp).join('|');
  for (const m of masked.matchAll(new RegExp(`(?<![\\w$.])([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?(?:${base})(?:\\s*\\.\\s*agent)?\\s*\\(`, 'g'))) {
    roots.add(m[1]);
  }
  return roots;
}

function classifyChain(names, arg) {
  if (names.some((n) => JS_MOCK_MATCHER.test(n)) || JS_MOCK_ARG.test(arg)) return 'mock';
  if (names.includes('not') && names.some((n) => THROW_NAME.test(n))) return 'noThrow';
  return 'behaviour';
}

// tap and ava assertion methods on the case's context object (`t.equal(...)`, `t.is(...)`).
const CONTEXT_ASSERT =
  /^(?:equal|not|notEqual|same|notSame|strictSame|strictNotSame|strictEqual|notStrictEqual|deepEqual|notDeepEqual|ok|notOk|true|false|truthy|falsy|is|match|notMatch|has|hasStrict|notHas|type|throws|throwsAsync|rejects|resolveMatch|error|like|unlike|regex|notRegex|snapshot|matchSnapshot)$/;
const CONTEXT_NO_THROW = /^(?:doesNotThrow|notThrows|notThrowsAsync|resolves)$/;

function classifyJs(body, receivers = new Set(), raw = body, roots = new Set()) {
  const kinds = [];
  const callKind = (open, close) => {
    const arg = body.slice(open + 1, close);
    if (JS_MOCK_ARG.test(arg)) return 'mock';
    return isTautology(argTexts(body, raw, open, close), JS_LITERAL) ? 'tautology' : 'behaviour';
  };
  for (const r of receivers) {
    for (const m of body.matchAll(new RegExp(`(?<![\\w$.])${escapeRegExp(r)}\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g'))) {
      const open = m.index + m[0].length - 1;
      if (CONTEXT_NO_THROW.test(m[1])) kinds.push('noThrow');
      else if (CONTEXT_ASSERT.test(m[1])) kinds.push(callKind(open, matchParen(body, open)));
    }
  }
  for (const m of body.matchAll(/(?<![\w$.])expect(?:\.(?:soft|poll|element))?\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(body, open);
    const calls = [];
    const names = readChain(body, close + 1, calls);
    if (!names.length) continue;
    const kind = classifyChain(names, body.slice(open + 1, close));
    const subject = argTexts(body, raw, open, close);
    const expected = calls.flatMap(([a, b]) => argTexts(body, raw, a, b));
    const tautology = kind === 'behaviour' && subject.length === 1 &&
      (expected.length === 0 ? JS_LITERAL.test(subject[0]) : isTautology([...subject, ...expected], JS_LITERAL));
    kinds.push(tautology ? 'tautology' : kind);
  }
  if (roots.size) {
    const rootRe = new RegExp(`(?<![\\w$.])(?:${[...roots].map(escapeRegExp).join('|')})(?![\\w$])`, 'g');
    for (const m of body.matchAll(rootRe)) {
      let j = m.index + m[0].length;
      const k = skipSpace(body, j);
      if (body[k] === '(') j = matchParen(body, k) + 1;
      for (const n of readChain(body, j)) if (n === 'expect') kinds.push('behaviour');
    }
  }
  for (const m of body.matchAll(/(?<![\w$.])((?:[A-Za-z_$][\w$]*\.)?)assert((?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)) {
    const method = m[2] ? m[2].split('.').pop() : '';
    const open = m.index + m[0].length - 1;
    const arg = body.slice(open + 1, matchParen(body, open));
    if (m[1] === 'sinon.' || JS_MOCK_ASSERT_METHOD.test(method) || JS_MOCK_ARG.test(arg)) kinds.push('mock');
    else if (method === 'doesNotThrow' || method === 'doesNotReject') kinds.push('noThrow');
    else if (method === 'fail') kinds.push('behaviour');
    else kinds.push(callKind(open, matchParen(body, open)));
  }
  for (const m of body.matchAll(/\.should((?:\.[A-Za-z_$][\w$]*)+)/g)) {
    kinds.push(classifyChain(m[1].split('.').filter(Boolean), ''));
  }
  for (const m of body.matchAll(/(?<![\w$.])(?:expect|assert)[A-Z_][\w$]*\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    kinds.push(callKind(open, matchParen(body, open)));
  }
  return kinds;
}

const PY_COMPARE = /^(.*?\S)\s*(?:==|!=|<=|>=|<|>|\bis\s+not\b|\bis\b|\bnot\s+in\b|\bin\b)\s*(\S.*)$/;

function pyAssertIsTautology(masked, raw) {
  const [[a, b]] = topLevelArgs(`(${masked})`, 0, masked.length + 1).map(([s, e]) => [s - 1, e - 1]);
  const m = masked.slice(a, b).trimEnd();
  const r = raw.slice(a, a + m.length);
  const expr = unwrap(m, r);
  if (PY_LITERAL.test(expr)) return true;
  const mExpr = unwrap(m, m);
  const cmp = PY_COMPARE.exec(mExpr);
  if (!cmp) return false;
  const left = expr.slice(0, cmp[1].length).trim();
  const right = expr.slice(mExpr.length - cmp[2].length).trim();
  return isTautology([left, right], PY_LITERAL);
}

const PY_MOCK_ATTR =
  /\.(?:called|call_count|call_args|call_args_list|mock_calls|method_calls|await_count|await_args|await_args_list|awaited)\b/;
const PY_MOCK_ASSERT =
  /^assert_(?:called|not_called|any_call|has_calls|awaited|not_awaited|has_awaits|any_await)/;

function classifyPython(body, raw = body) {
  const kinds = [];
  for (const m of body.matchAll(/(?<![\w.])assert(?=[\s(])([^\n]*)/g)) {
    const from = m.index + 'assert'.length;
    if (PY_MOCK_ATTR.test(m[1])) kinds.push('mock');
    else kinds.push(pyAssertIsTautology(m[1], raw.slice(from, from + m[1].length)) ? 'tautology' : 'behaviour');
  }
  const callKind = (open, close) =>
    (isTautology(argTexts(body, raw, open, close), PY_LITERAL) ? 'tautology' : 'behaviour');
  for (const m of body.matchAll(/\.(assert\w*)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(body, open);
    const arg = body.slice(open + 1, close);
    kinds.push(PY_MOCK_ASSERT.test(m[1]) || PY_MOCK_ATTR.test(arg) ? 'mock' : callKind(open, close));
  }
  for (const m of body.matchAll(/(?<![\w.])(?:assert|expect)_\w+\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    kinds.push(callKind(open, matchParen(body, open)));
  }
  for (const _ of body.matchAll(/(?<![\w])(?:pytest\.)?(?:raises|warns)\s*\(/g)) kinds.push('behaviour');
  for (const _ of body.matchAll(/(?<![\w])(?:does_not_raise|not_raises|nullcontext)\s*\(/g)) kinds.push('noThrow');
  return kinds;
}

const NO_THROW_CONTRACT =
  /\b(?:(?:does|do|did|should|must|will|can)\s*n[o']?t|never|no|not|without)[\s-]+(?:throws?|throwing|raises?|raising|crash(?:es|ing)?|panics?|rejects?|rejecting)\b|\bwithout\s+(?:an?\s+)?error/i;

// ---------------------------------------------------------------------------
// Rule (c): reading or grepping source instead of executing it
// ---------------------------------------------------------------------------

const JS_READ = /(?<![\w$])(?:readFileSync|readFile|createReadStream|readTextFileSync|readTextFile)\s*\(|(?<![\w$])Bun\.file\s*\(/g;
const PY_READ = /(?<![\w.])(?:io\.)?open\s*\(|\.(?:open|read_text|read_bytes)\s*\(/g;
const PY_GETSOURCE = /(?<![\w])(?:inspect\.)?getsource(?:lines|file)?\s*\(/g;
const PROCESS_CALL =
  /(?<![\w$])(?:execSync|execFileSync|execFile|exec|spawnSync|spawn|execa|execaSync|check_output|check_call|subprocess\.\w+|os\.system|os\.popen)\s*\(/g;
const GREP_TOKEN = /['"`[]\s*(?:grep|egrep|fgrep|rg|ack)\b|['"`]git['"`]\s*,\s*['"`]grep\b|['"`]git\s+grep\b/;
const SOURCE_LITERAL =
  /['"`][^'"`\n]*\.(?:[cm]?[jt]sx?|py|go|rb|rs|java|kt|swift|php|vue|svelte)['"`]/;
const SELF_READ =
  /(?:open|readFileSync|readFile|createReadStream)\s*\(\s*(?:__filename|__file__|import\.meta\.url|fileURLToPath\(\s*import\.meta\.url\s*\))\s*[,)]|Path\(\s*__file__\s*\)\.(?:read_text|open)\s*\(/;
const FIXTURE_PATH = /fixture|testdata|test_data|__snapshots__|golden/i;

function declarationLines(src, name, language) {
  const esc = escapeRegExp(name);
  const re = language === 'js'
    ? new RegExp(`(?:const|let|var)\\s+${esc}\\s*=[^\\n]*`, 'g')
    : new RegExp(`^[ \\t]*${esc}\\s*(?::[^=\\n]+)?=(?!=)[^\\n]*`, 'gm');
  return [...src.matchAll(re)].map((m) => m[0]);
}

function evidenceFor(src, maskedLine, originalLine, language) {
  const seen = new Set();
  let evidence = originalLine;
  let frontier = [maskedLine];
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const text of frontier) {
      for (const [id] of text.matchAll(/[A-Za-z_$][\w$]*/g)) {
        if (seen.has(id)) continue;
        seen.add(id);
        for (const decl of declarationLines(src, id, language)) {
          evidence += `\n${decl}`;
          next.push(decl.replace(/(['"`])[^'"`\n]*\1/g, ''));
        }
      }
    }
    frontier = next;
  }
  return evidence;
}

function bindingOf(lineBeforeCall, language) {
  const m = language === 'js'
    ? /(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=(?![=>])/.exec(lineBeforeCall)
    : /^[ \t]*([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)|\bas\s+([A-Za-z_]\w*)/.exec(lineBeforeCall);
  return m ? m[1] || m[2] : null;
}

function findSourceReads(src, masked, language) {
  const reads = [];
  const add = (offset, always) => {
    const [ls, le] = lineBounds(src, offset);
    const originalLine = src.slice(ls, le);
    const evidence = evidenceFor(src, masked.slice(ls, le), originalLine, language);
    if (FIXTURE_PATH.test(evidence)) return;
    if (!always && !SOURCE_LITERAL.test(evidence) && !SELF_READ.test(originalLine)) return;
    const lineAfterCall = language === 'python' ? src.slice(offset, le) : '';
    const binding = bindingOf(src.slice(ls, offset), language) || bindingOf(lineAfterCall, language);
    reads.push({ offset, line: lineAt(src, offset), text: originalLine.trim(), binding });
  };
  const readRe = language === 'js' ? JS_READ : PY_READ;
  for (const m of masked.matchAll(readRe)) add(m.index, false);
  if (language === 'python') for (const m of masked.matchAll(PY_GETSOURCE)) add(m.index, true);
  for (const m of masked.matchAll(PROCESS_CALL)) {
    const [ls, le] = lineBounds(src, m.index);
    if (GREP_TOKEN.test(src.slice(m.index, le)) || GREP_TOKEN.test(src.slice(ls, le))) add(m.index, true);
  }
  if (language === 'js') {
    for (const m of src.matchAll(/^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+\?raw['"]/gm)) {
      if (masked.slice(m.index, m.index + m[0].length).includes('import')) {
        reads.push({ offset: m.index, line: lineAt(src, m.index), text: m[0].trim(), binding: m[1] });
      }
    }
  }
  return reads;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

function covers(test, offset) {
  return (offset >= test.start && offset < test.end) || test.ranges.some(([a, b]) => offset >= a && offset < b);
}

function verdictFor(test, ctx) {
  const { src, masked, comments, strings, language, reads } = ctx;
  if (test.unresolved) {
    return { verdict: 'unchecked', rule: null, reason: `body is ${test.unresolved}, not declared in this file; review it by hand` };
  }
  const body = test.ranges.map(([a, b]) => masked.slice(a, b)).join('\n');
  const inside = reads.filter((r) => covers(test, r.offset));
  const viaBinding = reads.filter((r) => !r.inTest && r.binding &&
    new RegExp(`(?<![\\w$.])${escapeRegExp(r.binding)}(?![\\w$])`).test(body));
  const read = inside[0] || viaBinding[0];
  if (read) {
    return { verdict: 'reject', rule: 'c', reason: `reads source text instead of executing it (line ${read.line}: ${read.text})` };
  }
  const raw = test.ranges.map(([a, b]) => src.slice(a, b)).join('\n');
  const kinds = language === 'js' ? classifyJs(body, test.receivers, raw, ctx.roots) : classifyPython(body, raw);
  const behaviour = kinds.filter((k) => k === 'behaviour').length;
  const mock = kinds.filter((k) => k === 'mock').length;
  if (behaviour > 0) return { verdict: 'keep', rule: null, reason: `asserts behaviour (${behaviour} assertion${behaviour === 1 ? '' : 's'})` };
  if (mock > 0) return { verdict: 'reject', rule: 'a', reason: `only mock-call assertions (${mock}); nothing asserts an observable result` };
  let contractText = [
    test.name,
    ...test.ranges.map(([a, b]) => commentText(src, comments, a, b)),
    commentText(src, comments, test.start, test.end),
    commentsAbove(src, comments, test.start),
    test.fnStart === undefined ? '' : commentsAbove(src, comments, test.fnStart),
  ].join('\n');
  if (language === 'python') {
    const first = skipSpace(masked, test.ranges[0][0]);
    const doc = strings.find(([s]) => s === first);
    if (doc) contractText += `\n${src.slice(doc[0], doc[1])}`;
  }
  if (NO_THROW_CONTRACT.test(contractText.replace(/_/g, ' '))) {
    return { verdict: 'keep', rule: null, reason: 'not throwing is the stated contract' };
  }
  const noThrow = kinds.filter((k) => k === 'noThrow').length;
  const tautology = kinds.filter((k) => k === 'tautology').length;
  if (noThrow > 0) {
    return { verdict: 'reject', rule: 'b', reason: 'only a not-to-throw assertion, and not throwing is not the stated contract' };
  }
  return tautology > 0
    ? { verdict: 'reject', rule: 'b', reason: `only tautological assertions (${tautology}): they compare literals or a value with itself and check no code` }
    : { verdict: 'reject', rule: 'b', reason: 'no assertion: the test runs code but checks nothing' };
}

export function checkTestSource(src, { filename = '<source>', language = languageFor(filename) } = {}) {
  if (!language) {
    return { file: filename, language: null, verdict: 'unchecked', reason: `unsupported language (${extname(filename) || 'no extension'})`, tests: [] };
  }
  const { masked, comments, strings } = language === 'js' ? maskJs(src) : maskPython(src);
  const found = language === 'js' ? findJsTests(src, masked, strings) : findPythonTests(src, masked);
  const reads = findSourceReads(src, masked, language).map((r) => ({
    ...r,
    inTest: found.some((t) => covers(t, r.offset)),
  }));
  const roots = language === 'js' ? httpRoots(src, masked) : new Set();
  const ctx = { src, masked, comments, strings, language, reads, roots };
  const tests = found.map((t) => ({ name: t.name, line: lineAt(src, t.start), ...verdictFor(t, ctx) }));
  const rejected = tests.filter((t) => t.verdict === 'reject').length;
  const unchecked = tests.filter((t) => t.verdict === 'unchecked').length;
  let verdict = 'keep';
  let reason = unchecked
    ? `${tests.length - unchecked} of ${tests.length} tests assert behaviour, ${unchecked} unchecked`
    : `${tests.length} test${tests.length === 1 ? '' : 's'}, all assert behaviour`;
  // Zero recognised cases means the parser did not understand the file, not that it is
  // hollow: report it and never let the skill delete it.
  if (tests.length === 0) {
    verdict = 'unchecked';
    reason = 'no test cases recognised; review it by hand, never delete it';
  } else if (rejected === tests.length) {
    verdict = 'drop';
    reason = `all ${tests.length} tests rejected`;
  } else if (rejected > 0) {
    verdict = 'partial';
    reason = `${rejected} of ${tests.length} tests rejected`;
  } else if (unchecked === tests.length) {
    verdict = 'unchecked';
    reason = `${unchecked} test${unchecked === 1 ? '' : 's'} with a body declared elsewhere; review by hand, never delete`;
  }
  return { file: filename, language, verdict, reason, tests };
}

export function checkFile(path) {
  return checkTestSource(readFileSync(path, 'utf8'), { filename: path });
}

function formatReport(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${r.verdict.toUpperCase().padEnd(9)} ${r.file}  (${r.reason})`);
    for (const t of r.tests) {
      if (t.verdict === 'reject') lines.push(`  reject [${t.rule}] line ${t.line} "${t.name}": ${t.reason}`);
      else if (t.verdict === 'unchecked') lines.push(`  unchecked line ${t.line} "${t.name}": ${t.reason}`);
    }
  }
  const count = (v) => results.filter((r) => r.verdict === v).length;
  lines.push(`behaviour gate: ${results.length} files, ${count('keep')} keep, ${count('partial')} partial, ${count('drop')} drop, ${count('unchecked')} unchecked`);
  return lines.join('\n');
}

export function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => a !== '--json');
  if (files.length === 0) {
    process.stderr.write('usage: check-behaviour-tests.mjs [--json] <test-file>...\n');
    return 2;
  }
  const results = [];
  for (const f of files) {
    try {
      results.push(checkFile(f));
    } catch (err) {
      process.stderr.write(`cannot read ${f}: ${err.message}\n`);
      return 2;
    }
  }
  process.stdout.write(`${json ? JSON.stringify(results, null, 2) : formatReport(results)}\n`);
  return results.some((r) => r.verdict === 'drop' || r.verdict === 'partial') ? 1 : 0;
}

function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = main(process.argv.slice(2));

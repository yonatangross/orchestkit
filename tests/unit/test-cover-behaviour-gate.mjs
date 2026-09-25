#!/usr/bin/env node
// ============================================================================
// ork:cover behaviour gate unit tests (offline, fixture-driven)
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/cover/scripts/check-behaviour-tests.mjs is the checkable half of
//   the cover authoring gate (SKILL.md Phase 3b). It must reject a generated
//   test that (a) asserts only on mock calls, (b) asserts nothing or only
//   not-to-throw without a stated no-throw contract, or (c) reads or greps the
//   source under test, and it must KEEP a test that asserts an observable
//   result. Both directions regress silently: a missed rule lets hollow tests
//   through, an over-eager rule makes cover delete good tests.
//
// HOW
//
//   Each fixture under tests/fixtures/cover-behaviour-gate/ is fed through the
//   exported checkTestSource and through the CLI, and the per-test verdicts
//   are compared with the expected ones. Inline cases pin parser edges.
// ============================================================================

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as gate from '../../src/skills/cover/scripts/check-behaviour-tests.mjs';

const { checkFile, checkTestSource } = gate;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'cover-behaviour-gate');
const CLI = path.join(ROOT, 'src', 'skills', 'cover', 'scripts', 'check-behaviour-tests.mjs');

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

const verdicts = (result) => Object.fromEntries(result.tests.map((t) => [t.name, t.rule || t.verdict]));
const fixture = (name) => checkFile(path.join(FIXTURES, name));
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

// --- fixtures: one per rule and language ------------------------------------

const EXPECTED = {
  'behaviour.ts': ['keep', {
    'returns the discounted total': 'keep',
    'rejects a negative rate with a RangeError': 'keep',
    'sends the receipt and returns its id': 'keep',
    'ignores "expect(" and a regex with a paren /\\\\(/ in strings': 'keep',
    'parses %s': 'keep',
    'does not throw on an empty cart': 'keep',
    'parses with a node assert': 'keep',
  }],
  'mock-only.ts': ['drop', {
    'calls the payment gateway': 'a',
    'logs once': 'a',
    'passes the total through': 'a',
  }],
  'assertion-free.ts': ['drop', {
    'runs applyDiscount': 'b',
    'handles a large order': 'b',
    'counts assertions but makes none': 'b',
  }],
  'reads-source.ts': ['partial', {
    'exports applyDiscount': 'c',
    'has no TODO left in pricing': 'c',
    'guards the rate inline': 'c',
    'still computes a total': 'keep',
  }],
  'behaviour.py': ['keep', {
    test_returns_discounted_total: 'keep',
    test_negative_rate_raises: 'keep',
    test_sends_receipt_and_returns_id: 'keep',
    test_empty_cart: 'keep',
    test_parses_cents: 'keep',
    test_comment_mentions_assert_called_but_asserts_value: 'keep',
  }],
  'mock_only.py': ['drop', {
    test_calls_gateway: 'a',
    test_logs_once: 'a',
    test_audits: 'a',
  }],
  'assertion_free.py': ['drop', {
    test_runs_apply_discount: 'b',
    test_large_order: 'b',
    test_only_prints: 'b',
  }],
  'reads_source.py': ['partial', {
    test_defines_apply_discount: 'c',
    test_guard_is_present: 'c',
    test_no_print_calls: 'c',
    test_opens_the_module: 'c',
    test_still_computes_a_total: 'keep',
  }],
  // Runner shapes beyond it/test: each asserts behaviour, so each must be kept.
  'deno.ts': ['keep', { adds: 'keep' }],
  'tap.js': ['keep', { adds: 'keep' }],
  'fit.js': ['keep', { adds: 'keep' }],
  'named.js': ['keep', { adds: 'keep' }],
  'suites.js': ['keep', { adds: 'keep', subtracts: 'keep' }],
  // No recognised case: reported for review, never dropped (dropping deletes the file).
  'no-tests.ts': ['unchecked', {}],
  // Supertest asserts status, headers and body through `.expect(...)` on the request chain.
  'supertest.js': ['keep', { 'creates a user': 'keep', 'rejects bad input': 'keep' }],
  'supertest-agent.js': ['keep', { 'keeps the session cookie': 'keep', 'lists users': 'keep' }],
  // A literal compared with a literal (or a name with itself) checks no code: rule (b).
  'tautology.js': ['drop', {
    'always passes': 'b',
    'also passes': 'b',
    'compares two literals': 'b',
    'is truthy': 'b',
    'compares a name with itself': 'b',
    'node asserts on literals': 'b',
  }],
  'tautology.py': ['drop', {
    test_always: 'b',
    test_one_is_one: 'b',
    test_same_string: 'b',
    test_same_name: 'b',
    test_unittest_literal: 'b',
  }],
  'mixed.ts': ['keep', { 'discounts and keeps a leftover sanity check': 'keep' }],
};

for (const [file, [fileVerdict, perTest]] of Object.entries(EXPECTED)) {
  const result = fixture(file);
  check(`${file}: file verdict`, result.verdict, fileVerdict);
  check(`${file}: per-test verdicts`, verdicts(result), perTest);
}

check('a stated no-throw contract keeps a not.toThrow-only test',
  fixture('behaviour.ts').tests.find((t) => t.name === 'does not throw on an empty cart').reason,
  'not throwing is the stated contract');
check('a docstring contract keeps an assertion-free python test',
  fixture('behaviour.py').tests.find((t) => t.name === 'test_empty_cart').reason,
  'not throwing is the stated contract');
check('rule (c) names the reading line', fixture('reads-source.ts').tests[0].reason,
  "reads source text instead of executing it (line 9: const SRC = readFileSync(PRICING, 'utf8');)");
check('unsupported languages are reported, not judged', fixture('unsupported.go').verdict, 'unchecked');

// --- inline edges -----------------------------------------------------------

const js = (src) => verdicts(checkTestSource(src, { filename: 'x.spec.ts' }));
const py = (src) => verdicts(checkTestSource(src, { filename: 'x_test.py' }));

check('playwright describe and conditional skip are not test cases', js(`
test.describe('cart', () => {
  test.skip(process.env.CI === '1', 'flaky on CI');
  test('shows the total', async ({ page }) => {
    await expect(page.getByRole('status')).toHaveText('$10');
  });
  test('clicks checkout', async ({ page }) => {
    await page.getByRole('button', { name: 'Checkout' }).click();
  });
});`), { 'shows the total': 'keep', 'clicks checkout': 'b' });

check('sinon and chai spy assertions are mock-only', js(`
it('sinon', () => { run(spy); sinon.assert.calledWith(spy, 1); });
it('chai', () => { run(spy); expect(spy).to.have.been.calledOnce; });
it('chai value', () => { expect(run(1)).to.equal(2); });`), { sinon: 'a', chai: 'a', 'chai value': 'keep' });

check('a raw source import feeds rule (c) through its binding', js(`
import pricingSource from '../src/pricing.ts?raw';
it('mentions rate', () => { expect(pricingSource).toContain('rate'); });
it('computes', () => { expect(total(1)).toBe(1); });`), { 'mentions rate': 'c', computes: 'keep' });

check('a read inside one test does not taint another test using the same name', js(`
it('reads', () => { const text = readFileSync('src/a.ts', 'utf8'); expect(text).toBe(''); });
it('renders', () => { const text = render(); expect(text).toBe('ok'); });`), { reads: 'c', renders: 'keep' });

check('reading data next to the test file is not a source read', py(`
DATA = (Path(__file__).parent / "cases.json").read_text()
def test_parses(): assert parse(DATA) == []`), { test_parses: 'keep' });

check('a python test body ends at the next dedent', py(`
def test_first():
    value = compute()

assert compute() == 1

def test_second():
    assert compute() == 1`), { test_first: 'b', test_second: 'keep' });

check('a file with no recognised test case is unchecked, never dropped',
  checkTestSource('export const x = 1;\n', { filename: 'x.test.ts' }).verdict, 'unchecked');

check('a named function body is gated like an inline one', js(`
function callsGateway() { charge(1); expect(gateway.charge).toHaveBeenCalled(); }
const $adds = async () => { expect(await add(1, 2)).toBe(3); };
function runsOnly() { add(1, 2); }
it('mock only', callsGateway);
it('dollar named arrow', $adds);
test('runs only', runsOnly);`), { 'mock only': 'a', 'dollar named arrow': 'keep', 'runs only': 'b' });

check('a source read inside a named function body is rule (c)', js(`
function readsPricing() { expect(readFileSync('src/pricing.ts', 'utf8')).toContain('rate'); }
it('mentions rate', readsPricing);`), { 'mentions rate': 'c' });

const imported = checkTestSource(`import { sharedCase } from './cases.js';\nit('shared', sharedCase);\n`, { filename: 'x.test.js' });
check('a body imported from another file is unchecked, never rejected',
  [imported.verdict, verdicts(imported)], ['unchecked', { shared: 'unchecked' }]);

check('tap and ava context assertions are judged by method', js(`
t.test('equal', (t) => { t.equal(add(1, 2), 3); t.end(); });
t.test('pass only', (t) => { add(1, 2); t.pass(); t.end(); });
test('ava is', (t) => { t.is(add(1, 2), 3); });
test('ava wrapped call', (t) => { t.notThrows(() => add(1, 2)); });`),
{ equal: 'keep', 'pass only': 'b', 'ava is': 'keep', 'ava wrapped call': 'b' });

check('Deno.test with an options object takes its name and fn body', js(`
Deno.test({ name: 'adds', fn() { assertEquals(add(1, 2), 3); } });
Deno.test({ name: 'runs', fn: () => { add(1, 2); } });`), { adds: 'keep', runs: 'b' });

check('a tautology-only test names the tautology in its reason',
  fixture('tautology.js').tests[0].reason,
  'only tautological assertions (1): they compare literals or a value with itself and check no code');

check('a mixed test is kept on its real assertion, and the tautology is not counted',
  fixture('mixed.ts').tests[0].reason, 'asserts behaviour (1 assertion)');

check('.expect counts only on a supertest chain, and a request alone asserts nothing', js(`
import request from 'supertest';
it('sends only', async () => { await request(app).post('/x').send({}); });
it('other chain', () => { builder().expect(200); });
it('status', () => request(app).get('/').expect(200));`), { 'sends only': 'b', 'other chain': 'b', status: 'keep' });

check('a literal on one side of a real comparison is still behaviour', js(`
it('js', () => { expect(add(1, 2)).toBe(3); });
it('literal first', () => { expect(3).toBe(add(1, 2)); });
it('different names', () => { expect(result).toBe(expected); });`), { js: 'keep', 'literal first': 'keep', 'different names': 'keep' });

check('a python comparison against code is still behaviour', py(`
def test_eq(): assert add(1, 2) == 3
def test_in(): assert "a" in render()
def test_call(): assert is_valid("x")`), { test_eq: 'keep', test_in: 'keep', test_call: 'keep' });

const META = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o/p';
const escape = typeof gate.escapeRegExp === 'function' ? gate.escapeRegExp : () => null;
check('escapeRegExp escapes every regex metacharacter', [
  new RegExp(`^${escape(META)}$`).test(META),
  new RegExp(`^${escape(META)}$`).test(META.replace('.', 'X')),
  new RegExp(`^${escape('a|b')}$`).test('a'),
], [true, false, false]);

// --- CLI contract -----------------------------------------------------------

const all = Object.keys(EXPECTED).map((f) => path.join(FIXTURES, f));
const jsonRun = run(['--json', ...all]);
check('CLI exits 1 when any test is rejected', jsonRun.status, 1);
check('CLI --json reports the same verdicts as the module',
  JSON.parse(jsonRun.stdout).map((r) => [path.basename(r.file), r.verdict, verdicts(r)]),
  Object.entries(EXPECTED).map(([f, [v, t]]) => [f, v, t]));

const cleanRun = run([path.join(FIXTURES, 'behaviour.ts'), path.join(FIXTURES, 'behaviour.py'), path.join(FIXTURES, 'unsupported.go')]);
check('CLI exits 0 when every checked test asserts behaviour', cleanRun.status, 0);
check('CLI summary counts keep and unchecked files', cleanRun.stdout.trim().split('\n').pop(),
  'behaviour gate: 3 files, 2 keep, 0 partial, 0 drop, 1 unchecked');

check('CLI lists each rejected test with its rule and line',
  run([path.join(FIXTURES, 'mock_only.py')]).stdout.split('\n')[1],
  '  reject [a] line 7 "test_calls_gateway": only mock-call assertions (1); nothing asserts an observable result');
const uncheckedRun = run([path.join(FIXTURES, 'no-tests.ts')]);
check('CLI exits 0 and reports a file with no recognised test as unchecked',
  [uncheckedRun.status, uncheckedRun.stdout.trim().split('\n').pop()],
  [0, 'behaviour gate: 1 files, 0 keep, 0 partial, 0 drop, 1 unchecked']);
check('CLI exits 2 with no files', run([]).status, 2);
check('CLI exits 2 on an unreadable file', run([path.join(FIXTURES, 'missing.ts')]).status, 2);

// --- report -----------------------------------------------------------------
console.log(`  passed: ${passed}`);
console.log(`  failed: ${failures.length}\n`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('cover behaviour gate: all assertions passed');

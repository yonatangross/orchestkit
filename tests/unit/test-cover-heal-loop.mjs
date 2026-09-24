#!/usr/bin/env node
// ============================================================================
// cover heal-loop: value mismatches are never healed (offline, stubbed agent)
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/cover/workflows/heal-loop.js is the /ork:cover Phase 5 repair
//   loop. It used to tell the repair agent "assertion -> correct the expected
//   value against real source behavior", which turns a product bug into a
//   green test by rewriting what the test expects. The rule now:
//
//   1. A value mismatch (assertion, source-bug) is never sent for repair. It
//      lands in possible_product_bugs as "possible product bug: expected X,
//      got Y (file:line)" and the test stays failing.
//   2. A repair the agent reports as rewriting an expected value, snapshot,
//      or a withheld test is rejected by the SCRIPT, reverted, and moved to
//      possible_product_bugs.
//   3. import / setup / flaky failures are still repaired, and the 3 diagnose
//      / 2 repair iteration bound is unchanged.
//
// HOW
//
//   The workflow script runs as an async function body with args, agent,
//   phase and log injected, the same shape the Workflow runtime gives it.
//   agent() is a stub that answers from scripted queues keyed by the label
//   prefix (run, repair, revert) and records every prompt. No LLM is called.
// ============================================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'src', 'skills', 'cover', 'workflows', 'heal-loop.js');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const body = new AsyncFunction(
  'args',
  'agent',
  'phase',
  'log',
  readFileSync(SCRIPT, 'utf8').replace(/^export const meta/m, 'const meta'),
);

async function runLoop({ args = {}, runs = [], repairs = [], reverts = [] }) {
  const calls = [];
  const queues = { run: [...runs], repair: [...repairs], revert: [...reverts] };
  const agent = async (prompt, opts) => {
    const kind = String(opts.label).split(':')[0];
    calls.push({ kind, prompt, opts });
    const q = queues[kind];
    if (!q) throw new Error(`unexpected agent label ${opts.label}`);
    if (!q.length) throw new Error(`no scripted ${kind} response left for ${opts.label}`);
    return q.shift();
  };
  const logs = [];
  const result = await body(args, agent, () => {}, (m) => logs.push(String(m)));
  return { result, calls, kinds: calls.map((c) => c.kind), logs };
}

const ASSERT_A = {
  test: 'POST /users returns 409 on duplicate',
  file: 'tests/unit/users.test.ts',
  line: 12,
  category: 'assertion',
  message: 'AssertionError: expected 409, got 422',
  expected: '409',
  actual: '422',
};
const ASSERT_JEST = {
  test: 'cart total counts items',
  file: 'tests/unit/cart.test.ts',
  line: 40,
  category: 'assertion',
  message: 'expect(received).toBe(expected)\n\nExpected: 3\nReceived: 2',
};
const IMPORT_B = {
  test: 'loads auth',
  file: 'tests/unit/auth.test.ts',
  line: 3,
  category: 'import',
  message: "Error: Cannot find module './auth'",
};
const SETUP_D = {
  test: 'db roundtrip',
  file: 'tests/unit/db.test.ts',
  line: 8,
  category: 'setup',
  message: 'connect ECONNREFUSED 127.0.0.1:5432',
};
const FLAKY_E = {
  test: 'debounce fires once',
  file: 'tests/unit/debounce.test.ts',
  line: 20,
  category: 'flaky',
  message: 'Error: Test timed out in 1000ms waiting for the debounce callback (fails 1 run in 3)',
};

const red = (failures) => ({
  passed: false,
  pass_count: 5,
  fail_count: failures.length,
  exit_code: 1,
  failures,
  raw_output: failures.map((f) => f.message).join('\n'),
});
const GREEN = { passed: true, pass_count: 8, fail_count: 0, exit_code: 0, failures: [], raw_output: '8 passed' };

const fix = (f, over = {}) => ({
  file: f.file,
  test: f.test,
  line: f.line,
  category: f.category,
  change: 'fixed the import path',
  before: "import { login } from './auth'",
  after: "import { login } from '../../src/auth'",
  touches_expected_value: false,
  ...over,
});
const repairOf = (fixes, bugs = []) => ({
  files_edited: Array.from(new Set(fixes.map((x) => x.file))),
  fixes,
  possible_product_bugs: bugs,
  unfixable: [],
});

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
}

async function scenario(name, fn) {
  try {
    await fn();
  } catch (err) {
    failures.push(`${name}\n      threw ${err && err.message}`);
  }
}

// (1) An assertion failure is never sent for repair and becomes a possible product bug.
await scenario('assertion only', async () => {
  const { result, kinds } = await runLoop({ runs: [red([ASSERT_A])] });
  check('assertion only: no repair agent is spawned', kinds, ['run']);
  check('assertion only: not healed', [result.status, result.healed], ['failed', false]);
  check('assertion only: test stays failing', result.remaining_failures.map((f) => f.test), [ASSERT_A.test]);
  check(
    'assertion only: report names expected, got and file:line',
    result.possible_product_bugs.map((b) => b.report),
    ['possible product bug: expected 409, got 422 (tests/unit/users.test.ts:12)'],
  );
});

await scenario('assertion mixed with import', async () => {
  const { result, calls, kinds } = await runLoop({
    runs: [red([ASSERT_A, IMPORT_B]), red([ASSERT_A])],
    repairs: [repairOf([fix(IMPORT_B)])],
  });
  const repairPrompts = calls.filter((c) => c.kind === 'repair').map((c) => c.prompt);
  check('mixed: one repair, then stop when only the value mismatch is left', kinds, ['run', 'repair', 'run']);
  check('mixed: repair prompt carries the import failure', repairPrompts[0].includes(IMPORT_B.message), true);
  check('mixed: repair prompt never carries the assertion diff', repairPrompts.some((p) => p.includes(ASSERT_A.message)), false);
  check('mixed: repair prompt never carries the expected or actual value', repairPrompts.some((p) => /expected 409|got 422/.test(p)), false);
  check('mixed: assertion test is on the do not touch list', repairPrompts[0].includes('tests/unit/users.test.ts:12'), true);
  check('mixed: flagged once across iterations', result.possible_product_bugs.length, 1);
  check('mixed: origin is the classification', result.possible_product_bugs[0].origin, 'classified');
  check('mixed: not healed, assertion still failing', [result.healed, result.remaining_failures.map((f) => f.category)], [false, ['assertion']]);
});

await scenario('assertion without expected/actual fields', async () => {
  const { result } = await runLoop({ runs: [red([ASSERT_JEST])] });
  check(
    'jest diff: expected and received are read from the verbatim message',
    result.possible_product_bugs.map((b) => b.report),
    ['possible product bug: expected 3, got 2 (tests/unit/cart.test.ts:40)'],
  );
});

// (2) A repair that edits an expected value is rejected, reverted and reported.
await scenario('expected value rewrite on a flaky failure', async () => {
  const rewrite = fix(FLAKY_E, {
    change: 'made the assertion match the observed call count',
    before: 'expect(spy).toHaveBeenCalledTimes(1)',
    after: 'expect(spy).toHaveBeenCalledTimes(0)',
    touches_expected_value: true,
  });
  const { result, calls, kinds } = await runLoop({
    runs: [red([IMPORT_B, FLAKY_E]), red([FLAKY_E])],
    repairs: [repairOf([fix(IMPORT_B), rewrite])],
    reverts: [{ reverted: [{ file: FLAKY_E.file, line: FLAKY_E.line, restored: true }] }],
  });
  const revert = calls.find((c) => c.kind === 'revert');
  check('rewrite: revert agent runs, then no repair of the rejected item', kinds, ['run', 'repair', 'revert', 'run']);
  check('rewrite: revert prompt names the rewritten text', !!revert && revert.prompt.includes(rewrite.after), true);
  check('rewrite: revert prompt leaves the accepted import fix alone', !!revert && revert.prompt.includes(IMPORT_B.file), false);
  check('rewrite: ledger counts one kept and one rejected fix', [result.iteration_ledger[0].accepted_fixes, result.iteration_ledger[0].rejected_fixes], [1, 1]);
  const bug = result.possible_product_bugs.find((b) => b.file === FLAKY_E.file);
  check('rewrite: item moved to possible product bugs', bug && [bug.origin, bug.test], ['rejected-repair', FLAKY_E.test]);
  check('rewrite: revert confirmed from the revert agent', bug && bug.rejected_fix.revert_confirmed, true);
  check('rewrite: report names file:line', bug && bug.report.endsWith('(tests/unit/debounce.test.ts:20)'), true);
  check('rewrite: not healed', result.healed, false);
});

const smuggled = [
  ['category assertion', fix(ASSERT_A, { change: 'aligned the status code', before: 'toBe(409)', after: 'toBe(422)' })],
  ['withheld test under another category', fix(ASSERT_A, { category: 'type', change: 'tidied the test', before: 'toBe(409)', after: 'toBe(422)' })],
  ['snapshot update', fix(IMPORT_B, { change: 'ran vitest -u to update the snapshot', before: '', after: '' })],
];
for (const [label, bad] of smuggled) {
  await scenario(`rejected: ${label}`, async () => {
    const { result, kinds } = await runLoop({
      runs: [red([ASSERT_A, IMPORT_B]), red([ASSERT_A])],
      repairs: [repairOf([fix(IMPORT_B, { test: 'other import', line: 99 }), bad])],
      reverts: [{ reverted: [{ file: bad.file, line: bad.line, restored: true }] }],
    });
    check(`rejected ${label}: script reverts it`, kinds, ['run', 'repair', 'revert', 'run']);
    check(`rejected ${label}: ledger counts it rejected`, result.iteration_ledger[0].rejected_fixes, 1);
    check(`rejected ${label}: not healed`, result.healed, false);
  });
}

await scenario('value mismatch that vanishes', async () => {
  const { result } = await runLoop({
    runs: [red([ASSERT_A, IMPORT_B]), GREEN],
    repairs: [repairOf([fix(IMPORT_B)])],
  });
  check('vanished: a green run after a flagged value mismatch is not a heal', [result.status, result.healed], ['failed', false]);
  check('vanished: flagged and gate cannot read it as clean', [result.value_mismatch_vanished, result.fail_count, result.state_known], [true, -1, false]);
});

await scenario('value mismatch that vanishes while the suite stays red', async () => {
  const TYPE_C = {
    test: 'profile factory shape',
    file: 'tests/unit/profile.test.ts',
    line: 31,
    category: 'type',
    message: "TypeError: Property 'avatarUrl' does not exist on type 'Profile'",
  };
  const { result, kinds } = await runLoop({
    args: { maxIterations: 2 },
    runs: [red([ASSERT_A, IMPORT_B]), red([TYPE_C])],
    repairs: [repairOf([fix(IMPORT_B)])],
  });
  check('red vanish: run, repair, final run', kinds, ['run', 'repair', 'run']);
  check('red vanish: value_mismatch_vanished is set on a red run', result.value_mismatch_vanished, true);
  check(
    'red vanish: the vanished test is named',
    result.vanished_value_mismatches.map((v) => [v.test, v.file, v.line, v.vanished_at_iteration]),
    [[ASSERT_A.test, ASSERT_A.file, ASSERT_A.line, 2]],
  );
  check('red vanish: A is not reported as still failing', result.remaining_failures.map((f) => f.test), [TYPE_C.test]);
  const bugA = result.possible_product_bugs.find((b) => b.test === ASSERT_A.test);
  check('red vanish: possible product bug entry says not still failing', bugA && bugA.still_failing, false);
  check('red vanish: gate cannot read it as clean', [result.healed, result.fail_count, result.state_known], [false, -1, false]);
});

await scenario('rejected-repair entries never count as vanished', async () => {
  const rewrite = fix(FLAKY_E, { change: 'matched the observed count', before: 'toHaveBeenCalledTimes(1)', after: 'toHaveBeenCalledTimes(0)', touches_expected_value: true });
  const { result } = await runLoop({
    args: { maxIterations: 2 },
    runs: [red([IMPORT_B, FLAKY_E]), red([IMPORT_B])],
    repairs: [repairOf([rewrite])],
    reverts: [{ reverted: [{ file: FLAKY_E.file, line: FLAKY_E.line, restored: true }] }],
  });
  check('rejected only: no vanished flag from a rejected-repair entry', [result.value_mismatch_vanished, result.vanished_value_mismatches], [false, []]);
});

// estate-5 (HOLD on #4407): labels are the agent's; the script must read the code and the message.
const REVERT_E = [{ reverted: [{ file: FLAKY_E.file, line: FLAKY_E.line, restored: true }] }];

await scenario('estate-5: flaky fix changing toHaveBeenCalledTimes(1) to (0)', async () => {
  const { result, kinds } = await runLoop({
    runs: [red([FLAKY_E]), GREEN],
    repairs: [
      repairOf([
        fix(FLAKY_E, {
          change: 'stabilised the debounce test',
          before: 'expect(spy).toHaveBeenCalledTimes(1)',
          after: 'expect(spy).toHaveBeenCalledTimes(0)',
        }),
      ]),
    ],
    reverts: REVERT_E,
  });
  check('estate-5 calls: rejected and reverted, never verified green', kinds, ['run', 'repair', 'revert']);
  check('estate-5 calls: not healed', [result.status, result.healed], ['failed', false]);
  const bug = result.possible_product_bugs.find((b) => b.test === FLAKY_E.test);
  check('estate-5 calls: moved to possible product bugs', bug && bug.origin, 'rejected-repair');
  check('estate-5 calls: reason names the changed assertion', !!bug && bug.reason.includes('toHaveBeenCalledTimes(1)'), true);
});

await scenario('estate-5 calls rewrite next to a legit import fix', async () => {
  const { result, kinds } = await runLoop({
    runs: [red([IMPORT_B, FLAKY_E]), red([FLAKY_E])],
    repairs: [
      repairOf([
        fix(IMPORT_B),
        fix(FLAKY_E, {
          change: 'stabilised the debounce test',
          before: 'expect(spy).toHaveBeenCalledTimes(1)',
          after: 'expect(spy).toHaveBeenCalledTimes(0)',
        }),
      ]),
    ],
    reverts: REVERT_E,
  });
  check('mixed vet: import kept, assertion rewrite rejected', [result.iteration_ledger[0].accepted_fixes, result.iteration_ledger[0].rejected_fixes], [1, 1]);
  check('mixed vet: rejected item never repaired again', kinds, ['run', 'repair', 'revert', 'run']);
});

await scenario('estate-5: 409 vs 422 labelled flaky', async () => {
  const MISLABELLED = {
    test: 'POST /users conflict',
    file: 'tests/unit/users.test.ts',
    line: 30,
    category: 'flaky',
    message: 'AssertionError: expected 409, got 422',
  };
  const { result, kinds } = await runLoop({
    runs: [red([MISLABELLED]), GREEN],
    repairs: [
      repairOf([
        fix(MISLABELLED, { change: 'stabilised the response wait', before: 'expect(res.status).toBe(409)', after: 'expect(res.status).toBe(422)' }),
      ]),
    ],
  });
  check('estate-5 409: withheld from repair whatever the label', kinds, ['run']);
  check(
    'estate-5 409: flagged with expected and got',
    result.possible_product_bugs.map((b) => [b.report, b.classified_by]),
    [['possible product bug: expected 409, got 422 (tests/unit/users.test.ts:30)', 'message']],
  );
  check('estate-5 409: not healed, still failing', [result.healed, result.remaining_failures.map((f) => f.test)], [false, [MISLABELLED.test]]);
});

const valueMessages = [
  ['pytest assert', 'E       assert 422 == 409', 'possible product bug: expected 409, got 422 (tests/unit/api.test.py:5)'],
  ['unittest assertEqual', 'AssertionError: 422 != 409', 'possible product bug: expected 409, got 422 (tests/unit/api.test.py:5)'],
  ['status code mismatch', 'expected status code 409 but the response status was 422', 'possible product bug: expected 409, got 422 (tests/unit/api.test.py:5)'],
  ['jest length', 'expect(received).toHaveLength(expected)\n\nExpected length: 3\nReceived length: 2', 'possible product bug: expected length: 3, got length: 2 (tests/unit/api.test.py:5)'],
  ['jest call count', 'expect(jest.fn()).toHaveBeenCalledTimes(expected)\n\nExpected number of calls: 1\nReceived number of calls: 0', 'possible product bug: expected number of calls: 1, got number of calls: 0 (tests/unit/api.test.py:5)'],
];
for (const [label, message, report] of valueMessages) {
  await scenario(`value message: ${label}`, async () => {
    const f = { test: `api ${label}`, file: 'tests/unit/api.test.py', line: 5, category: 'setup', message };
    const { result, kinds } = await runLoop({ runs: [red([f])] });
    check(`value message ${label}: withheld though labelled setup`, kinds, ['run']);
    check(`value message ${label}: report`, result.possible_product_bugs.map((b) => b.report), [report]);
  });
}

// c13 classification probe (CodeRabbit :219 on #4407). V = withheld value mismatch, R = repairable.
const classifyCases = [
  ['PW toBeVisible not found', 'stale-selector', 'Error: Timed out 5000ms waiting for expect(locator).toBeVisible()\n\nExpected: visible\nReceived: <element(s) not found>', 'R'],
  ['PW toHaveText not found', 'stale-selector', 'Timed out 5000ms waiting for expect(locator).toHaveText(expected)\n\nExpected string: "Save"\nReceived: <element(s) not found>', 'R'],
  ['PW toHaveCount not found', 'stale-selector', "expect(locator).toHaveCount(expected)\n\nExpected: 3\nReceived: 0\nCall log:\n  - waiting for getByRole('row')", 'V'],
  ['PW toHaveText real diff', 'stale-selector', 'expect(locator).toHaveText(expected)\n\nExpected string: "Save"\nReceived string: "Submit"', 'V'],
  ['vitest value', 'flaky', 'AssertionError: expected 409 to be 422', 'V'],
  ['jest value', 'flaky', 'expect(received).toBe(expected)\n\nExpected: 409\nReceived: 422', 'V'],
  ['TS2554 args', 'type', 'error TS2554: Expected 2 arguments, but got 1.', 'R'],
  ['import error', 'import', "Error: Cannot find module './api'", 'R'],
];
for (const [label, category, message, want] of classifyCases) {
  await scenario(`classify: ${label}`, async () => {
    const f = { test: `classify ${label}`, file: 'tests/e2e/classify.spec.ts', line: 7, category, message };
    const { kinds } = await runLoop({
      runs: [red([f]), GREEN],
      repairs: [repairOf([fix(f)])],
    });
    check(`classify ${label}: ${want === 'V' ? 'withheld as a value mismatch' : 'sent for repair'}`, kinds, want === 'V' ? ['run'] : ['run', 'repair', 'run']);
  });
}

await scenario('vitest shape reports expected and got in the right order', async () => {
  const f = { test: 'vitest status', file: 'tests/unit/api.test.ts', line: 21, category: 'flaky', message: 'AssertionError: expected 409 to be 422 // Object.is equality' };
  const { result } = await runLoop({ runs: [red([f])] });
  check('vitest report: expected is the matcher argument', result.possible_product_bugs.map((b) => b.report), ['possible product bug: expected 422, got 409 (tests/unit/api.test.ts:21)']);
});

await scenario('chai length with a trailing but got', async () => {
  const f = { test: 'chai length', file: 'tests/unit/list.test.ts', line: 4, category: 'setup', message: 'AssertionError: expected [ 1, 2 ] to have a length of 3 but got 2' };
  const { result } = await runLoop({ runs: [red([f])] });
  check('chai length report', result.possible_product_bugs.map((b) => b.report), ['possible product bug: expected 3, got [ 1, 2 ] (tests/unit/list.test.ts:4)']);
});

await scenario('TS2554 argument count is a type error, not a value mismatch', async () => {
  const f = { test: 'builds a profile', file: 'tests/unit/profile.test.ts', line: 9, category: 'type', message: 'error TS2554: Expected 2 arguments, but got 1.' };
  const { result, kinds } = await runLoop({
    runs: [red([f]), GREEN],
    repairs: [repairOf([fix(f, { change: 'passed the missing options argument', before: 'buildProfile(user)', after: 'buildProfile(user, {})' })])],
  });
  check('TS2554: still repaired and healed', [kinds, result.healed], [['run', 'repair', 'run'], true]);
});

// Before/after vetting over the agent's reported text. true = the script must reject it.
const vetCases = [
  ['toBe literal', 'expect(res.status).toBe(409)', 'expect(res.status).toBe(422)', true],
  ['toEqual object', "expect(user).toEqual({ id: 1, role: 'admin' })", "expect(user).toEqual({ id: 1, role: 'guest' })", true],
  ['toStrictEqual', 'expect(list).toStrictEqual([1, 2, 3])', 'expect(list).toStrictEqual([1, 2])', true],
  ['toHaveBeenCalledWith', "expect(send).toHaveBeenCalledWith('a@b.co')", "expect(send).toHaveBeenCalledWith('c@d.co')", true],
  ['toHaveLength', 'expect(items).toHaveLength(3)', 'expect(items).toHaveLength(2)', true],
  ['toMatchInlineSnapshot', 'expect(out).toMatchInlineSnapshot(`"ok"`)', 'expect(out).toMatchInlineSnapshot(`"fail"`)', true],
  ['toThrow argument', "expect(fn).toThrow('boom')", "expect(fn).toThrow('bang')", true],
  ['multi-line chain', 'expect(total)\n  .toBe(3)', 'expect(total)\n  .toBe(2)', true],
  ['negated', 'expect(flag).toBe(true)', 'expect(flag).not.toBe(true)', true],
  ['assertion removed', 'expect(a).toBe(1)\nexpect(b).toBe(2)', 'expect(a).toBe(1)', true],
  ['weakened to toBeDefined', 'expect(user.id).toBe(7)', 'expect(user.id).toBeDefined()', true],
  ['weakened to toBeTruthy', "expect(res.body.ok).toBe('yes')", 'expect(res.body.ok).toBeTruthy()', true],
  ['weakened to not.toThrow', "expect(fn).toThrow('boom')", 'expect(fn).not.toThrow()', true],
  ['adds it.skip', "it('debounce fires once', async () => {", "it.skip('debounce fires once', async () => {", true],
  ['adds test.only', "test('debounce fires once', async () => {", "test.only('debounce fires once', async () => {", true],
  ['adds it.todo', "it('debounce fires once', async () => {", "it.todo('debounce fires once')", true],
  ['adds pytest xfail', 'def test_total():', '@pytest.mark.xfail\ndef test_total():', true],
  ['python assert', 'assert resp.status_code == 409', 'assert resp.status_code == 422', true],
  ['assertEqual', 'self.assertEqual(total, 3)', 'self.assertEqual(total, 2)', true],
  ['assertTrue removed', 'self.assertTrue(ok)\nself.assertEqual(n, 1)', 'self.assertEqual(n, 1)', true],
  ['pytest.raises', 'with pytest.raises(ValueError):', 'with pytest.raises(Exception):', true],
  ['status comparison', 'ok = res.status === 409', 'ok = res.status === 422', true],
  ['import path', "import { login } from './auth'", "import { login } from '../../src/auth'", false],
  ['fixture added', '', 'beforeEach(() => { db = createTestDb() })', false],
  ['deterministic wait', 'await sleep(300)', 'await vi.advanceTimersByTimeAsync(300)', false],
  ['stale-selector locator swap', "await expect(page.getByTestId('submit')).toBeVisible()", "await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()", false, 'stale-selector'],
  ['assertion added', 'expect(a).toBe(1)', 'expect(a).toBe(1)\nexpect(b).toBe(2)', false],
  ['whitespace only', 'expect(a).toBe( 1 )', 'expect(a).toBe(1)', false],
  // c13 probe (5a902387): each turned a failing value assertion green and passed as unchanged.
  ['c13 1: expected value via a const', 'const want = 409\nexpect(res.status).toBe(want)', 'const want = 422\nexpect(res.status).toBe(want)', true],
  ['c13 2: subject rewritten to the literal', 'expect(res.status).toBe(409)', 'expect(409).toBe(409)', true],
  ['c13 3: subject clamped', 'expect(res.status).toBe(409)', 'expect(Math.min(res.status, 409)).toBe(409)', true],
  ['c13 4: wrapped in try/catch', 'expect(res.status).toBe(409)', 'try { expect(res.status).toBe(409) } catch {}', true],
  ['c13 5: early return before the assertion', 'expect(res.status).toBe(409)', 'return;\nexpect(res.status).toBe(409)', true],
  ['c13 6: if (false) in front', 'expect(res.status).toBe(409)', 'if (false) expect(res.status).toBe(409)', true],
  ['c13 7: python WANT constant', 'WANT = 409\nassert resp.status_code == WANT', 'WANT = 422\nassert resp.status_code == WANT', true],
  ['c13 control: direct value edit', 'expect(res.status).toBe(409)', 'expect(res.status).toBe(422)', true],
  ['c13 control: weaken', 'expect(res.status).toBe(409)', 'expect(res.status).toBeDefined()', true],
  ['c13 control: import path fix', "import { app } from './app'", "import { app } from '../../src/app'", false],
  // Rule boundaries: the selector swap is narrow, and the expected side cannot be recomputed.
  ['stale-selector label, literal subject', "await expect(page.getByTestId('status')).toHaveText('409')", "await expect('409').toHaveText('409')", true, 'stale-selector'],
  ['flaky label, locator swap', "await expect(page.getByTestId('submit')).toBeVisible()", "await expect(page.getByRole('button')).toBeVisible()", true],
  ['expected side recomputed from the subject', 'const want = expectedTotal(cart)\nexpect(total).toBe(want)', 'const want = total\nexpect(total).toBe(want)', true],
  ['adds && guard', 'expect(res.status).toBe(409)', 'res.ok && expect(res.status).toBe(409)', true],
  ['adds ternary', 'expect(res.status).toBe(409)', 'res.ok ? expect(res.status).toBe(409) : null', true],
];
const STALE_F = {
  test: 'submit button',
  file: 'tests/e2e/checkout.spec.ts',
  line: 14,
  category: 'stale-selector',
  message: "Error: locator.click: Timeout 5000ms waiting for getByTestId('submit')",
};
for (const [label, before, after, reject, kind] of vetCases) {
  await scenario(`vet: ${label}`, async () => {
    const target = kind === 'stale-selector' ? STALE_F : FLAKY_E;
    const { result } = await runLoop({
      runs: [red([target]), GREEN],
      repairs: [repairOf([fix(target, { change: 'stabilised the test', before, after })])],
      reverts: [{ reverted: [{ file: target.file, line: target.line, restored: true }] }],
    });
    check(`vet ${label}: ${reject ? 'rejected' : 'kept'}`, [result.iteration_ledger[0].rejected_fixes, result.healed], reject ? [1, false] : [0, true]);
  });
}

// estate-5 HOLD #2: a constant moved in one hunk, the assertion in another (or in none).
const twoHunkCases = [
  [
    'EXPECTED_STATUS in a separate hunk, assertion in neither',
    [
      { before: 'const EXPECTED_STATUS = 409', after: 'const EXPECTED_STATUS = 422' },
      { before: 'await page.waitForTimeout(500)', after: "await page.waitForLoadState('networkidle')" },
    ],
    1,
  ],
  [
    'plain constant, assertion only in the other hunk',
    [
      { before: 'const CODE = 409', after: 'const CODE = 422' },
      {
        before: 'await page.waitForTimeout(500)\nexpect(res.status).toBe(CODE)',
        after: "await page.waitForLoadState('networkidle')\nexpect(res.status).toBe(CODE)",
      },
    ],
    1,
  ],
  [
    'legit import plus fixture path',
    [
      { before: "import { api } from './api'", after: "import { api } from '../../src/api'" },
      { before: "const FIXTURE_DIR = 'tests/fixtures'", after: "const FIXTURE_DIR = 'tests/unit/fixtures'" },
    ],
    0,
  ],
  // CodeRabbit :345 and :395: subjects and expected-side names are separate sets.
  [
    ':345 locator renamed in one hunk, its subject asserted in the other',
    [
      {
        before: "const button = page.getByRole('button', { name: 'Old' })",
        after: "const button = page.getByRole('button', { name: 'New' })",
      },
      { before: 'await expect(button).toBeVisible()', after: 'await button.waitFor()\nawait expect(button).toBeVisible()' },
    ],
    0,
    STALE_F,
  ],
  [
    ':395 expected constant re-pointed with no literal',
    [
      { before: 'const CODE = oldStatus', after: 'const CODE = newStatus' },
      { before: 'expect(res.status).toBe(CODE)', after: 'await settle()\nexpect(res.status).toBe(CODE)' },
    ],
    1,
  ],
  [
    ':395 expected constant re-pointed through a member expression',
    [
      { before: 'const CODE = STATUS.CONFLICT', after: 'const CODE = STATUS.UNPROCESSABLE' },
      { before: 'expect(res.status).toBe(CODE)', after: 'await settle()\nexpect(res.status).toBe(CODE)' },
    ],
    1,
  ],
  [
    'subject variable set to the expected value in the other hunk',
    [
      { before: 'const got = await api.create(user)', after: 'const got = 409' },
      { before: 'await page.waitForTimeout(500)\nexpect(got).toBe(409)', after: 'await settle()\nexpect(got).toBe(409)' },
    ],
    1,
  ],
  [
    'Python subject set to the expected value in the other hunk',
    [
      { before: "got = client.post('/users').status_code", after: 'got = 409' },
      { before: 'time.sleep(0.5)\nassert got == 409', after: 'wait_for_idle()\nassert got == 409' },
    ],
    1,
  ],
];
for (const [label, hunks, rejectedCount, target = FLAKY_E] of twoHunkCases) {
  await scenario(`two hunks: ${label}`, async () => {
    const { result } = await runLoop({
      runs: [red([target]), GREEN],
      repairs: [repairOf(hunks.map((h) => fix(target, { change: 'stabilised the test', ...h })))],
      reverts: [{ reverted: [{ file: target.file, line: target.line, restored: true }] }],
    });
    check(
      `two hunks ${label}: ${rejectedCount ? 'rejected' : 'kept'}`,
      [result.iteration_ledger[0].rejected_fixes, result.healed],
      [rejectedCount, !rejectedCount],
    );
  });
}

// Conservative rule (estate-5 HOLD #3 cap): a binding value change in a test file is held for
// a human, reverted, left failing, and neither healed nor a possible product bug.
const humanCases = [
  // [label, target, fixes (over), held report or null when it must heal]
  [
    'CR395 single hunk: CODE re-pointed, assertion in no hunk',
    FLAKY_E,
    [{ before: 'const CODE = STATUS.CONFLICT', after: 'const CODE = STATUS.UNPROCESSABLE' }],
    'binding change needs a human: CODE STATUS.CONFLICT -> STATUS.UNPROCESSABLE',
  ],
  ['neutral TOTAL 3 to 2', FLAKY_E, [{ before: 'const TOTAL = 3', after: 'const TOTAL = 2' }], 'binding change needs a human: TOTAL 3 -> 2'],
  [
    'setup change on a subject variable',
    FLAKY_E,
    [{ before: "const user = makeUser()\nexpect(user.name).toBe('ada')", after: "const user = await makeUser(db)\nexpect(user.name).toBe('ada')" }],
    'binding change needs a human: user makeUser() -> awaitmakeUser(db)',
  ],
  ['Python bare NAME reassigned', FLAKY_E, [{ before: 'LIMIT = 10', after: 'LIMIT = 20' }], 'binding change needs a human: LIMIT 10 -> 20'],
  ['bare let reassignment', FLAKY_E, [{ before: 'count = 1', after: 'count = 0' }], 'binding change needs a human: count 1 -> 0'],
  [
    'binding deleted in one hunk, re-added changed in another',
    FLAKY_E,
    [
      { before: 'const CODE = 409\nawait page.waitForTimeout(500)', after: 'await page.waitForTimeout(500)' },
      { before: 'await settle()', after: 'await settle()\nconst CODE = 422' },
    ],
    'binding change needs a human: CODE 409 -> 422',
  ],
  [
    'locator binding changed outside stale-selector',
    FLAKY_E,
    [{ before: "const btn = page.getByRole('button', { name: 'Old' })", after: "const btn = page.getByRole('button', { name: 'New' })" }],
    "binding change needs a human: btn page.getByRole('button',{name:'Old'}) -> page.getByRole('button',{name:'New'})",
  ],
  [
    'CodeRabbit :425 redirectTarget, a substring of dir',
    FLAKY_E,
    [{ before: "const redirectTarget = '/home'", after: "const redirectTarget = '/dashboard'" }],
    "binding change needs a human: redirectTarget '/home' -> '/dashboard'",
  ],
  ['member assignment', FLAKY_E, [{ before: 'expected.total = 3', after: 'expected.total = 2' }], 'binding change needs a human: expected.total 3 -> 2'],
  [
    'Python subscript assignment',
    { ...FLAKY_E, file: 'tests/test_sum.py' },
    [{ before: 'expected["total"] = 3', after: 'expected["total"] = 2' }],
    'binding change needs a human: expected["total"] 3 -> 2',
  ],
  [
    'Object.assign into an existing object',
    FLAKY_E,
    [{ before: 'Object.assign(expected, { total: 3 })', after: 'Object.assign(expected, { total: 2 })' }],
    'value change needs a human: Object.assign(expected) Object.assign(expected,{total:3}) -> Object.assign(expected,{total:2})',
  ],
  [
    'Python dict update',
    { ...FLAKY_E, file: 'tests/test_sum.py' },
    [{ before: 'expected.update({"total": 3})', after: 'expected.update({"total": 2})' }],
    'value change needs a human: expected.update() expected.update({"total":3}) -> expected.update({"total":2})',
  ],
  [
    'spread into a new binding',
    FLAKY_E,
    [{ before: 'const order = { ...base, total: 3 }', after: 'const order = { ...base, total: 2 }' }],
    'binding change needs a human: order {...base,total:3} -> {...base,total:2}',
  ],
  [
    'mock return literal changed',
    FLAKY_E,
    [{ before: 'api.get.mockResolvedValue({ total: 3 })', after: 'api.get.mockResolvedValue({ total: 2 })' }],
    'value change needs a human: literal after api.get.mockResolvedValue( {total:3} -> {total:2}',
  ],
  ['array literal changed', FLAKY_E, [{ before: 'seed([1, 2, 3])', after: 'seed([1, 2])' }], 'value change needs a human: literal after seed( [1,2,3] -> [1,2]'],
  [
    'locator option changed outside stale-selector',
    FLAKY_E,
    [{ before: "await page.getByRole('button', { name: 'Old' }).click()", after: "await page.getByRole('button', { name: 'New' }).click()" }],
    "value change needs a human: literal after awaitpage.getByRole('button' {name:'Old'} -> {name:'New'}",
  ],
  [
    'golden JSON under tests/',
    FLAKY_E,
    [{ file: 'tests/golden/order.json', before: '{ "total": 3 }', after: '{ "total": 2 }' }],
    'snapshot or golden edit needs a human: tests/golden/order.json',
  ],
  [
    'external snapshot file',
    FLAKY_E,
    [{ file: 'src/components/__snapshots__/card.test.tsx.snap', before: 'exports[`card 1`] = `"Total: 3"`;', after: 'exports[`card 1`] = `"Total: 2"`;' }],
    'snapshot or golden edit needs a human: src/components/__snapshots__/card.test.tsx.snap',
  ],
  [
    'path containing expected',
    FLAKY_E,
    [{ file: 'src/report/expected-output.txt', before: 'Total: 3', after: 'Total: 2' }],
    'snapshot or golden edit needs a human: src/report/expected-output.txt',
  ],
  [
    'snapshot update turned on in the test',
    FLAKY_E,
    [{ before: "test.use({ trace: 'on' })", after: "test.use({ trace: 'on', updateSnapshots: 'all' })" }],
    'snapshot or golden edit needs a human: tests/unit/debounce.test.ts',
  ],
  ['timeout option raised in an options literal', FLAKY_E, [{ before: "await page.waitForSelector('#total', { timeout: 5000 })", after: "await page.waitForSelector('#total', { timeout: 10000 })" }], null],
  ['callback body edited', FLAKY_E, [{ before: "test('x', async () => {\n  await a()\n})", after: "test('x', async () => {\n  await b()\n})" }], null],
  [
    'locator option swap under stale-selector',
    STALE_F,
    [{ before: "await page.getByRole('button', { name: 'Old' }).click()", after: "await page.getByRole('button', { name: 'New' }).click()" }],
    null,
  ],
  ['timeout constant raised', FLAKY_E, [{ before: 'const TIMEOUT_MS = 5000', after: 'const TIMEOUT_MS = 15000' }], null],
  ['wait budget raised', FLAKY_E, [{ before: 'const WAIT_MS = 5000', after: 'const WAIT_MS = 10000' }], null],
  ['base url fixed', FLAKY_E, [{ before: "const BASE_URL = 'http://localhost:3000'", after: "const BASE_URL = 'http://127.0.0.1:3000'" }], null],
  ['import path fixed', FLAKY_E, [{}], null],
  [
    'X4 selector swap inside the expect, same value',
    STALE_F,
    [{ before: "await expect(page.getByText('Total')).toHaveText('Total: 3')", after: "await expect(page.getByTestId('total')).toHaveText('Total: 3')" }],
    null,
  ],
  [
    'CR345 locator binding renamed under stale-selector',
    STALE_F,
    [{ before: "const button = page.getByRole('button', { name: 'Old' })", after: "const button = page.getByRole('button', { name: 'New' })" }],
    null,
  ],
  [
    'binding in a config file, not a test file',
    FLAKY_E,
    [{ file: 'playwright.config.ts', before: 'const workers = 4', after: 'const workers = 1' }],
    null,
  ],
];
for (const [label, target, overs, report] of humanCases) {
  await scenario(`needs human: ${label}`, async () => {
    const { result, kinds } = await runLoop({
      runs: [red([target]), GREEN],
      repairs: [repairOf(overs.map((o) => fix(target, { change: 'stabilised the test', ...o })))],
      reverts: [{ reverted: [{ file: target.file, line: target.line, restored: true }] }],
    });
    const human = result.needs_human || [];
    if (report) {
      const [h] = human;
      check(
        `needs human ${label}: held, reverted, not healed, not a bug`,
        [result.healed, human.length, h && h.report, h && h.still_failing, result.possible_product_bugs.length, result.iteration_ledger[0].rejected_fixes, result.iteration_ledger[0].held_fixes, kinds.join(',')],
        [false, 1, report, true, 0, 0, overs.length, 'run,repair,revert'],
      );
    } else {
      check(`needs human ${label}: heals`, [result.healed, human.length, kinds.join(',')], [true, 0, 'run,repair,run']);
    }
  });
}

// CodeRabbit :425: the safe allowlist is a last-word rule, not a substring match.
const SHOULD_HOLD = ['redirectTarget', 'userProfile', 'reportTotal', 'exportCount', 'supportedCount', 'ghostCount', 'fileCount', 'portCount', 'hostName', 'pathLength', 'waitingUsers', 'TOTAL', 'CODE', 'expectedStatus', 'timeoutMessage', 'directoryEntries'];
const SHOULD_HEAL = ['TIMEOUT_MS', 'timeout', 'retryDelayMs', 'maxRetries', 'pollInterval', 'POLL_INTERVAL_MS', 'apiBaseUrl', 'BASE_URL', 'fixturePath', 'dataDir', 'configFile', 'PORT', 'dbHost', 'waitMs', 'SNAPSHOT_DIR', 'fixtures'];
for (const name of [...SHOULD_HOLD, ...SHOULD_HEAL]) {
  const hold = SHOULD_HOLD.includes(name);
  await scenario(`safe name: ${name}`, async () => {
    const { result } = await runLoop({
      runs: [red([FLAKY_E]), GREEN],
      repairs: [repairOf([fix(FLAKY_E, { change: 'stabilised the test', before: `const ${name} = 1`, after: `const ${name} = 2` })])],
      reverts: REVERT_E,
    });
    const human = (result.needs_human || []).length;
    const bugs = result.possible_product_bugs.length;
    // expectedStatus is already rejected as a possible product bug by the expected-name rule.
    const want = !hold ? [true, 0, 0] : /expect/i.test(name) ? [false, 0, 1] : [false, 1, 0];
    check(`safe name ${name}: ${hold ? 'held' : 'heals'}`, [result.healed, human, bugs], want);
  });
}

await scenario('needs human: held test is withheld from later passes, green is not a heal', async () => {
  const held = fix(FLAKY_E, { change: 'stabilised', before: 'const TOTAL = 3', after: 'const TOTAL = 2' });
  const { result, calls, kinds } = await runLoop({
    runs: [red([FLAKY_E, IMPORT_B]), red([FLAKY_E, SETUP_D]), red([FLAKY_E])],
    repairs: [repairOf([held, fix(IMPORT_B)]), repairOf([fix(SETUP_D)])],
    reverts: REVERT_E,
  });
  const secondRepair = calls.filter((c) => c.kind === 'repair')[1].prompt;
  check('held test never re-sent for repair', kinds.join(','), 'run,repair,revert,run,repair,run');
  check(
    'second repair pass: held test only in the do-not-touch list',
    [secondRepair.includes(`- ${FLAKY_E.file}:${FLAKY_E.line} ${FLAKY_E.test}`), secondRepair.includes(FLAKY_E.message), secondRepair.includes(SETUP_D.message)],
    [true, false, true],
  );
  const second = await runLoop({
    runs: [red([FLAKY_E, IMPORT_B]), GREEN],
    repairs: [repairOf([held, fix(IMPORT_B)])],
    reverts: REVERT_E,
  });
  check(
    'green with a held binding change is not a heal',
    [second.result.healed, second.result.fail_count, second.result.state_known, (second.result.needs_human || []).length, second.result.possible_product_bugs.length],
    [false, -1, false, 1, 0],
  );
  check('verdict note names needs_human', /binding change needs a human/.test(String(result.note)), true);
});

// (3) import / setup / flaky failures are still repaired.
await scenario('import, setup and flaky are repaired', async () => {
  const { result, calls, kinds } = await runLoop({
    runs: [red([IMPORT_B, SETUP_D, FLAKY_E]), GREEN],
    repairs: [
      repairOf([
        fix(IMPORT_B),
        fix(SETUP_D, { change: 'added a postgres testcontainer fixture', before: '', after: 'const pg = await new PostgreSqlContainer().start()' }),
        fix(FLAKY_E, { change: 'froze time with vi.useFakeTimers and advanced it past the debounce', before: 'await sleep(300)', after: 'vi.advanceTimersByTime(300)' }),
      ]),
    ],
  });
  const prompt = calls.find((c) => c.kind === 'repair').prompt;
  check('repairable: run, repair, verify run, no revert', kinds, ['run', 'repair', 'run']);
  check('repairable: every failure is sent for repair', [IMPORT_B, SETUP_D, FLAKY_E].map((f) => prompt.includes(f.message)), [true, true, true]);
  check('repairable: healed', [result.status, result.healed, result.fail_count], ['healed', true, 0]);
  check('repairable: no possible product bugs', result.possible_product_bugs, []);
  check('repairable: three fixes kept', result.iteration_ledger[0].accepted_fixes, 3);
});

await scenario('iteration bound unchanged', async () => {
  const { result, kinds } = await runLoop({
    args: { maxIterations: 9 },
    runs: [red([IMPORT_B]), red([IMPORT_B]), red([IMPORT_B])],
    repairs: [repairOf([fix(IMPORT_B)]), repairOf([fix(IMPORT_B)])],
  });
  check('bound: 3 diagnose runs and 2 repair passes', kinds, ['run', 'repair', 'run', 'repair', 'run']);
  check('bound: clamped to 3', [result.iterations_used, result.max_iterations, result.healed], [3, 3, false]);
});

console.log('='.repeat(70));
console.log('  cover heal-loop: value mismatches never healed');
console.log('='.repeat(70));
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`\nFAILED: ${failures.length} check(s) failed, ${passed} passed`);
  process.exit(1);
}
console.log(`SUCCESS: ${passed} checks passed`);
process.exit(0);

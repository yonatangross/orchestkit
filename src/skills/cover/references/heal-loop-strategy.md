# Heal Loop Strategy

Fix failing generated tests iteratively. Ceiling is 3 iterations (2 repair passes plus a
final verifying run) to prevent infinite loops. See "Iteration Budget" below for the split.
Phase 5 of `/ork:cover` runs this as `src/skills/cover/workflows/heal-loop.js`.

## Failure Classification

| Category | Example | Fix Strategy |
|----------|---------|-------------|
| **Assertion error** (value mismatch) | `expected 200, got 201`, snapshot diff, wrong status code or count | **Never healed.** Report `possible product bug: expected X, got Y (file:line)`; the test stays failing |
| **Import error** | `Cannot find module './auth'` | Fix import path, check tsconfig/conftest |
| **Setup error** | `Connection refused` | Add missing service setup, check fixture scope |
| **Timeout** | `Test exceeded 5000ms` | Add proper waits (Playwright: auto-wait; API: increase timeout) |
| **Selector stale** | `Element not found: [data-testid="submit"]` | Switch to semantic locator (`getByRole`) |
| **Type error** | `Property 'id' does not exist` | Fix type assertion or factory output |
| **Flaky** | Passes sometimes, fails others | Remove timing deps, add deterministic waits |

## Iteration Budget

Enforced by `workflows/heal-loop.js`, not by instruction. The ceiling is **3 diagnose runs
and 2 repair passes**: the final iteration verifies the previous repair and does not start a
new one, because there would be no run left to confirm it.

```
Iteration 1: diagnose -> repair  (obvious errors: imports, paths, setup)
Iteration 2: diagnose -> repair  (interaction errors: selectors, timing, state)
Iteration 3: diagnose only       (verify iteration 2's repair; no further repair)
```

Anything still failing after the final diagnose is reported with:
- Failure reason
- File and line number
- Suggested manual fix

## Fix Rules

1. **Never modify source code**: only fix test files
2. **Read source before fixing**: understand the actual behavior
3. **Never rewrite an expected value** to match current output. Heal repairs setup, fixtures,
   imports, paths, types, selectors, timeouts and flakes only. `heal-loop.js` withholds value
   mismatches from the repair agent, and rejects and reverts any reported fix that changes an
   expected value, a snapshot, or a test already reported as a possible product bug
4. **Binding changes go to a human.** In a test file, a fix that changes the value of a
   `const`/`let`/`var` binding, a bare reassignment, or a Python `NAME =` is not healed: the
   assertion reading it can sit outside every reported hunk, so no hunk rule can tell a
   setup fix from a moved expected value. See Needs a Human below
5. **Don't suppress errors**: if a test exposes a real bug, report it
6. **Keep tests deterministic**: no `Date.now()`, no `Math.random()` without seeding

## Deterministic Checks

The agents' labels (failure `category`, fix `category`, `touches_expected_value`) are not
trusted on their own. `heal-loop.js` also decides from the text:

- **Classification.** A failure message in an expected/actual shape (`expected X, got Y`,
  Jest `Expected: / Received:`, chai/vitest `expected 409 to be 422`, pytest
  `assert 422 == 409`, unittest `422 != 409`, two status codes on one `status` line) is a
  value mismatch whatever category the run agent gave it. Two shapes are excluded: TS2554
  `Expected 2 arguments, but got 1` is a type error, and Playwright
  `Received: <element(s) not found>` is a locator that matched nothing, so it stays
  repairable as a stale selector. `toHaveCount` `Received: 0` and a real `toHaveText` diff
  (`Received string: "Submit"`) remain value mismatches.
- **Fix vetting.** Assertions are extracted from each fix's `before` and `after`: `expect(...)`
  keyed by its whole matcher chain and arguments, Python `assert`, `assertEqual`/`assertTrue`
  style calls, `assert.*`, `pytest.raises`, chai `should`, and status comparisons. The fix is
  rejected when:
  - an assertion from `before` is missing from `after` (changed, removed, negated, or
    weakened to `toBeDefined`, `toBeTruthy`, `not.toThrow`);
  - an `expect(...)` subject changes, unless the fix is `stale-selector`, both subjects are
    locator expressions (`getBy*`, `queryBy*`, `findBy*`, `locator(`, behind `page.`,
    `screen.` or `within(x).`), and the new subject holds no literal equal to the failure's
    expected value. `expect(409)` or `expect(Math.min(res.status, 409))` never passes;
  - an assignment changes at all for a name on an assertion's expected side: an `expect`
    matcher's arguments, the right of `assert a == b`, the expected argument of
    `assertEqual` and friends (`const want = 409` to `422`, Python `WANT = 409` to `422`,
    `const CODE = oldStatus` to `newStatus`), or for a name matching `expect`, `want` or
    `golden` even when no reported hunk asserts on it;
  - an assignment changes a literal for a name an assertion inspects (`const got = 409`
    for `expect(got).toBe(409)`), unless it is a stale-selector locator swap, the same
    rule as a subject rewritten in place (`page.getByRole('button', { name: 'Old' })` to
    `'New'` for `expect(button).toBeVisible()` is kept);
  - both name sets are collected per file across every hunk of one repair pass, before
    and after, so a value moved in one hunk is caught when the assertion sits in another;
  - `after` adds `try`, `catch`/`except`, `return`, `if`, a ternary, `&&` or `||` while it
    contains an assertion (counted against `before`);
  - `after` adds `skip`, `only`, `todo`, `fixme` or `xfail`.

  Edits that touch no assertion (imports, fixtures, waits) pass, and so does a locator swap
  in a stale-selector fix.

## Possible Product Bugs

Every value mismatch (`assertion`, `source-bug`), every fix the script rejected, and every
bug the repair agent reports lands in `possible_product_bugs` of the workflow result. Each
entry carries a `report` line to surface verbatim in the Phase 6 report:

```
possible product bug: expected 0, got -40 (tests/unit/test_payment.ts:23)
  test:   test_negative_quantity
  origin: classified | rejected-repair | repair-agent
  action: test left FAILING. Confirm the intended behavior, then fix the source or the test by hand.
```

If a test diagnosed as a value mismatch stops failing on any later run, red or green, a test
edit changed what it asserts. The workflow reports `status: "failed"`,
`value_mismatch_vanished: true`, names each one in `vanished_value_mismatches`, marks its
entry `still_failing: false`, and sets `fail_count: -1` so a caller cannot read it as healed.
Only failures the run agent diagnosed count here; rejected-repair and agent-reported entries
can carry incomplete identities. A green run with any possible product bug flagged is also
reported as `status: "failed"` with `fail_count: -1`.

## Needs a Human

A fix that passes every check above but changes a binding's value in a test file is held,
reverted, and listed in `needs_human` with a `report` line to surface verbatim:

```
binding change needs a human: CODE STATUS.CONFLICT -> STATUS.UNPROCESSABLE
```

The test stays failing, is withheld from later repair passes, and is never reported as
healed or as a possible product bug: a person decides which it is. A green run with any
entry held is reported as `status: "failed"` with `fail_count: -1`. Two exceptions stay
healable:

- the binding's name matches
  `/timeout|delay|retr(y|ies)|wait|interval|poll|port|host|url|base_?url|path|dir|fixture|file/i`
  (`TIMEOUT_MS`, `WAIT_MS`, `BASE_URL`, `FIXTURE_DIR`);
- the fix is `stale-selector` and both values are locator expressions with no literal equal
  to the failure's expected value (`page.getByRole('button', { name: 'Old' })` to `'New'`).

A binding deleted in one hunk and re-added with a new value in another counts as a change,
and holds both hunks. Files outside the test tree (`playwright.config.ts`) are not covered
by this rule.

## Flaky Test Prevention

Generated tests must avoid:
- `setTimeout`/`sleep` for synchronization
- Shared mutable state between tests
- Order-dependent test execution
- Hard-coded ports or file paths
- Time-sensitive assertions (`Date.now()`)

Instead use:
- Playwright auto-wait and `waitFor` assertions
- Fresh fixtures per test (function scope)
- Dynamic port allocation
- Relative paths and temp directories
- Frozen time (vi.useFakeTimers / freezegun)

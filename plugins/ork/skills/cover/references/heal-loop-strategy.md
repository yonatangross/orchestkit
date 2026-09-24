# Heal Loop Strategy

Fix failing generated tests iteratively. Ceiling is 3 iterations (2 repair passes plus a
final verifying run) to prevent infinite loops. See "Iteration Budget" below for the split.

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
4. **Don't suppress errors**: if a test exposes a real bug, report it
5. **Keep tests deterministic**: no `Date.now()`, no `Math.random()` without seeding

## Deterministic Checks

The agents' labels (failure `category`, fix `category`, `touches_expected_value`) are not
trusted on their own. `heal-loop.js` also decides from the text:

- **Classification.** A failure message in an expected/actual shape (`expected X, got Y`,
  Jest `Expected: / Received:`, pytest `assert 422 == 409`, unittest `422 != 409`, two status
  codes on one `status` line) is a value mismatch whatever category the run agent gave it.
  TS2554 `Expected 2 arguments, but got 1` is excluded, it is a type error.
- **Fix vetting.** Assertions are extracted from each fix's `before` and `after`: `expect(...)`
  with its whole matcher chain and arguments (the subject is ignored, so a selector change
  passes), Python `assert`, `assertEqual`/`assertTrue` style calls, `assert.*`, `pytest.raises`,
  chai `should`, and status comparisons. The fix is rejected when any assertion from `before`
  is missing from `after` (changed, removed, negated, or weakened to `toBeDefined`,
  `toBeTruthy`, `not.toThrow`), or when `after` adds `skip`, `only`, `todo`, `fixme` or `xfail`.
  Edits that touch no assertion (imports, fixtures, waits, selectors) pass.

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

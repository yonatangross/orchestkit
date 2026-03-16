# Heal Loop Strategy

Fix failing generated tests iteratively. Max 3 iterations to prevent infinite loops.

## Failure Classification

| Category | Example | Fix Strategy |
|----------|---------|-------------|
| **Assertion error** | `expected 200, got 201` | Update expected value after verifying source behavior |
| **Import error** | `Cannot find module './auth'` | Fix import path, check tsconfig/conftest |
| **Setup error** | `Connection refused` | Add missing service setup, check fixture scope |
| **Timeout** | `Test exceeded 5000ms` | Add proper waits (Playwright: auto-wait; API: increase timeout) |
| **Selector stale** | `Element not found: [data-testid="submit"]` | Switch to semantic locator (`getByRole`) |
| **Type error** | `Property 'id' does not exist` | Fix type assertion or factory output |
| **Flaky** | Passes sometimes, fails others | Remove timing deps, add deterministic waits |

## Iteration Budget

```
Iteration 1: Fix obvious errors (imports, assertions, setup)
Iteration 2: Fix interaction errors (selectors, timing, state)
Iteration 3: Fix remaining edge cases or mark as known-failing
```

After 3 iterations, any still-failing tests are reported with:
- Failure reason
- File and line number
- Suggested manual fix

## Fix Rules

1. **Never modify source code** — only fix test files
2. **Read source before fixing** — understand the actual behavior
3. **Prefer updating assertions** over adding workarounds
4. **Don't suppress errors** — if a test exposes a real bug, report it
5. **Keep tests deterministic** — no `Date.now()`, no `Math.random()` without seeding

## Source Bug Detection

If a test failure reveals a real bug in source code:

```
[SOURCE BUG DETECTED]
File: src/services/payment.ts:45
Issue: calculateTotal() doesn't handle negative quantities
Test: tests/unit/test_payment.ts:23 — test_negative_quantity
Action: Test is CORRECT. Source code needs fixing.
         Skipping this test in heal loop.
         Report to user for manual resolution.
```

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

# Behaviour Gate and Risk Targets

`cover` writes a test only when it asserts behaviour, and it picks what to test by risk,
never by a coverage percentage. Coverage numbers appear in the report as information only.

## Pick targets by risk (Phase 2)

Rank candidate code by these signals, highest risk first. Every target carries a one-line
`why` naming the signal that selected it; a target with no signal is not a target.

| Signal | How to find it | Example `why` |
|--------|----------------|---------------|
| Changed code | `git diff --name-only <base>...HEAD` in scope | "changed in this branch, no test touches it" |
| Complex branches | nested conditionals, state machines, many early returns | "5 branches on order state, none exercised" |
| Error paths | `catch`, `except`, `throw`/`raise`, retries, timeouts | "retry-exhausted branch never runs in a test" |
| Security paths | auth, permission checks, input validation, secrets, crypto | "role check guards admin export" |
| Money paths | prices, discounts, tax, refunds, currency rounding | "refund rounds to cents" |
| Past bugs | `git log --grep='fix' -- <file>`, linked issues, reverts | "fixed twice in 60 days (see git log)" |

Uncovered lines that match no signal (trivial getters, re-exports, generated code) are
left alone. Handoff shape in `02-cover-analysis.json`:

```json
{"unit": [{"target": "src/billing/refund.ts:roundRefund", "why": "money path, fixed in #812"}]}
```

## What a generated test must do (Phase 3)

A test asserts an observable result: a return value, a thrown error type, persisted state,
an HTTP response, rendered output, a file the code wrote. The checker rejects three shapes.

| Rule | Rejected shape | Write this instead |
|------|----------------|--------------------|
| **a** | Every assertion is on mock calls: `toHaveBeenCalled*`, `.mock.calls`, `assert_called*`, `call_count`, `sinon.assert.*` | Also assert what the code returned or changed. Mock-call assertions are fine next to a result assertion. |
| **b** | No assertion (the test only runs code), or only `not.toThrow()` / `does_not_raise()` | Assert the result. Keep a not-throw-only test only when not throwing IS the contract, and say so in the test name, a comment, or the docstring ("does not throw on empty input"). |
| **c** | Reads the code under test as text: `readFileSync` / `open()` / `read_text()` of a source file, `inspect.getsource`, a `grep` / `rg` subprocess, a `?raw` import | Import or call the code and assert on what it does. Reading fixtures and test data is fine. |

## The checker (Phase 3b, again after Phase 5)

```bash
node "${CLAUDE_SKILL_DIR}/scripts/check-behaviour-tests.mjs" --json <new test files>
```

Run it over the NEW test files only, never the pre-existing suite. Per file it reports
`keep`, `partial` (some tests rejected), `drop` (every test rejected, or no test found), or
`unchecked` (not JavaScript, TypeScript, or Python). Each rejected test has its rule,
line, and reason. Exit `0` means every checked test was kept, `1` means something was rejected,
and `2` means a usage or read error.

On exit `1`: delete each rejected test, or delete the whole file when its verdict is `drop`,
or rewrite the test to assert an observable result. Then re-run the checker until it exits
`0`. Re-run it after Phase 5 as well, because a heal that deletes an assertion to go green is
a rule (b) failure. Record the final verdicts in `03-cover-generation.json` and list every
dropped or rewritten test in the report's Behaviour Gate section.

For `unchecked` files (Go, Rust, others), apply the same three rules by reading each new test.

## Known limits

The checker is static and heuristic. It recognises Jest, Vitest, Playwright, node:assert,
chai, sinon, pytest, and unittest assertions. An assertion hidden in a helper counts only if
the helper is named `expect*` or `assert*` (`assert_*` / `expect_*` in Python), so name
helpers that way. A read is treated as a source read when its path, or a variable declared
from that path, names a code file; paths containing `fixture`, `testdata`, or `__snapshots__`
are exempt.

# Coverage Report Template

Format for the Phase 6 report output.

## Report Structure

```markdown
# Coverage Report: {SCOPE}

## Summary

Coverage is shown as information, never as a target.

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Unit coverage | {N}% | {N}% | +{N}% |
| Integration coverage | {N}% | {N}% | +{N}% |
| E2E coverage | {N}% | {N}% | +{N}% |
| **Overall** | **{N}%** | **{N}%** | **+{N}%** |

## Tests Generated

| Tier | Count | Pass | Healed | Failed |
|------|-------|------|--------|--------|
| Unit | {N} | {N} | {N} | {N} |
| Integration | {N} | {N} | {N} | {N} |
| E2E | {N} | {N} | {N} | {N} |
| **Total** | **{N}** | **{N}** | **{N}** | **{N}** |

Heal iterations used: {N}/{maxIterations}   # denominator is 2 or 3, see heal-loop-strategy.md

## Risk Targets

| Target | Why chosen | Tests kept |
|--------|------------|------------|
| {file}:{symbol} | {changed code / complex branches / error path / security / money / past bug} | {N} |

## Behaviour Gate

Checker: `scripts/check-behaviour-tests.mjs`, final run exit {0|1}.

| Test | Rule | Action |
|------|------|--------|
| {file}:{line} "{name}" | {a: mock calls only / b: no assertion / c: reads source} | {dropped / rewritten} |

## Files Created

{list of test files created, grouped by tier}

## Real Services Used

{list of services started via docker-compose or testcontainers, or "None (mocks only)"}

## Remaining Gaps

{risk targets still without a behaviour test, with reasons}

## Failures (if any)

{tests that could not be healed within the iteration budget, with failure reason and suggested fix}

## Possible Product Bugs (if any)

{one line per heal-loop `possible_product_bugs` entry, its `report` field verbatim:
"possible product bug: expected X, got Y (file:line)". These tests are left failing on
purpose: heal never rewrites an expected value to match current output.}

## Needs a Human (if any)

{one line per heal-loop `needs_human` entry, its `report` field verbatim:
"binding change needs a human: NAME old -> new". The change was reverted and the test left
failing; decide whether it is a fix or a product bug.}

## Next Steps

- `/ork:verify {SCOPE}`: grade the implementation + tests
- `/ork:commit`: commit generated test files
- Fix source bugs detected during test generation (if any)
- Confirm or fix each possible product bug listed above (if any)
- Decide each binding change listed under Needs a Human (if any)
```

## Delta Calculation

```python
# Before: run coverage with existing tests only
baseline = run_coverage(existing_tests)

# After: run coverage with existing + generated tests
final = run_coverage(existing_tests + generated_tests)

# Delta per file
for file in scope_files:
    delta = final[file] - baseline[file]
    # Report files with biggest delta first
```

## Coverage Tool Commands

| Stack | Command | Output |
|-------|---------|--------|
| Vitest | `npx vitest run --coverage --reporter=json` | `coverage/coverage-final.json` |
| Jest | `npx jest --coverage --json` | `coverage/coverage-final.json` |
| pytest | `pytest --cov={scope} --cov-report=json` | `coverage.json` |
| Go | `go test -coverprofile=coverage.out ./...` | `coverage.out` |
| Playwright | Coverage via Istanbul instrumentation | `coverage/` dir |

## No Coverage Targets

There is no percentage to reach. Coverage numbers describe the suite; they never decide
whether to write a test. Targets come from risk (see `behaviour-gate.md`), and a test is
kept only when it asserts behaviour.

# Coverage Report Template

Format for the Phase 6 report output.

## Report Structure

```markdown
# Coverage Report: {SCOPE}

## Summary

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

Heal iterations used: {N}/3

## Files Created

{list of test files created, grouped by tier}

## Real Services Used

{list of services started via docker-compose or testcontainers, or "None (mocks only)"}

## Remaining Gaps

{files or functions still below coverage threshold, with reasons}

## Failures (if any)

{tests that could not be healed after 3 iterations, with failure reason and suggested fix}

## Next Steps

- `/ork:verify {SCOPE}` — grade the implementation + tests
- `/ork:commit` — commit generated test files
- Fix source bugs detected during test generation (if any)
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

## Thresholds

| Tier | Target | Minimum |
|------|--------|---------|
| Unit (business logic) | 90% | 70% |
| Integration (API boundaries) | 80% | 60% |
| E2E (critical user flows) | N/A | Key flows covered |
| Overall | 80% | 70% |

---
name: run-tests
description: Comprehensive test execution with parallel analysis and coverage reporting. Use when running test suites or troubleshooting failures with the run-tests workflow.
context: fork
version: 1.0.0
author: OrchestKit
tags: [testing, pytest, coverage, test-execution]
user-invocable: false
---

# Run Tests

Test execution with parallel analysis agents for failures.

## Quick Start

```bash
/run-tests
/run-tests backend
/run-tests frontend
/run-tests tests/unit/test_auth.py
```

## Test Scope

| Argument | Scope |
|----------|-------|
| Empty/`all` | All tests |
| `backend` | Backend only |
| `frontend` | Frontend only |
| `path/to/test.py` | Specific file |
| `test_name` | Specific test |

## Phase 1: Execute Tests

```bash
# Backend with coverage
cd backend
poetry run pytest tests/unit/ -v --tb=short \
  --cov=app --cov-report=term-missing

# Frontend with coverage
cd frontend
npm run test -- --coverage
```

## Phase 2: Failure Analysis

If tests fail, launch 3 parallel analyzers:
1. **Backend Failure Analysis** - Root cause, fix suggestions
2. **Frontend Failure Analysis** - Component issues, mock problems
3. **Coverage Gap Analysis** - Low coverage areas

## Phase 3: Generate Report

```markdown
# Test Results Report

## Summary
| Suite | Total | Passed | Failed | Coverage |
|-------|-------|--------|--------|----------|
| Backend | X | Y | Z | XX% |
| Frontend | X | Y | Z | XX% |

## Status: [ALL PASS | SOME FAILURES]

## Failures (if any)
| Test | Error | Fix |
|------|-------|-----|
| test_name | AssertionError | [suggestion] |
```

## Quick Commands

```bash
# All backend tests
poetry run pytest tests/unit/ -v --tb=short

# With coverage
poetry run pytest tests/unit/ --cov=app

# Quick (no tracebacks)
poetry run pytest tests/unit/ --tb=no -q

# Specific test
poetry run pytest tests/unit/ -k "test_name" -v

# Frontend
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

## Key Options

| Option | Purpose |
|--------|---------|
| `--maxfail=3` | Stop after 3 failures |
| `-x` | Stop on first failure |
| `--lf` | Run only last failed |
| `-v` | Verbose output |
| `--tb=short` | Shorter tracebacks |

## Related Skills

- `unit-testing` - Unit test patterns and best practices
- `integration-testing` - Integration test patterns for component interactions
- `e2e-testing` - End-to-end testing with Playwright
- `test-data-management` - Test data fixtures and factories

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parallel Analyzers | 3 agents | Backend, frontend, and coverage analysis in parallel |
| Default Traceback | `--tb=short` | Balance between detail and readability |
| Stop Threshold | `--maxfail=3` | Quick feedback without overwhelming output |
| Coverage Tool | pytest-cov / jest | Native integration with test frameworks |

## References

- [Test Commands](references/test-commands.md)
---
title: Parallel Test Execution
impact: HIGH
impactDescription: "Running all tests sequentially wastes CI minutes — parallel execution with failure analysis cuts feedback time by 3-5x"
tags: testing, execution, parallel, pytest, coverage, maxfail, failure-analysis
---

## Parallel Test Execution

Run tests in parallel with smart failure handling and scope-based execution.

**Incorrect — running everything sequentially with full output:**
```bash
# Runs all tests sequentially, floods output, no failure control
pytest tests/ -v
```

**Correct — scoped execution with failure limits and coverage:**
```bash
# Backend with coverage and failure limit
cd backend
poetry run pytest tests/unit/ -v --tb=short \
  --cov=app --cov-report=term-missing \
  --maxfail=3

# Frontend with coverage
cd frontend
npm run test -- --coverage

# Specific test (fast feedback)
poetry run pytest tests/unit/ -k "test_name" -v
```

**Test scope options:**

| Argument | Scope |
|----------|-------|
| Empty / `all` | All tests |
| `backend` | Backend only |
| `frontend` | Frontend only |
| `path/to/test.py` | Specific file |
| `test_name` | Specific test |

**Failure analysis — launch 3 parallel analyzers on failure:**
1. Backend Failure Analysis — root cause, fix suggestions
2. Frontend Failure Analysis — component issues, mock problems
3. Coverage Gap Analysis — low coverage areas

**Key pytest options:**

| Option | Purpose |
|--------|---------|
| `--maxfail=3` | Stop after 3 failures (fast feedback) |
| `-x` | Stop on first failure |
| `--lf` | Run only last failed tests |
| `--tb=short` | Shorter tracebacks (balance detail/readability) |
| `-q` | Quiet mode (minimal output) |

**Key rules:**
- Use `--maxfail=3` in CI for fast feedback without overwhelming output
- Use `--tb=short` by default — `--tb=long` only when debugging specific failures
- Run `--lf` (last-failed) during development for rapid iteration
- Always include `--cov` in CI runs to track coverage trends
- Use `--watch` mode during frontend development for continuous feedback

---
title: Track coverage and run tests in parallel to cut CI feedback time and identify untested critical paths
impact: HIGH
impactDescription: "No coverage tracking lets critical paths go untested — parallel execution with failure analysis cuts feedback time by 3-5x"
tags: testing, coverage, pytest-cov, jest, reporting, gaps, execution, parallel, maxfail, failure-analysis
---

## Coverage Reporting

Track and enforce test coverage to identify untested critical paths.

**Incorrect — running tests without coverage:**
```bash
pytest tests/  # No coverage data — can't identify gaps
npm run test   # No --coverage flag — blind to untested code
```

**Correct — coverage with gap analysis:**
```bash
# Python: pytest-cov with missing line report
poetry run pytest tests/unit/ \
  --cov=app \
  --cov-report=term-missing \
  --cov-report=html:htmlcov

# JavaScript: Jest with coverage
npm run test -- --coverage --coverageReporters=text --coverageReporters=lcov
```

**Coverage report format:**
```markdown
# Test Results Report

## Summary
| Suite | Total | Passed | Failed | Coverage |
|-------|-------|--------|--------|----------|
| Backend | 150 | 148 | 2 | 87% |
| Frontend | 95 | 95 | 0 | 82% |
```

**Coverage targets:**

| Category | Target | Rationale |
|----------|--------|-----------|
| Business logic | 90% | Core value, highest bug risk |
| Integration | 70% | External boundary coverage |
| Critical paths | 100% | Authentication, payments, data integrity |

**Key rules:**
- Use `--cov-report=term-missing` to see exactly which lines are uncovered
- Set minimum coverage thresholds in CI to prevent regression
- Focus on covering critical paths (auth, payments) before chasing overall percentage
- HTML coverage reports (`htmlcov/`) help visualize gap areas during development
- Coverage numbers alone do not indicate test quality — pair with mutation testing for confidence

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

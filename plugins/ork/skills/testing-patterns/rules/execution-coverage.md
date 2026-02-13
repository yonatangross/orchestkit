---
title: Coverage Reporting
impact: HIGH
impactDescription: "No coverage tracking lets critical paths go untested — coverage gaps correlate directly with production bugs"
tags: testing, coverage, pytest-cov, jest, reporting, gaps
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

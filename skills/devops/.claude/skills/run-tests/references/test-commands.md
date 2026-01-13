# Test Commands Reference

## Backend (Python/pytest)

```bash
# All unit tests
poetry run pytest tests/unit/ -v --tb=short

# With coverage
poetry run pytest tests/unit/ --cov=app --cov-report=term-missing

# Specific file
poetry run pytest tests/unit/test_auth.py -v

# Specific test by name
poetry run pytest tests/unit/ -k "test_login" -v

# With markers
poetry run pytest tests/unit/ -m "not slow and not external"

# Quick summary
poetry run pytest tests/unit/ --tb=no -q

# Stop on first failure
poetry run pytest tests/unit/ -x

# Run last failed
poetry run pytest tests/unit/ --lf

# Parallel execution
poetry run pytest tests/unit/ -n auto
```

## Frontend (Node.js/Jest/Vitest)

```bash
# All tests
npm run test

# With coverage
npm run test -- --coverage

# Specific pattern
npm run test -- --testPathPattern="ComponentName"

# Watch mode
npm run test -- --watch

# Update snapshots
npm run test -- -u

# Verbose output
npm run test -- --verbose
```

## Integration Tests

```bash
# Backend integration
poetry run pytest tests/integration/ -v --tb=short

# With database
poetry run pytest tests/integration/ --db-url=$DATABASE_URL

# E2E tests
npm run test:e2e
```

## Coverage Thresholds

| Area | Minimum |
|------|---------|
| Overall | 70% |
| Critical paths | 90% |
| New code | 80% |
# Pytest Production Checklist

## Configuration
- [ ] `pyproject.toml` has all custom markers defined
- [ ] `conftest.py` at project root for shared fixtures
- [ ] pytest-asyncio mode configured (`mode = "auto"`)
- [ ] Coverage thresholds set (`--cov-fail-under=80`)

## Markers
- [ ] All tests have appropriate markers (smoke, integration, db, slow)
- [ ] Marker filter expressions tested (`pytest -m "not slow"`)
- [ ] CI pipeline uses marker filtering

## Parallel Execution
- [ ] pytest-xdist configured (`-n auto --dist loadscope`)
- [ ] Worker isolation verified (no shared state)
- [ ] Database fixtures use `worker_id` for isolation
- [ ] Redis/external services use unique namespaces per worker

## Fixtures
- [ ] Expensive fixtures use `scope="session"` or `scope="module"`
- [ ] Factory fixtures for complex object creation
- [ ] All fixtures have proper cleanup (yield + teardown)
- [ ] No global state mutations in fixtures

## Performance
- [ ] Slow tests marked with `@pytest.mark.slow`
- [ ] No unnecessary `time.sleep()` (use mocking)
- [ ] Large datasets use lazy loading
- [ ] Timing reports enabled for slow test detection

## CI/CD
- [ ] Tests run in parallel in CI
- [ ] Coverage reports uploaded
- [ ] Test results in JUnit XML format
- [ ] Flaky test detection enabled

## Code Quality
- [ ] No skipped tests without reasons (`@pytest.mark.skip(reason="...")`)
- [ ] xfail tests have documented reasons
- [ ] Parametrized tests have descriptive IDs
- [ ] Test names follow convention (`test_<what>_<condition>_<expected>`)

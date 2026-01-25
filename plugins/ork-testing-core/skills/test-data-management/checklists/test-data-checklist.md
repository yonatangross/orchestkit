# Test Data Management Checklist

## Fixtures

- [ ] Use factories over hardcoded data
- [ ] Minimal required fields
- [ ] Randomize non-essential data
- [ ] Version control fixtures

## Data Generation

- [ ] Faker for realistic data
- [ ] Consistent seeds for reproducibility
- [ ] Edge case generators
- [ ] Bulk generation for perf tests

## Database

- [ ] Transaction rollback for isolation
- [ ] Per-test database when needed
- [ ] Proper cleanup order
- [ ] Handle foreign keys

## Cleanup

- [ ] Clean up after each test
- [ ] Handle test failures
- [ ] Verify clean state
- [ ] Prevent data leaks

## Best Practices

- [ ] No test interdependencies
- [ ] Factories over fixtures
- [ ] Meaningful test data
- [ ] Document data requirements

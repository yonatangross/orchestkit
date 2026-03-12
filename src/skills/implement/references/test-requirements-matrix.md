# Test Requirements Matrix

Phase 5 test-generator MUST produce tests matching the change type.

## Required Tests by Change Type

| Change Type | Required Tests | Testing Rules |
|-------------|---------------|--------------------------|
| API endpoint | Unit + Integration + Contract | `integration-api`, `verification-contract`, `mocking-msw` |
| DB schema/migration | Migration + Integration | `integration-database`, `data-seeding-cleanup` |
| UI component | Unit + Snapshot + A11y | `unit-aaa-pattern`, `integration-component`, `a11y-testing`, `e2e-playwright` |
| Business logic | Unit + Property-based | `unit-aaa-pattern`, `pytest-execution`, `verification-techniques` |
| LLM/AI feature | Unit + Eval | `llm-evaluation`, `llm-mocking` |
| Full-stack feature | All of the above | All matching rules |

## Real-Service Detection (Phase 6)

Before running integration tests, detect infrastructure:

```python
# Auto-detect real service testing capability (PARALLEL)
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/testcontainers*")
Grep(pattern="testcontainers|docker-compose", glob="requirements*.txt")
Grep(pattern="testcontainers|docker-compose", glob="package.json")
```

If detected: run integration tests against real services, not just mocks. Reference `testing-integration` rules: `integration-database`, `integration-api`, `data-seeding-cleanup`.

## Phase 9 Gate

**Do NOT proceed to Phase 9 (Documentation) if test-generator produced 0 tests.** Return to Phase 5 and generate tests for the implemented code.

## Test Coverage Expectations

| Tier | Minimum Coverage | Notes |
|------|-----------------|-------|
| 1. Interview | Happy path only | Focus on correctness, not coverage |
| 2. Hackathon | None required | Tests are bonus |
| 3. MVP | Unit + 1 integration | Cover critical paths |
| 4-5. Growth/Enterprise | Unit + integration + e2e | Full matrix above applies |
| 6. Open Source | Exhaustive | Every public API must have tests |

## Test Runner Detection

```python
# Detect test framework (PARALLEL)
Glob(pattern="**/jest.config*")
Glob(pattern="**/vitest.config*")
Glob(pattern="**/pytest.ini")
Glob(pattern="**/pyproject.toml")
Grep(pattern="\"test\":", glob="package.json")
```

Use the detected runner for all generated tests. Do not introduce a new test framework unless the project has none.

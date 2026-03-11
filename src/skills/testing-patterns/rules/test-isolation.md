---
title: Tests must not depend on execution order or shared mutable state between test cases
impact: HIGH
impactDescription: "Order-dependent tests pass in CI by luck, then fail intermittently when parallelized or reordered, wasting hours on debugging phantom failures"
tags: [testing, isolation, flaky, state, parallel]
---

# Test Isolation — No Shared State or Order Dependency

## Why

Tests that share mutable state or depend on execution order are the #1 source of flaky tests. They pass when run sequentially in a specific order but fail when parallelized, shuffled, or run individually. Debugging flaky tests wastes more time than writing isolated tests.

## Rule

Every test must:
1. Set up its own state in `beforeEach` / `setUp` / arrange phase
2. Clean up after itself (or use fresh fixtures)
3. Pass when run in isolation (`test.only` / `-k test_name`)
4. Pass when run in any order (shuffle mode)

## Incorrect — tests share mutable state

```typescript
// Shared state between tests — order dependent
describe("UserService", () => {
  const users: User[] = [];  // Shared mutable array

  test("creates a user", () => {
    users.push({ id: 1, name: "Alice" });
    expect(users).toHaveLength(1);
  });

  test("finds the user", () => {
    // DEPENDS on "creates a user" running first
    const found = users.find(u => u.name === "Alice");
    expect(found).toBeDefined();
  });

  test("deletes the user", () => {
    // DEPENDS on both previous tests
    users.splice(0, 1);
    expect(users).toHaveLength(0);
  });
});
```

```python
# Module-level state — tests pollute each other
_cache = {}

def test_add_to_cache():
    _cache["key"] = "value"
    assert _cache["key"] == "value"

def test_cache_is_empty():
    # FAILS if test_add_to_cache runs first
    assert len(_cache) == 0
```

## Correct — each test owns its state

```typescript
describe("UserService", () => {
  let service: UserService;
  let db: TestDatabase;

  beforeEach(() => {
    db = new TestDatabase();        // Fresh DB per test
    service = new UserService(db);  // Fresh service per test
  });

  afterEach(() => {
    db.cleanup();
  });

  test("creates a user", async () => {
    const user = await service.create({ name: "Alice" });
    expect(user.id).toBeDefined();
  });

  test("finds a user by name", async () => {
    // Arrange: create its own user, does not rely on other tests
    await service.create({ name: "Bob" });

    // Act
    const found = await service.findByName("Bob");

    // Assert
    expect(found?.name).toBe("Bob");
  });
});
```

```python
import pytest

@pytest.fixture
def cache():
    """Fresh cache for each test."""
    return {}

def test_add_to_cache(cache):
    cache["key"] = "value"
    assert cache["key"] == "value"

def test_cache_starts_empty(cache):
    # Always passes — gets its own empty cache
    assert len(cache) == 0
```

## Verification

```bash
# Run tests in random order to detect order dependency
# Jest
jest --randomize

# pytest
pytest -p randomly

# Run single test in isolation
jest --testNamePattern="finds a user"
pytest -k "test_cache_starts_empty"
```

## Common Isolation Violations

| Violation | Fix |
|-----------|-----|
| Shared array/object between tests | Move to `beforeEach` |
| Database not reset between tests | Use transactions + rollback |
| Global singleton with state | Reset in `beforeEach` or use DI |
| File system side effects | Use temp directories per test |
| Environment variable mutations | Save/restore in setup/teardown |

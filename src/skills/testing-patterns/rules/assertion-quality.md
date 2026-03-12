---
title: Assertions must test observable behavior, not implementation details
impact: MEDIUM
impactDescription: "Implementation-coupled assertions break on every refactor, creating maintenance burden without catching real bugs"
tags: [testing, assertions, behavior, refactoring, maintainability]
---

# Assert Behavior, Not Implementation

## Why

Tests that assert implementation details (internal method calls, private state, specific SQL queries) break on every refactor even when the behavior is unchanged. This creates a maintenance burden where developers spend more time fixing tests than writing features — and the tests never catch real bugs.

## Rule

Assertions must verify:
1. Return values and output (what the function produces)
2. Side effects on public interfaces (what changed externally)
3. Error behavior (what happens when things go wrong)

Assertions must NOT verify:
1. Internal method call counts or order
2. Private state or internal data structures
3. Specific implementation mechanisms (SQL text, HTTP internals)

## Incorrect — testing implementation details

```typescript
test("creates user", async () => {
  const spy = jest.spyOn(db, "query");

  await userService.create({ name: "Alice", email: "alice@test.com" });

  // Asserts exact SQL — breaks if column order changes or ORM upgrades
  expect(spy).toHaveBeenCalledWith(
    "INSERT INTO users (name, email) VALUES ($1, $2)",
    ["Alice", "alice@test.com"]
  );
  // Asserts call count — breaks if implementation adds a cache write
  expect(spy).toHaveBeenCalledTimes(1);
});
```

```python
def test_process_order(mocker):
    mock_validate = mocker.patch.object(order_service, "_validate_items")
    mock_calc = mocker.patch.object(order_service, "_calculate_total")

    order_service.process(order)

    # Asserts internal method calls — breaks on any refactor
    mock_validate.assert_called_once_with(order.items)
    mock_calc.assert_called_once_with(order.items, order.discount)
```

## Correct — testing observable behavior

```typescript
test("creates user and returns it with generated id", async () => {
  const result = await userService.create({
    name: "Alice",
    email: "alice@test.com"
  });

  // Assert return value (behavior)
  expect(result.id).toBeDefined();
  expect(result.name).toBe("Alice");
  expect(result.email).toBe("alice@test.com");

  // Assert side effect via public interface (behavior)
  const fetched = await userService.findById(result.id);
  expect(fetched?.name).toBe("Alice");
});
```

```python
def test_process_order_calculates_total():
    order = Order(
        items=[Item(price=10, qty=2), Item(price=5, qty=1)],
        discount=0.1
    )

    result = order_service.process(order)

    # Assert output (behavior)
    assert result.total == 22.50  # (10*2 + 5*1) * 0.9
    assert result.status == "confirmed"
```

## Assertion Quality Checklist

```typescript
// BAD: Asserts HOW (implementation)
expect(mockDb.query).toHaveBeenCalledWith(/* specific SQL */);
expect(internalCache.size).toBe(1);
expect(privatMethod).toHaveBeenCalledTimes(3);

// GOOD: Asserts WHAT (behavior)
expect(result.id).toBeDefined();              // Output value
expect(await service.findById(id)).toBeTruthy(); // Side effect
expect(() => service.create(invalid)).toThrow(); // Error behavior
```

## When Mocks Are Acceptable

| Scenario | Mock OK | Assert On |
|----------|---------|-----------|
| External API calls | Yes — mock the HTTP client | Response handling behavior |
| Database in unit tests | Yes — mock the repository | Return values and errors |
| Internal private methods | No — do not mock | Test via public interface |
| Time-dependent logic | Yes — mock `Date.now` | Correct output for given time |
| File system | Yes — mock fs calls | Correct file content written |

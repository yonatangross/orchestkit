---
title: "Unit: AAA Pattern"
category: unit
impact: CRITICAL
impactDescription: "Enforces Arrange-Act-Assert structure for clear, maintainable unit tests with proper isolation"
tags: unit-testing, aaa-pattern, test-structure, isolation, best-practices
---

# AAA Pattern (Arrange-Act-Assert)

## TypeScript (Vitest)

```typescript
describe('calculateDiscount', () => {
  test('applies 10% discount for orders over $100', () => {
    // Arrange
    const order = { items: [{ price: 150 }] };

    // Act
    const result = calculateDiscount(order);

    // Assert
    expect(result).toBe(15);
  });
});
```

## Test Isolation

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepo: MockRepository;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new UserService(mockRepo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
```

## Python (pytest)

```python
class TestCalculateDiscount:
    def test_applies_discount_over_threshold(self):
        # Arrange
        order = Order(total=150)

        # Act
        discount = calculate_discount(order)

        # Assert
        assert discount == 15
```

## Coverage Targets

| Area | Target |
|------|--------|
| Business logic | 90%+ |
| Critical paths | 100% |
| New features | 100% |
| Utilities | 80%+ |

## Common Mistakes

- Testing implementation, not behavior
- Slow tests (external calls)
- Shared state between tests
- Over-mocking (testing mocks not code)

**Incorrect — Testing implementation details:**
```typescript
test('updates internal state', () => {
  const service = new UserService();
  service.setEmail('test@example.com');
  expect(service._email).toBe('test@example.com');  // Private field
});
```

**Correct — Testing public behavior with AAA pattern:**
```typescript
test('updates user email', () => {
  // Arrange
  const service = new UserService();

  // Act
  service.updateEmail('test@example.com');

  // Assert
  expect(service.getEmail()).toBe('test@example.com');
});
```

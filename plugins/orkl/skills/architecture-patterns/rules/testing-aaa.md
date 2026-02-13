---
title: "Testing: AAA Pattern & Isolation"
category: testing
impact: MEDIUM
impactDescription: Structured test patterns ensure reliable, maintainable test suites
tags: [testing, aaa, arrange-act-assert, isolation, parameterized]
---

# AAA Pattern & Test Isolation

## TypeScript AAA

```typescript
describe('calculateDiscount', () => {
  test('should apply 10% discount for orders over $100', () => {
    // Arrange
    const order = createOrder({ total: 150 });
    const calculator = new DiscountCalculator();

    // Act
    const discount = calculator.calculate(order);

    // Assert
    expect(discount).toBe(15);
  });
});
```

## Python AAA

```python
class TestCalculateDiscount:
    def test_applies_10_percent_discount_over_threshold(self):
        # Arrange
        order = Order(total=150)
        calculator = DiscountCalculator()

        # Act
        discount = calculator.calculate(order)

        # Assert
        assert discount == 15
```

## Test Isolation

```typescript
// GOOD - Reset state in beforeEach
describe('ItemList', () => {
  let items: string[];
  beforeEach(() => { items = []; });

  test('adds item', () => {
    items.push('a');
    expect(items).toHaveLength(1);
  });

  test('starts empty', () => {
    expect(items).toHaveLength(0);
  });
});
```

## Parameterized Tests

```python
@pytest.mark.parametrize("email,expected", [
    ("user@example.com", True),
    ("invalid", False),
    ("@missing.com", False),
])
def test_email_validation(self, email: str, expected: bool):
    assert is_valid_email(email) == expected
```

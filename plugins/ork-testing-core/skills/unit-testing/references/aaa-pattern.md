# AAA Pattern (Arrange-Act-Assert)

Structure every test with three clear phases for readability and maintainability.

## Implementation

```python
import pytest
from decimal import Decimal
from app.services.pricing import PricingCalculator

class TestPricingCalculator:
    def test_applies_bulk_discount_when_quantity_exceeds_threshold(self):
        # Arrange
        calculator = PricingCalculator(bulk_threshold=10)
        base_price = Decimal("100.00")
        quantity = 15

        # Act
        total = calculator.calculate_total(base_price, quantity)

        # Assert
        expected = Decimal("1275.00")  # 15 * 100 * 0.85
        assert total == expected
        assert calculator.discount_applied is True

    def test_no_discount_below_threshold(self):
        # Arrange
        calculator = PricingCalculator(bulk_threshold=10)
        base_price = Decimal("100.00")
        quantity = 5

        # Act
        total = calculator.calculate_total(base_price, quantity)

        # Assert
        assert total == Decimal("500.00")
        assert calculator.discount_applied is False
```

## TypeScript Version

```typescript
describe('PricingCalculator', () => {
  test('applies bulk discount when quantity exceeds threshold', () => {
    // Arrange
    const calculator = new PricingCalculator({ bulkThreshold: 10 });
    const basePrice = 100;
    const quantity = 15;

    // Act
    const total = calculator.calculateTotal(basePrice, quantity);

    // Assert
    expect(total).toBe(1275); // 15 * 100 * 0.85
    expect(calculator.discountApplied).toBe(true);
  });
});
```

## Checklist

- [ ] Arrange section sets up all preconditions and inputs
- [ ] Act section executes exactly one action being tested
- [ ] Assert section verifies all expected outcomes
- [ ] Comments clearly separate each phase
- [ ] No logic between Act and Assert phases
- [ ] Single behavior tested per test method
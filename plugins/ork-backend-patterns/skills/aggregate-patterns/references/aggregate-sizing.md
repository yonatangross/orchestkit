# Aggregate Sizing Guidelines

## Size Trade-offs

| Factor | Small Aggregates | Large Aggregates |
|--------|------------------|------------------|
| Concurrency | High (fewer conflicts) | Low (more conflicts) |
| Consistency | Eventual (cross-aggregate) | Strong (within aggregate) |
| Performance | Fast operations | Slower (load entire graph) |
| Complexity | Coordination needed | Self-contained |

## Sizing Decision Tree

```
START: Define your aggregate boundary
    │
    ▼
┌─────────────────────────────────────┐
│ Can this invariant be enforced     │
│ eventually (via events)?           │
├─────────────────────────────────────┤
│ YES → Separate aggregates          │
│ NO  → Same aggregate               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Are entities modified together     │
│ in the same transaction?           │
├─────────────────────────────────────┤
│ YES → Consider same aggregate      │
│ NO  → Separate aggregates          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Would the aggregate have >1000     │
│ child entities in production?      │
├─────────────────────────────────────┤
│ YES → Split (use reference by ID)  │
│ NO  → Keep together                │
└─────────────────────────────────────┘
```

## Example: Order Aggregate

### Too Large (Anti-pattern)

```python
# WRONG: Order contains full Product and Customer entities
@dataclass
class Order(Entity):
    customer: Customer  # Full entity - BAD
    items: list[OrderItem]
    products: list[Product]  # Full entities - BAD

    def add_item(self, product: Product):
        # Must load entire product catalog!
        self.products.append(product)
```

### Right Size

```python
# GOOD: Order references by ID, contains only what it owns
@dataclass
class Order(Entity):
    customer_id: UUID  # Reference by ID
    items: list[OrderItem]  # Owned entities
    status: OrderStatus
    total: Money

    def add_item(self, product_id: UUID, price: Money, quantity: int) -> None:
        """Add item using product snapshot (not full product)."""
        item = OrderItem(
            product_id=product_id,  # Reference by ID
            unit_price=price,  # Snapshot at order time
            quantity=quantity,
        )
        self.items.append(item)
        self._recalculate_total()
```

## When to Combine

**Combine into one aggregate when:**
- Invariants require immediate consistency
- Entities have same lifecycle (created/deleted together)
- Operations always involve both entities
- Collection is bounded (< 100 items typical)

```python
# GOOD: Order and OrderItems in same aggregate
# - Items can't exist without Order
# - Order total depends on all items (invariant)
# - Items list is bounded (typical order < 50 items)

@dataclass
class Order(Entity):
    items: list[OrderItem] = field(default_factory=list)

    def add_item(self, item: OrderItem) -> None:
        if len(self.items) >= 100:
            raise ValueError("Order cannot have more than 100 items")
        self.items.append(item)
        self._enforce_total_invariant()
```

## When to Separate

**Separate into different aggregates when:**
- Different update frequencies
- Different access patterns
- Unbounded collections
- Different ownership/lifecycle

```python
# GOOD: Order and Reviews are separate aggregates
# - Reviews added long after order placed
# - Reviews can be deleted without affecting order
# - Order can have unbounded reviews over time

@dataclass
class Order(Entity):
    # ... order data, no reviews here

@dataclass
class ProductReview(Entity):
    order_id: UUID  # Reference, not containment
    product_id: UUID
    rating: int
    comment: str
```

## Reference by ID Pattern

```python
from uuid import UUID
from uuid_utils import uuid7


@dataclass
class Order(Entity):
    """Order aggregate references other aggregates by ID."""

    customer_id: UUID  # Reference to Customer aggregate
    shipping_address_id: UUID | None = None  # Reference to Address aggregate

    async def assign_shipping(
        self,
        address_id: UUID,
        address_repo: AddressRepository,
    ) -> None:
        """Validate reference exists before assigning."""
        # Validate the referenced aggregate exists
        address = await address_repo.get(address_id)
        if not address:
            raise ValueError(f"Address {address_id} not found")
        if address.customer_id != self.customer_id:
            raise ValueError("Address doesn't belong to customer")

        self.shipping_address_id = address_id
```

## Aggregate Size Metrics

```python
# Monitor aggregate size in production
class AggregateMetrics:
    @staticmethod
    def check_order_size(order: Order) -> dict:
        """Check if order aggregate is getting too large."""
        return {
            "item_count": len(order.items),
            "is_oversized": len(order.items) > 50,
            "recommendation": (
                "Consider archiving old items"
                if len(order.items) > 50
                else "Size OK"
            ),
        }
```

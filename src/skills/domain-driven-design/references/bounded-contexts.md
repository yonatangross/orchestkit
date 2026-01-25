# Bounded Contexts

## Context Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        E-Commerce System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│   │   Identity   │      │   Catalog    │      │   Orders     │  │
│   │   Context    │      │   Context    │      │   Context    │  │
│   ├──────────────┤      ├──────────────┤      ├──────────────┤  │
│   │ • User       │      │ • Product    │      │ • Order      │  │
│   │ • Account    │ ──── │ • Category   │ ──── │ • LineItem   │  │
│   │ • Auth       │ ACL  │ • Price      │ ACL  │ • Payment    │  │
│   └──────────────┘      └──────────────┘      └──────────────┘  │
│          │                     │                     │          │
│          └─────────────────────┼─────────────────────┘          │
│                                │                                 │
│                    ┌──────────────────────┐                     │
│                    │     Shared Kernel    │                     │
│                    │  • Money VO          │                     │
│                    │  • Email VO          │                     │
│                    │  • Address VO        │                     │
│                    └──────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

ACL = Anti-Corruption Layer
```

## Context Integration Patterns

| Pattern | Use When | Direction |
|---------|----------|-----------|
| **Shared Kernel** | Teams collaborate closely | Bidirectional |
| **Customer-Supplier** | Upstream provides, downstream consumes | Unidirectional |
| **Conformist** | Must follow external model | Unidirectional |
| **Anti-Corruption Layer** | Protect domain from external changes | Inbound |
| **Open Host Service** | Provide API for many consumers | Outbound |
| **Published Language** | Standard schema (e.g., events) | Bidirectional |

## Anti-Corruption Layer

```python
# orders/infrastructure/catalog_acl.py
"""Anti-Corruption Layer for Catalog context."""

from dataclasses import dataclass
from uuid import UUID

from orders.domain.value_objects import ProductSnapshot


@dataclass
class CatalogACL:
    """Translate Catalog context to Orders context."""

    def __init__(self, catalog_client: "CatalogServiceClient"):
        self._catalog = catalog_client

    async def get_product_snapshot(self, product_id: UUID) -> ProductSnapshot:
        """Get product data as Orders context value object.

        Translates Catalog's Product entity to Orders' ProductSnapshot VO.
        This protects Orders from Catalog's internal model changes.
        """
        # Call external Catalog service
        catalog_product = await self._catalog.get_product(product_id)

        # Translate to our domain model
        return ProductSnapshot(
            product_id=catalog_product.id,
            name=catalog_product.name,
            price=Money(
                amount=catalog_product.current_price,
                currency=catalog_product.price_currency,
            ),
            sku=catalog_product.sku,
            # Ignore Catalog-specific fields we don't need
            # like: catalog_product.category_id, .supplier_id, etc.
        )


# orders/domain/value_objects.py
@dataclass(frozen=True)
class ProductSnapshot:
    """Snapshot of product at order time.

    Orders context doesn't track product changes - it captures
    a snapshot when the order is created.
    """

    product_id: UUID
    name: str
    price: Money
    sku: str
```

## Context Boundaries in Code

```
src/
├── identity/              # Identity Bounded Context
│   ├── domain/
│   │   ├── entities/
│   │   │   └── user.py
│   │   ├── value_objects/
│   │   │   └── email.py
│   │   └── repositories/
│   │       └── user_repository.py
│   ├── application/
│   │   └── services/
│   │       └── auth_service.py
│   └── infrastructure/
│       └── repositories/
│           └── sqlalchemy_user_repository.py
│
├── catalog/               # Catalog Bounded Context
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── product.py
│   │   │   └── category.py
│   │   └── value_objects/
│   │       └── price.py
│   └── ...
│
├── orders/                # Orders Bounded Context
│   ├── domain/
│   │   ├── entities/
│   │   │   └── order.py
│   │   └── value_objects/
│   │       └── product_snapshot.py  # Local copy, not shared!
│   └── infrastructure/
│       └── acl/
│           ├── catalog_acl.py      # Anti-corruption layer
│           └── identity_acl.py
│
└── shared_kernel/         # Shared across contexts
    └── value_objects/
        ├── money.py
        └── address.py
```

## Cross-Context Communication

```python
# Using domain events for loose coupling
# orders/application/services/order_service.py

class OrderService:
    """Order service publishes events for other contexts."""

    async def place_order(self, order: Order) -> None:
        order.place()
        await self._repo.update(order)

        # Publish event - other contexts subscribe
        await self._events.publish(OrderPlaced(
            order_id=order.id,
            customer_id=order.customer_id,
            items=[
                {"product_id": str(i.product_id), "quantity": i.quantity}
                for i in order.items
            ],
        ))


# inventory/application/handlers/order_handlers.py

class OrderEventHandler:
    """Inventory context handles order events."""

    async def handle_order_placed(self, event: dict) -> None:
        """Reserve inventory when order placed."""
        for item in event["items"]:
            await self._inventory.reserve(
                product_id=UUID(item["product_id"]),
                quantity=item["quantity"],
                order_id=UUID(event["order_id"]),
            )
```

## Context Mapping Decisions

```python
# When to use Shared Kernel
# - Both teams own the code
# - Changes require coordination
# - Strong consistency needed

# shared_kernel/value_objects/money.py
@dataclass(frozen=True)
class Money:
    """Shared by Catalog, Orders, Payments contexts."""
    amount: Decimal
    currency: str


# When to use ACL
# - External system you don't control
# - Legacy system with different model
# - Third-party API

# orders/infrastructure/acl/payment_gateway_acl.py
class PaymentGatewayACL:
    """Translate Stripe API to our Payment model."""

    async def charge(self, payment: Payment) -> PaymentResult:
        # Call Stripe with their model
        stripe_charge = await self._stripe.create_charge(
            amount=int(payment.amount.amount * 100),  # Stripe uses cents
            currency=payment.amount.currency.lower(),
            source=payment.stripe_token,
        )

        # Translate back to our model
        return PaymentResult(
            success=stripe_charge.status == "succeeded",
            transaction_id=stripe_charge.id,
            error=stripe_charge.failure_message,
        )
```

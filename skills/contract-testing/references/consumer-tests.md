# Consumer-Side Contract Tests

## Pact Python Setup (2026)

```python
# conftest.py
import pytest
from pact import Consumer, Provider

@pytest.fixture(scope="module")
def pact():
    """Configure Pact consumer."""
    pact = Consumer("OrderService").has_pact_with(
        Provider("UserService"),
        pact_dir="./pacts",
        log_dir="./logs",
    )
    pact.start_service()
    yield pact
    pact.stop_service()
    pact.verify()  # Generates pact file
```

## Matchers Reference

| Matcher | Purpose | Example |
|---------|---------|---------|
| `Like(value)` | Match type, not value | `Like("user-123")` |
| `EachLike(template, min)` | Array of matching items | `EachLike({"id": Like("x")}, minimum=1)` |
| `Term(regex, example)` | Regex pattern match | `Term(r"\\d{4}-\\d{2}-\\d{2}", "2024-01-15")` |
| `Format().uuid()` | UUID format | Auto-validates UUID strings |
| `Format().iso_8601_datetime()` | ISO datetime | `2024-01-15T10:30:00Z` |

## Complete Consumer Test

```python
from pact import Like, EachLike, Term, Format

def test_get_order_with_user(pact):
    """Test order retrieval includes user details."""
    (
        pact
        .given("order ORD-001 exists with user USR-001")
        .upon_receiving("a request for order ORD-001")
        .with_request(
            method="GET",
            path="/api/orders/ORD-001",
            headers={"Authorization": "Bearer token"},
        )
        .will_respond_with(
            status=200,
            headers={"Content-Type": "application/json"},
            body={
                "id": Like("ORD-001"),
                "status": Term(r"pending|confirmed|shipped", "pending"),
                "user": {
                    "id": Like("USR-001"),
                    "email": Term(r".+@.+\\..+", "user@example.com"),
                },
                "items": EachLike(
                    {
                        "product_id": Like("PROD-001"),
                        "quantity": Like(1),
                        "price": Like(29.99),
                    },
                    minimum=1,
                ),
                "created_at": Format().iso_8601_datetime(),
            },
        )
    )

    with pact:
        client = OrderClient(base_url=pact.uri)
        order = client.get_order("ORD-001", token="token")

        assert order.id == "ORD-001"
        assert order.user.email is not None
        assert len(order.items) >= 1
```

## Testing Mutations

```python
def test_create_order(pact):
    """Test order creation contract."""
    request_body = {
        "user_id": "USR-001",
        "items": [{"product_id": "PROD-001", "quantity": 2}],
    }

    (
        pact
        .given("user USR-001 exists and product PROD-001 is available")
        .upon_receiving("a request to create an order")
        .with_request(
            method="POST",
            path="/api/orders",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer token",
            },
            body=request_body,
        )
        .will_respond_with(
            status=201,
            body={
                "id": Like("ORD-NEW"),
                "status": "pending",
                "user_id": "USR-001",
            },
        )
    )

    with pact:
        client = OrderClient(base_url=pact.uri)
        order = client.create_order(
            user_id="USR-001",
            items=[{"product_id": "PROD-001", "quantity": 2}],
            token="token",
        )
        assert order.status == "pending"
```

## Provider States Best Practices

```python
# Good: Business-language states
.given("user USR-001 exists")
.given("order ORD-001 is in pending status")
.given("product PROD-001 has 10 items in stock")

# Bad: Implementation details
.given("database has user with id 1")  # AVOID
.given("redis cache is empty")  # AVOID
```

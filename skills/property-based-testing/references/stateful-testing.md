# Stateful Testing with Hypothesis

## RuleBasedStateMachine

Stateful testing lets Hypothesis choose **actions** as well as values, testing sequences of operations.

```python
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition

class ShoppingCartMachine(RuleBasedStateMachine):
    """Test shopping cart state transitions."""

    def __init__(self):
        super().__init__()
        self.cart = ShoppingCart()
        self.model_items = {}  # Our model of expected state

    # =========== Rules (Actions) ===========

    @rule(product_id=st.uuids(), quantity=st.integers(min_value=1, max_value=10))
    def add_item(self, product_id, quantity):
        """Add item to cart."""
        self.cart.add(product_id, quantity)
        self.model_items[product_id] = self.model_items.get(product_id, 0) + quantity

    @rule(product_id=st.uuids())
    @precondition(lambda self: len(self.model_items) > 0)
    def remove_item(self, product_id):
        """Remove item from cart."""
        if product_id in self.model_items:
            self.cart.remove(product_id)
            del self.model_items[product_id]

    @rule()
    @precondition(lambda self: len(self.model_items) > 0)
    def clear_cart(self):
        """Clear all items."""
        self.cart.clear()
        self.model_items.clear()

    # =========== Invariants ===========

    @invariant()
    def item_count_matches(self):
        """Cart item count matches model."""
        assert len(self.cart.items) == len(self.model_items)

    @invariant()
    def quantities_match(self):
        """All quantities match model."""
        for product_id, quantity in self.model_items.items():
            assert self.cart.get_quantity(product_id) == quantity

    @invariant()
    def no_negative_quantities(self):
        """Quantities are never negative."""
        for item in self.cart.items:
            assert item.quantity >= 0


# Run the tests
TestShoppingCart = ShoppingCartMachine.TestCase
```

## Bundles (Data Flow Between Rules)

```python
from hypothesis.stateful import Bundle, consumes

class DatabaseMachine(RuleBasedStateMachine):
    """Test database operations with data flow."""

    # Bundles hold generated values for reuse
    users = Bundle("users")

    @rule(target=users, email=st.emails(), name=st.text(min_size=1))
    def create_user(self, email, name):
        """Create user and add to bundle."""
        user = self.db.create_user(email=email, name=name)
        return user.id  # Added to 'users' bundle

    @rule(user_id=users, new_name=st.text(min_size=1))
    def update_user(self, user_id, new_name):
        """Update user from bundle."""
        self.db.update_user(user_id, name=new_name)

    @rule(user_id=consumes(users))  # Remove from bundle after use
    def delete_user(self, user_id):
        """Delete user, remove from bundle."""
        self.db.delete_user(user_id)
```

## Initialize Rules

```python
class OrderSystemMachine(RuleBasedStateMachine):

    @initialize()
    def setup_customer(self):
        """Run exactly once before any rules."""
        self.customer = Customer.create()

    @initialize(target=products, count=st.integers(min_value=1, max_value=5))
    def setup_products(self, count):
        """Can return values to bundles."""
        for _ in range(count):
            product = Product.create()
            return product.id
```

## Settings for Stateful Tests

```python
from hypothesis import settings, Phase

@settings(
    max_examples=100,           # Number of test runs
    stateful_step_count=50,     # Max steps per run
    deadline=None,              # Disable timeout
    phases=[Phase.generate],    # Skip shrinking for speed
)
class MyStateMachine(RuleBasedStateMachine):
    pass
```

## Debugging Stateful Tests

When a test fails, Hypothesis prints the sequence of steps:

```
Falsifying example:
state = MyStateMachine()
state.add_item(product_id=UUID('...'), quantity=5)
state.add_item(product_id=UUID('...'), quantity=3)
state.remove_item(product_id=UUID('...'))  # Failure here
state.teardown()
```

You can replay this exact sequence to debug.

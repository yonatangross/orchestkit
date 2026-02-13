---
title: "Verification: Stateful Testing"
category: verification
impact: MEDIUM
---

# Stateful Testing

## RuleBasedStateMachine

Model state transitions and verify invariants.

```python
from hypothesis.stateful import RuleBasedStateMachine, rule, precondition

class CartStateMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.cart = Cart()
        self.expected_items = []

    @rule(item=st.text(min_size=1))
    def add_item(self, item):
        self.cart.add(item)
        self.expected_items.append(item)
        assert len(self.cart) == len(self.expected_items)

    @precondition(lambda self: len(self.expected_items) > 0)
    @rule()
    def remove_last(self):
        self.cart.remove_last()
        self.expected_items.pop()

    @rule()
    def clear(self):
        self.cart.clear()
        self.expected_items.clear()
        assert len(self.cart) == 0

TestCart = CartStateMachine.TestCase
```

## Schemathesis API Fuzzing

```bash
# Fuzz test API from OpenAPI spec
schemathesis run http://localhost:8000/openapi.json --checks all
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER ignore failing examples
@given(st.integers())
def test_bad(x):
    if x == 42:
        return  # WRONG - hiding failure!

# NEVER use unbounded inputs
@given(st.text())  # WRONG - includes 10MB strings
def test_username(name):
    User(name=name)
```

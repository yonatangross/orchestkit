# Hypothesis Strategies Guide

## Primitive Strategies

```python
from hypothesis import strategies as st

# Numbers
st.integers()                              # Any integer
st.integers(min_value=0, max_value=100)    # Bounded
st.floats(allow_nan=False, allow_infinity=False)  # "Real" floats
st.decimals(min_value=0, max_value=1000)   # Decimal precision

# Strings
st.text()                                  # Any unicode
st.text(min_size=1, max_size=100)          # Bounded length
st.text(alphabet=st.characters(whitelist_categories=('L', 'N')))  # Alphanumeric
st.from_regex(r"[a-z]+@[a-z]+\.[a-z]{2,}")  # Email-like

# Collections
st.lists(st.integers())                    # List of integers
st.lists(st.integers(), min_size=1, unique=True)  # Non-empty, unique
st.sets(st.integers(), min_size=1)         # Non-empty set
st.dictionaries(st.text(min_size=1), st.integers())  # Dict

# Special
st.none()                                  # None
st.booleans()                              # True/False
st.binary(min_size=1, max_size=1000)       # bytes
st.datetimes()                             # datetime objects
st.uuids()                                 # UUID objects
st.emails()                                # Valid emails
```

## Composite Strategies

```python
# Combine strategies
st.one_of(st.integers(), st.text())        # Int or text
st.tuples(st.integers(), st.text())        # (int, str)

# Optional values
st.none() | st.integers()                  # None or int

# Transform values
st.integers().map(lambda x: x * 2)         # Even integers
st.lists(st.integers()).map(sorted)        # Sorted lists

# Filter (use sparingly - slow if filter rejects often)
st.integers().filter(lambda x: x % 10 == 0)  # Multiples of 10
```

## Custom Composite Strategies

```python
from hypothesis import strategies as st

@st.composite
def user_strategy(draw):
    """Generate valid User objects."""
    name = draw(st.text(min_size=1, max_size=50))
    age = draw(st.integers(min_value=0, max_value=150))
    email = draw(st.emails())

    # Can add logic based on drawn values
    role = draw(st.sampled_from(["user", "admin", "guest"]))

    return User(name=name, age=age, email=email, role=role)

@st.composite
def order_with_items_strategy(draw):
    """Generate Order with 1-10 valid items."""
    items = draw(st.lists(
        st.builds(
            OrderItem,
            product_id=st.uuids(),
            quantity=st.integers(min_value=1, max_value=100),
            price=st.decimals(min_value=0.01, max_value=10000),
        ),
        min_size=1,
        max_size=10,
    ))
    return Order(items=items)
```

## Pydantic Integration

```python
from hypothesis import given, strategies as st
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    name: str
    age: int

# Using st.builds with Pydantic
@given(st.builds(
    UserCreate,
    email=st.emails(),
    name=st.text(min_size=1, max_size=100),
    age=st.integers(min_value=0, max_value=150),
))
def test_user_serialization(user: UserCreate):
    json_data = user.model_dump_json()
    parsed = UserCreate.model_validate_json(json_data)
    assert parsed == user
```

## Performance Tips

```python
# GOOD: Generate directly
st.integers(min_value=0, max_value=100)

# BAD: Filter is slow
st.integers().filter(lambda x: 0 <= x <= 100)

# GOOD: Use sampled_from for small sets
st.sampled_from(["red", "green", "blue"])

# BAD: Filter from large set
st.text().filter(lambda x: x in ["red", "green", "blue"])
```

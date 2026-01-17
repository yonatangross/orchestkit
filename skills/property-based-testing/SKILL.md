---
name: property-based-testing
description: Property-based testing with Hypothesis for discovering edge cases automatically. Use when testing invariants, finding boundary conditions, implementing stateful testing, or validating data transformations.
context: fork
agent: test-generator
version: 1.0.0
tags: [hypothesis, property-testing, fuzzing, python, testing, 2026]
author: SkillForge
user-invocable: false
---

# Property-Based Testing with Hypothesis

Discover edge cases automatically by testing properties instead of examples.

## When to Use

- Testing functions with many possible inputs
- Validating invariants that must hold for all inputs
- Finding boundary conditions and edge cases
- Testing serialization/deserialization roundtrips
- Stateful testing of APIs and state machines

## Core Concepts

### Example-Based vs Property-Based

```python
# Example-based: Test specific inputs
def test_sort_examples():
    assert sort([3, 1, 2]) == [1, 2, 3]
    assert sort([]) == []
    assert sort([1]) == [1]
    # But what about: [0], [-1, -2], [1.5, 2.5], ...?

# Property-based: Test properties that hold for ALL inputs
from hypothesis import given
from hypothesis import strategies as st

@given(st.lists(st.integers()))
def test_sort_properties(lst):
    result = sort(lst)
    # Property 1: Same length
    assert len(result) == len(lst)
    # Property 2: Ordered
    assert all(result[i] <= result[i+1] for i in range(len(result)-1))
    # Property 3: Same elements
    assert sorted(result) == sorted(lst)
```

## Strategies Reference

### Primitive Strategies

```python
from hypothesis import strategies as st

# Numbers
st.integers()                    # Any integer
st.integers(min_value=0)         # Non-negative
st.integers(min_value=1, max_value=100)  # 1-100
st.floats()                      # Any float (including NaN, inf)
st.floats(allow_nan=False, allow_infinity=False)  # "Real" floats
st.floats(min_value=0.0, max_value=1.0)  # Probabilities

# Strings
st.text()                        # Any unicode text
st.text(min_size=1, max_size=100)  # Bounded length
st.text(alphabet="abc123")       # Limited character set
st.from_regex(r"[a-z]+@[a-z]+\.[a-z]{2,}")  # Email-like

# Collections
st.lists(st.integers())          # List of integers
st.lists(st.integers(), min_size=1, max_size=10)  # Bounded
st.lists(st.integers(), unique=True)  # No duplicates
st.sets(st.integers())           # Sets
st.dictionaries(st.text(), st.integers())  # Dicts

# Special
st.none()                        # None
st.booleans()                    # True/False
st.binary()                      # bytes
st.datetimes()                   # datetime objects
st.uuids()                       # UUID objects
```

### Composite Strategies

```python
from hypothesis import strategies as st

# Combine strategies
st.one_of(st.integers(), st.text())  # Int or text
st.tuples(st.integers(), st.text())  # (int, str)

# Optional values
st.none() | st.integers()  # None or int
st.integers() | st.none()  # Same thing

# Transform values
st.integers().map(lambda x: x * 2)  # Even integers
st.text().filter(lambda s: len(s) > 0)  # Non-empty

# Build complex objects
@st.composite
def user_strategy(draw):
    name = draw(st.text(min_size=1, max_size=50))
    age = draw(st.integers(min_value=0, max_value=150))
    email = draw(st.emails())
    return User(name=name, age=age, email=email)
```

### Pydantic/Dataclass Strategies

```python
from hypothesis import strategies as st
from hypothesis_jsonschema import from_schema
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    name: str
    age: int

# Strategy from Pydantic model
@st.composite
def user_create_strategy(draw):
    return UserCreate(
        email=draw(st.emails()),
        name=draw(st.text(min_size=1, max_size=100)),
        age=draw(st.integers(min_value=0, max_value=150)),
    )

# Or use from_type (requires hypothesis[pydantic])
from hypothesis import given
from hypothesis import strategies as st

@given(st.from_type(UserCreate))
def test_user_serialization(user: UserCreate):
    json_data = user.model_dump_json()
    parsed = UserCreate.model_validate_json(json_data)
    assert parsed == user
```

## Common Properties to Test

### Roundtrip (Encode/Decode)

```python
from hypothesis import given
from hypothesis import strategies as st
import json

@given(st.dictionaries(st.text(), st.integers()))
def test_json_roundtrip(data):
    """JSON encode then decode returns original."""
    encoded = json.dumps(data)
    decoded = json.loads(encoded)
    assert decoded == data

@given(st.binary())
def test_compression_roundtrip(data):
    """Compress then decompress returns original."""
    compressed = compress(data)
    decompressed = decompress(compressed)
    assert decompressed == data
```

### Idempotence

```python
@given(st.text())
def test_normalize_idempotent(text):
    """Normalizing twice equals normalizing once."""
    once = normalize(text)
    twice = normalize(once)
    assert once == twice

@given(st.lists(st.integers()))
def test_sort_idempotent(lst):
    """Sorting is idempotent."""
    once = sort(lst)
    twice = sort(once)
    assert once == twice
```

### Invariants

```python
@given(st.lists(st.integers()))
def test_sum_invariant(lst):
    """Sum of parts equals whole."""
    mid = len(lst) // 2
    left, right = lst[:mid], lst[mid:]
    assert sum(left) + sum(right) == sum(lst)

@given(st.integers(), st.integers())
def test_addition_commutative(a, b):
    """Addition is commutative."""
    assert a + b == b + a
```

### Oracle Testing

```python
@given(st.lists(st.integers()))
def test_custom_sort_matches_builtin(lst):
    """Our sort matches Python's sort."""
    expected = sorted(lst)
    actual = our_custom_sort(lst)
    assert actual == expected
```

## Stateful Testing

### State Machines

```python
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant

class BankAccountMachine(RuleBasedStateMachine):
    """Test bank account state transitions."""

    def __init__(self):
        super().__init__()
        self.account = BankAccount()
        self.balance = 0

    @rule(amount=st.integers(min_value=1, max_value=10000))
    def deposit(self, amount):
        self.account.deposit(amount)
        self.balance += amount

    @rule(amount=st.integers(min_value=1, max_value=10000))
    def withdraw(self, amount):
        if amount <= self.balance:
            self.account.withdraw(amount)
            self.balance -= amount
        else:
            with pytest.raises(InsufficientFunds):
                self.account.withdraw(amount)

    @invariant()
    def balance_matches(self):
        assert self.account.balance == self.balance

    @invariant()
    def balance_non_negative(self):
        assert self.account.balance >= 0

# Run the state machine tests
TestBankAccount = BankAccountMachine.TestCase
```

### API Testing with Schemathesis

```python
# schemathesis for OpenAPI-based testing
import schemathesis
from fastapi import FastAPI

app = FastAPI()

# Generate tests from OpenAPI schema
schema = schemathesis.from_asgi("/openapi.json", app)

@schema.parametrize()
def test_api_endpoints(case):
    """Test all API endpoints with generated data."""
    response = case.call_asgi()
    case.validate_response(response)
    assert response.status_code < 500  # No server errors

# Or test specific operations
@schema.parametrize(endpoint="/users", method="POST")
def test_create_user(case):
    response = case.call_asgi()
    if response.status_code == 201:
        assert "id" in response.json()
```

## Hypothesis Settings

### Configuration

```python
from hypothesis import settings, Verbosity, Phase

# Profile for different environments
settings.register_profile(
    "dev",
    max_examples=10,  # Fast iteration
    verbosity=Verbosity.verbose,
)

settings.register_profile(
    "ci",
    max_examples=100,  # Thorough testing
    deadline=None,  # No time limit
)

settings.register_profile(
    "thorough",
    max_examples=1000,  # Deep exploration
    phases=[Phase.generate, Phase.shrink],
)

# Load profile
import os
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))
```

### Per-Test Settings

```python
from hypothesis import given, settings
from hypothesis import strategies as st

@given(st.lists(st.integers()))
@settings(
    max_examples=500,      # More examples for this test
    deadline=10000,        # 10 second timeout
    suppress_health_check=[HealthCheck.too_slow],
)
def test_complex_algorithm(data):
    result = complex_algorithm(data)
    assert validate(result)
```

## Integration with Pytest

### Fixtures and Hypothesis

```python
import pytest
from hypothesis import given
from hypothesis import strategies as st

@pytest.fixture
def db_session():
    """Database session fixture."""
    session = create_session()
    yield session
    session.rollback()

# Use fixture with hypothesis
@given(user_data=user_create_strategy())
def test_user_creation(db_session, user_data):
    """Hypothesis generates data, pytest provides fixture."""
    user = UserService(db_session).create(user_data)
    assert user.id is not None
    assert user.email == user_data.email
```

### Database Testing Pattern

```python
from hypothesis import given, settings
from hypothesis import strategies as st

# Use explicit examples for database tests (faster, repeatable)
@given(st.data())
@settings(
    max_examples=20,
    database=None,  # Don't persist examples
)
def test_user_crud(data, db_session):
    user_data = data.draw(user_create_strategy())

    # Create
    user = UserService(db_session).create(user_data)
    assert user.id is not None

    # Read
    fetched = UserService(db_session).get(user.id)
    assert fetched.email == user.email

    # Update
    new_name = data.draw(st.text(min_size=1))
    updated = UserService(db_session).update(user.id, {"name": new_name})
    assert updated.name == new_name

    # Delete
    UserService(db_session).delete(user.id)
    assert UserService(db_session).get(user.id) is None
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Strategy design | Composite strategies for domain objects |
| Example count | 100 for CI, 10 for dev, 1000 for release |
| Database tests | Use explicit mode, limit examples |
| Deadline | Disable for slow tests, 200ms default |
| Stateful tests | RuleBasedStateMachine for state machines |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER ignore failing examples
@given(st.integers())
def test_bad(x):
    if x == 42:
        return  # WRONG - hiding failure case
    assert x != 42

# NEVER use filter with low hit rate
st.integers().filter(lambda x: x % 1000 == 0)  # WRONG - very slow

# NEVER test with unbounded inputs when bounded makes sense
@given(st.text())  # WRONG - includes 10MB strings
def test_username(name):
    User(name=name)  # Will be slow/crash

# NEVER mutate strategy results
@given(st.lists(st.integers()))
def test_mutating(lst):
    lst.append(42)  # WRONG - mutates generated data
    assert 42 in lst

# NEVER use print() for debugging (use note())
@given(st.integers())
def test_debug(x):
    print(f"Testing {x}")  # WRONG - spams output
    # Use hypothesis.note(f"Testing {x}") instead
```

## Related Skills

- `pytest-advanced` - Custom markers and parallel execution
- `unit-testing` - Basic testing patterns
- `llm-testing` - Testing LLM applications with property-based tests
- `test-data-management` - Factory patterns for test data

## Capability Details

### strategies
**Keywords:** strategy, hypothesis, generator, from_type, composite
**Solves:**
- How do I generate test data with Hypothesis?
- Create strategies for custom types
- Combine strategies for complex objects

### properties
**Keywords:** property, invariant, roundtrip, idempotent, oracle
**Solves:**
- What properties should I test?
- Test encode/decode roundtrips
- Verify invariants hold for all inputs

### stateful
**Keywords:** stateful, state machine, RuleBasedStateMachine, rule
**Solves:**
- How do I test stateful systems?
- Model state transitions
- Find state-related bugs

### schemathesis
**Keywords:** schemathesis, openapi, api testing, fuzzing
**Solves:**
- Fuzz test my API endpoints
- Generate tests from OpenAPI spec
- Find API edge cases

### hypothesis-settings
**Keywords:** max_examples, deadline, profile, suppress_health_check
**Solves:**
- Configure Hypothesis for CI vs dev
- Speed up slow property tests
- Handle flaky health checks

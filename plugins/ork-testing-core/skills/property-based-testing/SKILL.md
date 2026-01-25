---
name: property-based-testing
description: Property-based testing with Hypothesis for discovering edge cases automatically. Use when testing invariants, finding boundary conditions, implementing stateful testing, or validating data transformations.
context: fork
agent: test-generator
version: 1.0.0
tags: [hypothesis, property-testing, fuzzing, python, testing, 2026]
author: OrchestKit
user-invocable: false
---

# Property-Based Testing with Hypothesis

Discover edge cases automatically by testing properties instead of examples.

## Overview

- Testing functions with many possible inputs
- Validating invariants that must hold for all inputs
- Finding boundary conditions and edge cases
- Testing serialization/deserialization roundtrips
- Stateful testing of APIs and state machines

## Quick Reference

### Example-Based vs Property-Based

```python
# Example-based: Test specific inputs
def test_sort_examples():
    assert sort([3, 1, 2]) == [1, 2, 3]
    # But what about [-1], [1.5, 2.5], ...?

# Property-based: Test properties for ALL inputs
from hypothesis import given
from hypothesis import strategies as st

@given(st.lists(st.integers()))
def test_sort_properties(lst):
    result = sort(lst)
    assert len(result) == len(lst)  # Same length
    assert all(result[i] <= result[i+1] for i in range(len(result)-1))  # Ordered
```

See [strategies-guide.md](references/strategies-guide.md) for complete strategy reference.

### Common Strategies

```python
from hypothesis import strategies as st

st.integers(min_value=0, max_value=100)  # Bounded integers
st.text(min_size=1, max_size=50)         # Bounded text
st.lists(st.integers(), max_size=10)     # Bounded lists
st.from_regex(r"[a-z]+@[a-z]+\.[a-z]+")  # Pattern-based

# Composite for domain objects
@st.composite
def user_strategy(draw):
    return User(
        name=draw(st.text(min_size=1, max_size=50)),
        age=draw(st.integers(min_value=0, max_value=150)),
    )
```

### Common Properties

```python
# Roundtrip (encode/decode)
@given(st.dictionaries(st.text(), st.integers()))
def test_json_roundtrip(data):
    assert json.loads(json.dumps(data)) == data

# Idempotence
@given(st.text())
def test_normalize_idempotent(text):
    assert normalize(normalize(text)) == normalize(text)

# Oracle (compare to known implementation)
@given(st.lists(st.integers()))
def test_sort_matches_builtin(lst):
    assert our_sort(lst) == sorted(lst)
```

See [stateful-testing.md](references/stateful-testing.md) for state machine testing.

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
        return  # WRONG - hiding failure!

# NEVER use filter with low hit rate
st.integers().filter(lambda x: x % 1000 == 0)  # WRONG - very slow

# NEVER test with unbounded inputs
@given(st.text())  # WRONG - includes 10MB strings
def test_username(name):
    User(name=name)

# NEVER mutate strategy results
@given(st.lists(st.integers()))
def test_mutating(lst):
    lst.append(42)  # WRONG - mutates generated data
```

## Related Skills

- `pytest-advanced` - Custom markers and parallel execution
- `unit-testing` - Basic testing patterns
- `contract-testing` - API contract testing with Pact

## References

- [Strategies Guide](references/strategies-guide.md) - Complete strategy reference
- [Stateful Testing](references/stateful-testing.md) - State machine patterns
- [Hypothesis Conftest](scripts/hypothesis-conftest.py) - Production setup

## Capability Details

### strategies
**Keywords:** strategy, hypothesis, generator, from_type, composite
**Solves:** Generate test data, create strategies for custom types

### properties
**Keywords:** property, invariant, roundtrip, idempotent, oracle
**Solves:** What properties to test, roundtrips, invariants

### stateful
**Keywords:** stateful, state machine, RuleBasedStateMachine, rule
**Solves:** Test stateful systems, model state transitions

### schemathesis
**Keywords:** schemathesis, openapi, api testing, fuzzing
**Solves:** Fuzz test API endpoints, generate from OpenAPI spec

### hypothesis-settings
**Keywords:** max_examples, deadline, profile, suppress_health_check
**Solves:** Configure for CI vs dev, speed up slow tests

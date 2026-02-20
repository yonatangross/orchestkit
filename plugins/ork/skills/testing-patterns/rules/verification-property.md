---
title: Discover edge cases through generative Hypothesis testing to validate universal properties
category: verification
impact: MEDIUM
impactDescription: "Discovers edge cases through generative testing with Hypothesis to validate universal properties"
tags: property-based-testing, hypothesis, generative-testing, edge-cases, fuzzing
---

# Property-Based Testing with Hypothesis

## Example-Based vs Property-Based

```python
# Property-based: Test properties for ALL inputs
from hypothesis import given
from hypothesis import strategies as st

@given(st.lists(st.integers()))
def test_sort_properties(lst):
    result = sort(lst)
    assert len(result) == len(lst)  # Same length
    assert all(result[i] <= result[i+1] for i in range(len(result)-1))
```

## Common Strategies

```python
st.integers(min_value=0, max_value=100)
st.text(min_size=1, max_size=50)
st.lists(st.integers(), max_size=10)
st.from_regex(r"[a-z]+@[a-z]+\.[a-z]+")

@st.composite
def user_strategy(draw):
    return User(
        name=draw(st.text(min_size=1, max_size=50)),
        age=draw(st.integers(min_value=0, max_value=150)),
    )
```

## Common Properties

```python
# Roundtrip (encode/decode)
@given(st.dictionaries(st.text(), st.integers()))
def test_json_roundtrip(data):
    assert json.loads(json.dumps(data)) == data

# Idempotence
@given(st.text())
def test_normalize_idempotent(text):
    assert normalize(normalize(text)) == normalize(text)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Example count | 100 for CI, 10 for dev, 1000 for release |
| Deadline | Disable for slow tests, 200ms default |
| Stateful tests | RuleBasedStateMachine for state machines |

**Incorrect — Testing specific examples only:**
```python
def test_sort():
    assert sort([3, 1, 2]) == [1, 2, 3]
    # Only tests one specific case
```

**Correct — Testing universal properties for all inputs:**
```python
@given(st.lists(st.integers()))
def test_sort_properties(lst):
    result = sort(lst)
    assert len(result) == len(lst)
    assert all(result[i] <= result[i+1] for i in range(len(result)-1))
```

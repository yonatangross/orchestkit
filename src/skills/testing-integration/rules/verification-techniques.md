---
title: Require evidence verification and discover edge cases through property-based testing with Hypothesis
impact: MEDIUM
impactDescription: "Evidence-backed task completion prevents hidden failures; property-based testing discovers edge cases through generative testing"
tags: evidence, verification, testing, quality, exit-code, coverage, property-based-testing, hypothesis, generative-testing, edge-cases, fuzzing
---

## Evidence Verification for Task Completion

**Incorrect -- claiming completion without proof:**
```markdown
"I've implemented the login feature. It should work correctly."
# No tests run, no build verified, no evidence collected
```

**Correct -- evidence-backed task completion:**
```markdown
"I've implemented the login feature. Evidence:
- Tests: Exit code 0, 12 tests passed, 0 failed
- Build: Exit code 0, no errors
- Coverage: 89%
- Timestamp: 2026-02-13 10:30:15
Task complete with verification."
```

**Evidence collection protocol:**
```markdown
## Before Marking Task Complete

1. **Identify Verification Points**
   - What needs to be proven?
   - What could go wrong?

2. **Execute Verification**
   - Run tests (capture exit code)
   - Run build (capture exit code)
   - Run linters/type checkers

3. **Capture Results**
   - Record exit codes (0 = pass)
   - Save output snippets
   - Note timestamps

4. **Minimum Requirements:**
   - [ ] At least ONE verification type executed
   - [ ] Exit code captured (0 = pass)
   - [ ] Timestamp recorded

5. **Production-Grade Requirements:**
   - [ ] Tests pass (exit code 0)
   - [ ] Coverage >= 70%
   - [ ] Build succeeds (exit code 0)
   - [ ] No critical linter errors
   - [ ] Type checker passes
```

**Common commands for evidence collection:**
```bash
# JavaScript/TypeScript
npm test                 # Run tests
npm run build           # Build project
npm run lint            # ESLint
npm run typecheck       # TypeScript compiler

# Python
pytest                  # Run tests
pytest --cov           # Tests with coverage
ruff check .           # Linter
mypy .                 # Type checker
```

Key principles:
- Show, don't tell -- no task is complete without verifiable evidence
- Never fake evidence or mark tasks complete on failed evidence
- Exit code 0 is the universal success indicator
- Re-collect evidence after any changes
- Minimum coverage: 70% (production-grade), 80% (gold standard)

---

## Property-Based Testing with Hypothesis

### Example-Based vs Property-Based

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

### Common Strategies

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
```

### Key Decisions

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

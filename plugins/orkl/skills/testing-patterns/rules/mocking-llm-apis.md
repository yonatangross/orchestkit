---
title: "Mocking: LLM APIs"
category: mocking
impact: HIGH
---

# LLM API Mocking

## Custom Matchers for LLM Requests

```python
def llm_request_matcher(r1, r2):
    """Match LLM requests ignoring dynamic fields."""
    import json

    if r1.uri != r2.uri or r1.method != r2.method:
        return False

    body1 = json.loads(r1.body)
    body2 = json.loads(r2.body)

    for field in ["request_id", "timestamp"]:
        body1.pop(field, None)
        body2.pop(field, None)

    return body1 == body2

@pytest.fixture(scope="module")
def vcr_config():
    return {"custom_matchers": [llm_request_matcher]}
```

## CI Configuration

```python
@pytest.fixture(scope="module")
def vcr_config():
    import os
    # CI: never record, only replay
    if os.environ.get("CI"):
        record_mode = "none"
    else:
        record_mode = "new_episodes"
    return {"record_mode": record_mode}
```

## Common Mistakes

- Committing cassettes with real API keys
- Using `all` mode in CI (makes live calls)
- Not filtering sensitive data
- Missing cassettes in git

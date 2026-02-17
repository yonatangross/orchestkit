---
title: "Mocking: VCR.py"
category: mocking
impact: HIGH
impactDescription: "Records and replays HTTP interactions for deterministic integration tests with sensitive data filtering"
tags: vcr, http-recording, python, integration-testing, cassettes
---

# VCR.py HTTP Recording

## Basic Setup

```python
@pytest.fixture(scope="module")
def vcr_config():
    return {
        "cassette_library_dir": "tests/cassettes",
        "record_mode": "once",
        "match_on": ["uri", "method"],
        "filter_headers": ["authorization", "x-api-key"],
        "filter_query_parameters": ["api_key", "token"],
    }
```

## Usage

```python
@pytest.mark.vcr()
def test_fetch_user():
    response = requests.get("https://api.example.com/users/1")
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.vcr()
async def test_async_api_call():
    async with AsyncClient() as client:
        response = await client.get("https://api.example.com/data")
    assert response.status_code == 200
```

## Recording Modes

| Mode | Behavior |
|------|----------|
| `once` | Record if missing, then replay |
| `new_episodes` | Record new, replay existing |
| `none` | Never record (CI) |
| `all` | Always record (refresh) |

## Filtering Sensitive Data

```python
def filter_request_body(request):
    import json
    if request.body:
        try:
            body = json.loads(request.body)
            if "password" in body:
                body["password"] = "REDACTED"
            request.body = json.dumps(body)
        except json.JSONDecodeError:
            pass
    return request
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Record mode | `once` for dev, `none` for CI |
| Cassette format | YAML (readable) |
| Sensitive data | Always filter headers/body |

**Incorrect — Not filtering sensitive data from cassettes:**
```python
@pytest.fixture(scope="module")
def vcr_config():
    return {"cassette_library_dir": "tests/cassettes"}
    # Missing: filter_headers for API keys
```

**Correct — Filtering sensitive headers and query params:**
```python
@pytest.fixture(scope="module")
def vcr_config():
    return {
        "cassette_library_dir": "tests/cassettes",
        "filter_headers": ["authorization", "x-api-key"],
        "filter_query_parameters": ["api_key", "token"]
    }
```

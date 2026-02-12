---
title: "Data: JSON Fixtures"
category: data
impact: MEDIUM
---

# JSON Fixtures and Composition

## JSON Fixture Files

```json
// fixtures/users.json
{
  "admin": {
    "id": "user-001",
    "email": "admin@example.com",
    "role": "admin"
  },
  "basic": {
    "id": "user-002",
    "email": "user@example.com",
    "role": "user"
  }
}
```

## Loading in pytest

```python
import json
import pytest

@pytest.fixture
def users():
    with open('fixtures/users.json') as f:
        return json.load(f)

def test_admin_access(users):
    admin = users['admin']
    assert admin['role'] == 'admin'
```

## Fixture Composition

```python
@pytest.fixture
def user():
    return UserFactory()

@pytest.fixture
def user_with_analyses(user):
    analyses = [AnalysisFactory(user=user) for _ in range(3)]
    return {"user": user, "analyses": analyses}

@pytest.fixture
def completed_workflow(user_with_analyses):
    for analysis in user_with_analyses["analyses"]:
        analysis.status = "completed"
    return user_with_analyses
```

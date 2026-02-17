---
title: "Data: JSON Fixtures"
category: data
impact: MEDIUM
impactDescription: "Establishes structured JSON fixtures and composition patterns for deterministic test data management"
tags: test-data, fixtures, json, pytest, composition
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

**Incorrect — Fixtures with hard-coded state that breaks isolation:**
```python
@pytest.fixture(scope="module")  # Shared across tests
def user():
    return {"id": 1, "email": "test@example.com"}

def test_update_user(user):
    user["email"] = "updated@example.com"  # Mutates shared state
```

**Correct — Function-scoped fixtures with composition:**
```python
@pytest.fixture
def user():
    return UserFactory()  # Fresh instance per test

@pytest.fixture
def admin_user(user):
    user.role = "admin"  # Composes on top of user fixture
    return user
```

---
title: Review Python code for missing validators, untyped functions, and unsafe async patterns
impact: HIGH
impactDescription: "Missing validators, untyped code, and unsafe async patterns cause silent production failures"
tags: python, pydantic, ruff, mypy, async, fastapi
---

## Python Quality Review Rules

Review rules for Python code. Focused on Pydantic v2, async safety, and type strictness.

### Pydantic v2 Patterns

```python
# VIOLATION: No validation on input models
class UserInput(BaseModel):
    email: str      # Accepts any string
    age: int        # Accepts negative numbers

# CORRECT: Constrained fields + validators
from pydantic import BaseModel, Field, model_validator

class UserInput(BaseModel):
    email: str = Field(pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    age: int = Field(ge=0, le=150)

    @model_validator(mode='after')
    def validate_fields(self) -> 'UserInput':
        if self.age < 13 and '@' not in self.email:
            raise ValueError('Minors require valid parent email')
        return self
```

### Type Hints (mypy Strict)

```python
# VIOLATION: Missing type hints
def process(data):
    result = []
    for item in data:
        result.append(item.name)
    return result

# CORRECT: Full type hints
def process(data: list[UserModel]) -> list[str]:
    result: list[str] = []
    for item in data:
        result.append(item.name)
    return result
```

### Async Safety

```python
# VIOLATION: No timeout on external calls
async def fetch_user(user_id: str) -> User:
    response = await httpx.get(f"/users/{user_id}")
    return User(**response.json())

# CORRECT: Timeout protection
import asyncio

async def fetch_user(user_id: str) -> User:
    async with asyncio.timeout(10):
        response = await httpx.get(f"/users/{user_id}")
        response.raise_for_status()
        return User.model_validate(response.json())
```

### Ruff Compliance

```python
# All Python files must pass:
# ruff check --select ALL
# ruff format --check

# Key rules enforced:
# - No unused imports
# - No f-strings in logging (use % formatting)
# - No bare except clauses
# - No mutable default arguments
```

**Incorrect — missing validation and timeout:**
```python
class UserInput(BaseModel):
    email: str  # No validation!
    age: int    # Accepts negative

async def fetch_user(user_id: str) -> User:
    # No timeout! May hang forever
    response = await httpx.get(f"/users/{user_id}")
    return User(**response.json())
```

**Correct — constrained fields with timeout protection:**
```python
from pydantic import BaseModel, Field, model_validator
import asyncio

class UserInput(BaseModel):
    email: str = Field(pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    age: int = Field(ge=0, le=150)

    @model_validator(mode='after')
    def validate_fields(self) -> 'UserInput':
        if self.age < 13 and '@' not in self.email:
            raise ValueError('Minors require valid parent email')
        return self

async def fetch_user(user_id: str) -> User:
    async with asyncio.timeout(10):  # Timeout protection
        response = await httpx.get(f"/users/{user_id}")
        response.raise_for_status()
        return User.model_validate(response.json())
```

### Review Checklist

| Check | Severity | What to Look For |
|-------|----------|-----------------|
| Pydantic validators | HIGH | Missing `Field()` constraints, no `model_validator` |
| Type hints | HIGH | Functions without return types, `Any` usage |
| Async timeouts | CRITICAL | External calls without `asyncio.timeout()` |
| Ruff compliance | MEDIUM | Formatting violations, unused imports |
| Exception handling | HIGH | Bare `except:`, swallowing exceptions |
| Division safety | MEDIUM | Division without checking `len() > 0` |

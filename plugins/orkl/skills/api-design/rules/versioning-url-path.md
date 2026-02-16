---
title: URL Path Versioning
impact: HIGH
impactDescription: "URL path versioning is the most common strategy for public APIs — incorrect implementation leads to routing conflicts, code duplication, and unmaintainable version sprawl"
tags: url-versioning, path-versioning, fastapi, router, v1, v2
---

## URL Path Versioning

The recommended versioning strategy for public APIs using URL path prefixes.

**FastAPI Directory Structure:**

```
backend/app/
├── api/
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── users.py
│   │   │   └── analyses.py
│   │   └── schemas/
│   │       ├── user.py
│   │       └── analysis.py
│   ├── v2/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── users.py      # Updated schemas
│   │   │   └── analyses.py
│   │   └── schemas/
│   │       ├── user.py       # New schema version
│   │       └── analysis.py
│   └── router.py             # Combines all versions
├── core/
└── services/                  # Shared across versions
```

**Router Setup:**

```python
# backend/app/api/router.py
from fastapi import APIRouter
from app.api.v1.router import router as v1_router
from app.api.v2.router import router as v2_router

api_router = APIRouter()
api_router.include_router(v1_router, prefix="/v1")
api_router.include_router(v2_router, prefix="/v2")

# main.py
app.include_router(api_router, prefix="/api")
```

**Version-Specific Schemas:**

```python
# v1/schemas/user.py
class UserResponseV1(BaseModel):
    id: str
    name: str  # Single name field

# v2/schemas/user.py
class UserResponseV2(BaseModel):
    id: str
    first_name: str  # Split into first/last
    last_name: str
    full_name: str   # Computed for convenience
```

**Shared Business Logic (Version-Agnostic Services):**

```python
# services/user_service.py (version-agnostic)
class UserService:
    async def get_user(self, user_id: str) -> User:
        return await self.repo.get_by_id(user_id)

# v1/routes/users.py
@router.get("/{user_id}", response_model=UserResponseV1)
async def get_user_v1(user_id: str, service: UserService = Depends()):
    user = await service.get_user(user_id)
    return UserResponseV1(id=user.id, name=user.full_name)

# v2/routes/users.py
@router.get("/{user_id}", response_model=UserResponseV2)
async def get_user_v2(user_id: str, service: UserService = Depends()):
    user = await service.get_user(user_id)
    return UserResponseV2(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=f"{user.first_name} {user.last_name}",
    )
```

**Strategy Comparison:**

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL Path | `/api/v1/users` | Simple, visible, cacheable | URL pollution |
| Header | `X-API-Version: 1` | Clean URLs | Hidden, harder to test |
| Query Param | `?version=1` | Easy testing | Messy, cache issues |
| Content-Type | `Accept: application/vnd.api.v1+json` | RESTful | Complex |

**Incorrect — Versioned services:**
```python
# Services should be version-agnostic
class UserServiceV1:
    async def get_user(self, id: str):
        ...

class UserServiceV2:
    async def get_user(self, id: str):
        ...
```

**Correct — Version-agnostic services:**
```python
# Single service, version handled in response schemas
class UserService:
    async def get_user(self, id: str) -> User:
        return await self.repo.get_by_id(id)

# v1/routes/users.py returns UserResponseV1
# v2/routes/users.py returns UserResponseV2
```

**Key rules:**
- Always start with `/api/v1/` even if no v2 is planned
- Keep services version-agnostic; only schemas and routes are versioned
- Use schema inheritance for shared fields across versions
- Support max 2-3 concurrent versions
- Never version internal implementation (services, repositories)

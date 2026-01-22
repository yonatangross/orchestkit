---
name: api-versioning
description: API versioning strategies including URL path, header, and content negotiation. Use when migrating v1 to v2, handling breaking changes, implementing deprecation or sunset policies, or managing backward compatibility.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [api, versioning, rest, fastapi, backward-compatibility, 2026]
author: OrchestKit
user-invocable: false
---

# API Versioning Strategies

Design APIs that evolve gracefully without breaking clients.

## Strategy Comparison

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL Path | `/api/v1/users` | Simple, visible, cacheable | URL pollution |
| Header | `X-API-Version: 1` | Clean URLs | Hidden, harder to test |
| Query Param | `?version=1` | Easy testing | Messy, cache issues |
| Content-Type | `Accept: application/vnd.api.v1+json` | RESTful | Complex |

## URL Path Versioning (Recommended)

### FastAPI Structure

```
backend/app/
├── api/
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── users.py
│   │   │   └── analyses.py
│   │   └── router.py
│   ├── v2/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── users.py      # Updated schemas
│   │   │   └── analyses.py
│   │   └── router.py
│   └── router.py             # Combines all versions
```

### Router Setup

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

### Version-Specific Schemas

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

### Shared Business Logic

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

## Header-Based Versioning

```python
from fastapi import Header, HTTPException

async def get_api_version(
    x_api_version: str = Header(default="1", alias="X-API-Version")
) -> int:
    try:
        version = int(x_api_version)
        if version not in [1, 2]:
            raise ValueError()
        return version
    except ValueError:
        raise HTTPException(400, "Invalid API version")

@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    version: int = Depends(get_api_version),
    service: UserService = Depends(),
):
    user = await service.get_user(user_id)

    if version == 1:
        return UserResponseV1(id=user.id, name=user.full_name)
    else:
        return UserResponseV2(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
        )
```

## Content Negotiation

```python
from fastapi import Request

MEDIA_TYPES = {
    "application/vnd.orchestkit.v1+json": 1,
    "application/vnd.orchestkit.v2+json": 2,
    "application/json": 2,  # Default to latest
}

async def get_version_from_accept(request: Request) -> int:
    accept = request.headers.get("Accept", "application/json")
    return MEDIA_TYPES.get(accept, 2)

@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    version: int = Depends(get_version_from_accept),
):
    ...
```

## Deprecation Headers

```python
from fastapi import Response
from datetime import date

def add_deprecation_headers(
    response: Response,
    deprecated_date: date,
    sunset_date: date,
    link: str,
):
    response.headers["Deprecation"] = deprecated_date.isoformat()
    response.headers["Sunset"] = sunset_date.isoformat()
    response.headers["Link"] = f'<{link}>; rel="successor-version"'

# Usage in v1 endpoints
@router.get("/users/{user_id}")
async def get_user_v1(user_id: str, response: Response):
    add_deprecation_headers(
        response,
        deprecated_date=date(2025, 1, 1),
        sunset_date=date(2025, 7, 1),
        link="https://api.example.com/v2/users",
    )
    return await service.get_user(user_id)
```

## Version Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERSION LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌─────────────┐   │
│  │  ALPHA  │ → │  BETA   │ → │  STABLE  │ → │ DEPRECATED  │   │
│  │ (dev)   │   │ (test)  │   │ (prod)   │   │ (sunset)    │   │
│  └─────────┘   └─────────┘   └──────────┘   └─────────────┘   │
│                                                                 │
│  v3-alpha      v3-beta        v2 (current)   v1 (6 months)     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  POLICY:                                                        │
│  • Deprecation notice: 3 months before sunset                   │
│  • Sunset period: 6 months after deprecation                    │
│  • Support: Latest stable + 1 previous version                  │
└─────────────────────────────────────────────────────────────────┘
```

## Breaking vs Non-Breaking Changes

### Non-Breaking (No Version Bump)

```python
# Adding optional fields
class UserResponse(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None  # New optional field

# Adding new endpoints
@router.get("/users/{user_id}/preferences")  # New endpoint

# Adding optional query params
@router.get("/users")
async def list_users(
    limit: int = 100,
    cursor: str | None = None,  # New pagination
):
```

### Breaking (Requires Version Bump)

```python
# Removing fields
# Renaming fields
# Changing field types
# Changing URL structure
# Changing authentication
# Removing endpoints
# Changing error formats
```

## OpenAPI Per Version

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

def custom_openapi_v1():
    return get_openapi(
        title="OrchestKit API",
        version="1.0.0",
        routes=v1_router.routes,
    )

def custom_openapi_v2():
    return get_openapi(
        title="OrchestKit API",
        version="2.0.0",
        routes=v2_router.routes,
    )

app.mount("/docs/v1", create_docs_app(custom_openapi_v1))
app.mount("/docs/v2", create_docs_app(custom_openapi_v2))
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER version internal implementation
class UserServiceV1:  # Services should be version-agnostic
    ...

# NEVER break contracts without versioning
class UserResponse(BaseModel):
    # Changed from `name` to `full_name` without version bump!
    full_name: str

# NEVER sunset without notice
# Just removing v1 routes one day

# NEVER support too many versions (max 2-3)
/api/v1/...  # Ancient
/api/v2/...
/api/v3/...
/api/v4/...  # Too many!
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Strategy | URL path (`/api/v1/`) |
| Support window | Current + 1 previous |
| Deprecation notice | 3 months minimum |
| Sunset period | 6 months after deprecation |
| Breaking changes | New major version |
| Additive changes | Same version (backward compatible) |

## Related Skills

- `api-design-framework` - REST API patterns
- `error-handling-rfc9457` - Consistent errors across versions
- `observability-monitoring` - Version usage metrics

## Capability Details

### url-versioning
**Keywords:** url version, path version, /v1/, /v2/
**Solves:**
- How to version REST APIs?
- URL-based API versioning

### header-versioning
**Keywords:** header version, X-API-Version, custom header
**Solves:**
- Clean URL versioning
- Header-based API version

### deprecation
**Keywords:** deprecation, sunset, version lifecycle, backward compatible
**Solves:**
- How to deprecate API versions?
- Version sunset policy

### breaking-changes
**Keywords:** breaking change, non-breaking, backward compatible
**Solves:**
- What requires a version bump?
- Breaking vs non-breaking changes

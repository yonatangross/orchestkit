---
title: Deprecate APIs gracefully with sunset headers, timelines, and migration documentation
impact: HIGH
impactDescription: "Sunsetting APIs without proper deprecation destroys client trust — missing headers and unclear timelines cause outages and force emergency migrations"
tags: deprecation, sunset, lifecycle, breaking-changes, backward-compatibility
---

## Deprecation and Lifecycle

Patterns for gracefully deprecating and sunsetting API versions with proper communication.

**Deprecation Headers:**

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

**Version Lifecycle:**

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
│  POLICY:                                                        │
│  • Deprecation notice: 3 months before sunset                   │
│  • Sunset period: 6 months after deprecation                    │
│  • Support: Latest stable + 1 previous version                  │
└─────────────────────────────────────────────────────────────────┘
```

**Breaking vs Non-Breaking Changes:**

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

**Deprecation Middleware:**

```python
from starlette.middleware.base import BaseHTTPMiddleware

DEPRECATED_VERSIONS = {
    "v1": {
        "sunset": datetime(2025, 12, 31),
        "successor": "v2",
    }
}

class DeprecationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        path = request.url.path
        for version, info in DEPRECATED_VERSIONS.items():
            if f"/api/{version}/" in path:
                response.headers["Deprecation"] = "true"
                response.headers["Sunset"] = info["sunset"].strftime(
                    "%a, %d %b %Y %H:%M:%S GMT"
                )
                successor_path = path.replace(
                    f"/api/{version}/",
                    f"/api/{info['successor']}/"
                )
                response.headers["Link"] = (
                    f'<{successor_path}>; rel="successor-version"'
                )
                break
        return response

app.add_middleware(DeprecationMiddleware)
```

**Anti-Patterns (FORBIDDEN):**

```python
# NEVER version internal implementation
class UserServiceV1:  # Services should be version-agnostic
    ...

# NEVER break contracts without versioning
class UserResponse(BaseModel):
    full_name: str  # Changed from `name` without version bump!

# NEVER sunset without notice
# Just removing v1 routes one day

# NEVER support too many versions (max 2-3)
```

**Incorrect — Breaking change without version bump:**
```python
# v1 schema changed without versioning
class UserResponse(BaseModel):
    id: str
    full_name: str  # Changed from "name" - BREAKS clients!
```

**Correct — Version bump for breaking changes:**
```python
# v1 stays unchanged
class UserResponseV1(BaseModel):
    id: str
    name: str

# v2 with breaking changes
class UserResponseV2(BaseModel):
    id: str
    first_name: str
    last_name: str
```

**Key rules:**
- Send deprecation notice at least 3 months before sunset
- Include Deprecation, Sunset, and Link headers on deprecated versions
- Additive changes (new optional fields, new endpoints) are non-breaking
- Removing or renaming anything is always a breaking change
- Track usage of deprecated versions and contact heavy users

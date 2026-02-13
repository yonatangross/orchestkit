# API Versioning Strategies

Comprehensive guide to API versioning approaches for REST APIs.

## Strategy Comparison

| Strategy | URL Example | Header Example | Pros | Cons |
|----------|-------------|----------------|------|------|
| URL Path | `/api/v1/users` | - | Visible, cache-friendly | URL changes |
| Header | `/api/users` | `API-Version: 1` | Clean URLs | Hidden, harder to test |
| Query | `/api/users?v=1` | - | Easy to add | Mixes with params |
| Content Type | `/api/users` | `Accept: application/vnd.api.v1+json` | RESTful | Complex headers |

## 1. URL Path Versioning (Recommended)

The most common and recommended approach for public APIs.

```
GET /api/v1/users
GET /api/v2/users
```

### FastAPI Implementation

```python
# app/main.py
from fastapi import FastAPI
from app.api.v1 import router as v1_router
from app.api.v2 import router as v2_router

app = FastAPI()

app.include_router(v1_router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")
```

### Directory Structure

```
app/
├── api/
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── users.py
│   │   │   └── analyses.py
│   │   └── schemas/
│   │       ├── user.py
│   │       └── analysis.py
│   └── v2/
│       ├── __init__.py
│       ├── routes/
│       │   ├── users.py      # Updated endpoints
│       │   └── analyses.py
│       └── schemas/
│           ├── user.py       # New schema version
│           └── analysis.py
├── core/
└── services/                  # Shared services
```

### Advantages

- **Visible**: Version is in URL, easy to see
- **Testable**: Easy to test with curl, browser
- **Cache-friendly**: CDNs can cache per version
- **Rollback**: Easy to keep old versions running

### Disadvantages

- **URL bloat**: URLs get longer
- **Duplication**: May duplicate code across versions

---

## 2. Header Versioning

Version specified in HTTP header.

```
GET /api/users
API-Version: 2
```

### FastAPI Implementation

```python
from fastapi import APIRouter, Header, Depends

def get_api_version(api_version: str = Header(default="1")) -> int:
    """Extract API version from header."""
    return int(api_version)

@router.get("/users")
async def get_users(
    version: int = Depends(get_api_version),
):
    if version >= 2:
        return {"users": [...], "pagination": {...}}  # v2 response
    return {"users": [...]}  # v1 response
```

### When to Use

- Internal APIs
- When URL changes are disruptive
- Single endpoint serving multiple versions

---

## 3. Content Negotiation (Media Type)

Version in Accept/Content-Type header.

```
GET /api/users
Accept: application/vnd.myapi.v2+json
```

### FastAPI Implementation

```python
from fastapi import APIRouter, Request

@router.get("/users")
async def get_users(request: Request):
    accept = request.headers.get("accept", "")

    if "vnd.myapi.v2" in accept:
        return v2_response()
    return v1_response()
```

### When to Use

- Public APIs following strict REST
- When media type indicates resource format
- APIs with complex content types

---

## Version Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    VERSION LIFECYCLE                         │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  Alpha   │──►│   Beta   │──►│  Stable  │──►│Deprecated│  │
│  │   v3α    │   │   v3β    │   │    v3    │   │    v1    │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       │              │              │              │         │
│       │              │              │              ▼         │
│       │              │              │        ┌──────────┐   │
│       │              │              │        │  Sunset  │   │
│       │              │              │        │(Removed) │   │
│       │              │              │        └──────────┘   │
│                                                              │
│  Timeline Example:                                           │
│  v1: Jan 2024 ──────────────────────── Deprecated Aug 2025  │
│  v2: Mar 2025 ────────────────────────────────────────►     │
│  v3: Planned 2026                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Deprecation Headers

```python
from fastapi import Response

@router.get("/v1/users")
async def get_users_v1(response: Response):
    # Add deprecation headers
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sat, 31 Dec 2025 23:59:59 GMT"
    response.headers["Link"] = '</api/v2/users>; rel="successor-version"'

    return {"users": [...]}
```

### Deprecation Response

```json
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Link: </api/v2/users>; rel="successor-version"

{
  "_deprecation": {
    "message": "This version is deprecated. Please migrate to v2.",
    "sunset_date": "2025-12-31",
    "migration_guide": "https://docs.api.com/migration/v1-to-v2"
  },
  "users": [...]
}
```

---

## Breaking vs Non-Breaking Changes

### Non-Breaking (Safe to add)

- New endpoints
- New optional fields in response
- New optional query parameters
- New optional request body fields
- Performance improvements
- Bug fixes

### Breaking (Requires new version)

- Removing endpoints
- Removing/renaming response fields
- Changing field types
- Changing required fields
- Changing authentication
- Changing error formats

---

## Code Sharing Strategies

### 1. Shared Services

```python
# app/services/user_service.py (shared)
class UserService:
    async def get_user(self, user_id: str) -> User:
        ...

# app/api/v1/routes/users.py
@router.get("/{user_id}")
async def get_user_v1(user_id: str, service: UserService = Depends()):
    user = await service.get_user(user_id)
    return UserResponseV1.from_domain(user)

# app/api/v2/routes/users.py
@router.get("/{user_id}")
async def get_user_v2(user_id: str, service: UserService = Depends()):
    user = await service.get_user(user_id)
    return UserResponseV2.from_domain(user)  # Different schema
```

### 2. Schema Inheritance

```python
# app/api/schemas/base.py
class UserBase(BaseModel):
    id: str
    email: str
    name: str

# app/api/v1/schemas/user.py
class UserResponseV1(UserBase):
    pass

# app/api/v2/schemas/user.py
class UserResponseV2(UserBase):
    avatar_url: str | None = None
    created_at: datetime
    preferences: dict
```

### 3. Adapter Pattern

```python
class ResponseAdapter:
    @staticmethod
    def to_v1(user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
        }

    @staticmethod
    def to_v2(user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "metadata": user.metadata,
        }
```

---

## Best Practices

1. **Start with v1**: Even if not planning versions, start with `/api/v1`
2. **Semantic versioning**: Major version for breaking changes only
3. **Document changes**: Maintain changelog for each version
4. **Deprecation period**: Give 6-12 months before sunsetting
5. **Monitor usage**: Track which versions are being used
6. **Feature flags**: Consider feature flags for gradual rollouts
7. **Default version**: Always have a default (usually latest stable)

## Related Files

- See `examples/fastapi-versioning.md` for FastAPI examples
- See `checklists/versioning-checklist.md` for implementation checklist

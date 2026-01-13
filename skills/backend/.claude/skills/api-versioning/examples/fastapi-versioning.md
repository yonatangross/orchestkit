# FastAPI API Versioning Examples

Complete examples for implementing API versioning in FastAPI.

## URL Path Versioning

### Project Structure

```
app/
├── main.py
├── api/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   └── analyses.py
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── user.py
│   │       └── analysis.py
│   └── v2/
│       ├── __init__.py
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── users.py
│       │   └── analyses.py
│       └── schemas/
│           ├── __init__.py
│           ├── user.py
│           └── analysis.py
├── core/
│   └── config.py
└── services/           # Shared across versions
    ├── user_service.py
    └── analysis_service.py
```

### Version Routers

```python
# app/api/v1/__init__.py
from fastapi import APIRouter
from app.api.v1.routes import users, analyses

router = APIRouter(tags=["v1"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(analyses.router, prefix="/analyses", tags=["analyses"])


# app/api/v2/__init__.py
from fastapi import APIRouter
from app.api.v2.routes import users, analyses

router = APIRouter(tags=["v2"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(analyses.router, prefix="/analyses", tags=["analyses"])
```

### Main App

```python
# app/main.py
from fastapi import FastAPI
from app.api.v1 import router as v1_router
from app.api.v2 import router as v2_router

app = FastAPI(
    title="My API",
    description="API with versioning",
    version="2.0.0",
)

# Mount versioned routers
app.include_router(v1_router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")

# Optional: Default to latest version
@app.get("/api/users")
async def get_users_latest():
    """Redirect to latest version."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/v2/users")
```

### Version-Specific Schemas

```python
# app/api/v1/schemas/user.py
from pydantic import BaseModel

class UserResponseV1(BaseModel):
    """V1 user response - basic fields only."""
    id: str
    email: str
    name: str


# app/api/v2/schemas/user.py
from pydantic import BaseModel
from datetime import datetime

class UserResponseV2(BaseModel):
    """V2 user response - extended fields."""
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    created_at: datetime
    last_login: datetime | None = None
    preferences: dict = {}
```

### Version-Specific Routes

```python
# app/api/v1/routes/users.py
from fastapi import APIRouter, Depends
from app.api.v1.schemas.user import UserResponseV1
from app.services.user_service import UserService

router = APIRouter()

@router.get("/{user_id}", response_model=UserResponseV1)
async def get_user(
    user_id: str,
    service: UserService = Depends(),
) -> UserResponseV1:
    user = await service.get_by_id(user_id)
    return UserResponseV1(
        id=str(user.id),
        email=user.email,
        name=user.name,
    )


# app/api/v2/routes/users.py
from fastapi import APIRouter, Depends
from app.api.v2.schemas.user import UserResponseV2
from app.services.user_service import UserService

router = APIRouter()

@router.get("/{user_id}", response_model=UserResponseV2)
async def get_user(
    user_id: str,
    service: UserService = Depends(),
) -> UserResponseV2:
    user = await service.get_by_id(user_id)
    return UserResponseV2(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        last_login=user.last_login,
        preferences=user.preferences or {},
    )
```

## Header-Based Versioning

### Version Dependency

```python
# app/api/deps.py
from fastapi import Header, HTTPException

SUPPORTED_VERSIONS = {1, 2}
DEFAULT_VERSION = 2

def get_api_version(
    api_version: str | None = Header(
        default=None,
        alias="X-API-Version",
        description="API version (1 or 2)",
    ),
) -> int:
    """Extract and validate API version from header."""
    if api_version is None:
        return DEFAULT_VERSION

    try:
        version = int(api_version)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid API version: {api_version}",
        )

    if version not in SUPPORTED_VERSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported API version: {version}. Supported: {SUPPORTED_VERSIONS}",
        )

    return version
```

### Version-Aware Route

```python
# app/api/routes/users.py
from fastapi import APIRouter, Depends
from app.api.deps import get_api_version
from app.api.v1.schemas.user import UserResponseV1
from app.api.v2.schemas.user import UserResponseV2

router = APIRouter()

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    version: int = Depends(get_api_version),
    service: UserService = Depends(),
):
    """Get user - response varies by version."""
    user = await service.get_by_id(user_id)

    if version == 1:
        return UserResponseV1(
            id=str(user.id),
            email=user.email,
            name=user.name,
        )

    # version 2 (default)
    return UserResponseV2(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )
```

## Deprecation Handling

### Deprecation Middleware

```python
# app/middleware/deprecation.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from datetime import datetime

DEPRECATED_VERSIONS = {
    "v1": {
        "sunset": datetime(2025, 12, 31),
        "successor": "v2",
    }
}

class DeprecationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Check if path contains deprecated version
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


# app/main.py
app.add_middleware(DeprecationMiddleware)
```

### Deprecation Warning in Response

```python
# app/api/v1/routes/users.py
from fastapi import APIRouter, Response

router = APIRouter()

DEPRECATION_WARNING = {
    "warning": "This API version is deprecated",
    "sunset_date": "2025-12-31",
    "migration_guide": "https://docs.api.com/migration/v1-to-v2",
}

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    response: Response,
    service: UserService = Depends(),
):
    # Add deprecation headers
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sat, 31 Dec 2025 23:59:59 GMT"

    user = await service.get_by_id(user_id)

    return {
        "_deprecation": DEPRECATION_WARNING,
        "data": UserResponseV1.from_orm(user).dict(),
    }
```

## OpenAPI Documentation

### Separate Docs per Version

```python
# app/main.py
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI()

# V1 OpenAPI schema
def get_v1_openapi():
    return get_openapi(
        title="My API v1",
        version="1.0.0",
        description="API v1 (Deprecated)",
        routes=[r for r in app.routes if "/api/v1" in str(r.path)],
    )

# V2 OpenAPI schema
def get_v2_openapi():
    return get_openapi(
        title="My API v2",
        version="2.0.0",
        description="API v2 (Current)",
        routes=[r for r in app.routes if "/api/v2" in str(r.path)],
    )

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def openapi_v1():
    return get_v1_openapi()

@app.get("/api/v2/openapi.json", include_in_schema=False)
async def openapi_v2():
    return get_v2_openapi()
```

## Testing Multiple Versions

```python
# tests/test_versioning.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_v1_returns_basic_fields(client: AsyncClient):
    response = await client.get("/api/v1/users/123")
    assert response.status_code == 200

    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "name" in data
    # V1 should NOT have these fields
    assert "avatar_url" not in data
    assert "preferences" not in data

@pytest.mark.asyncio
async def test_v2_returns_extended_fields(client: AsyncClient):
    response = await client.get("/api/v2/users/123")
    assert response.status_code == 200

    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "name" in data
    # V2 should have these fields
    assert "avatar_url" in data
    assert "preferences" in data

@pytest.mark.asyncio
async def test_v1_includes_deprecation_headers(client: AsyncClient):
    response = await client.get("/api/v1/users/123")

    assert response.headers.get("Deprecation") == "true"
    assert "Sunset" in response.headers
    assert "Link" in response.headers

@pytest.mark.asyncio
async def test_header_versioning(client: AsyncClient):
    # Request with v1 header
    response = await client.get(
        "/api/users/123",
        headers={"X-API-Version": "1"},
    )
    data = response.json()
    assert "avatar_url" not in data

    # Request with v2 header
    response = await client.get(
        "/api/users/123",
        headers={"X-API-Version": "2"},
    )
    data = response.json()
    assert "avatar_url" in data
```

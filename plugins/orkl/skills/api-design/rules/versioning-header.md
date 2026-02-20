---
title: Implement header-based API versioning with clean URLs and content negotiation
impact: HIGH
impactDescription: "Header versioning keeps URLs clean but is invisible to browsers and harder to test — choosing the wrong strategy causes confusion and integration friction"
tags: header-versioning, content-negotiation, x-api-version, accept-header
---

## Header-Based Versioning

Version selection via HTTP headers for clean URLs, best suited for internal APIs.

**X-API-Version Header:**

```python
from fastapi import Header, HTTPException, Depends

SUPPORTED_VERSIONS = {1, 2}
DEFAULT_VERSION = 2

async def get_api_version(
    x_api_version: str = Header(default="1", alias="X-API-Version")
) -> int:
    try:
        version = int(x_api_version)
        if version not in SUPPORTED_VERSIONS:
            raise ValueError()
        return version
    except ValueError:
        raise HTTPException(
            400,
            f"Invalid API version. Supported: {SUPPORTED_VERSIONS}",
        )

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

**Content Negotiation (Media Type Versioning):**

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

**Testing Header Versioning:**

```python
import pytest
from httpx import AsyncClient

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

**When to Use Header vs URL Path:**

| Criteria | URL Path | Header |
|----------|----------|--------|
| **Visibility** | Clear in URL | Hidden in headers |
| **Testing** | Easy with browser/curl | Needs header tools |
| **Caching** | CDN-friendly | Requires Vary header |
| **Best for** | Public APIs | Internal APIs |
| **Multiple versions** | Separate route trees | Single route tree |

**Incorrect — No default version:**
```python
# Breaks when header missing
async def get_version(x_api_version: str = Header()):
    return int(x_api_version)  # Error if header absent!
```

**Correct — Default to latest version:**
```python
# Falls back to latest stable version
async def get_version(
    x_api_version: str = Header(default="2")
) -> int:
    return int(x_api_version)
```

**Key rules:**
- Default to latest stable version when header is absent
- Validate version against a supported versions set
- Return 400 with helpful message for unsupported versions
- Use header versioning only for internal APIs
- Always document which versions are supported

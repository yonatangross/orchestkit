"""
FastAPI Versioned Router Template

Production-ready API versioning with:
- URL path versioning
- Deprecation headers
- Version-specific schemas
- Shared services
"""

from datetime import datetime
from typing import Callable

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel


# ============================================================================
# Version Configuration
# ============================================================================

class VersionConfig:
    """API version configuration."""

    CURRENT_VERSION = 2
    SUPPORTED_VERSIONS = {1, 2}
    DEPRECATED_VERSIONS = {
        1: {
            "sunset_date": datetime(2025, 12, 31),
            "migration_guide": "https://docs.api.com/migration/v1-to-v2",
        }
    }


# ============================================================================
# Base Schemas (Shared)
# ============================================================================

class UserBase(BaseModel):
    """Base user fields shared across versions."""

    id: str
    email: str
    name: str


# ============================================================================
# V1 Schemas
# ============================================================================

class UserResponseV1(UserBase):
    """V1 user response - basic fields only."""

    pass


class UserCreateV1(BaseModel):
    """V1 user creation request."""

    email: str
    name: str
    password: str


# ============================================================================
# V2 Schemas
# ============================================================================

class UserResponseV2(UserBase):
    """V2 user response - extended fields."""

    avatar_url: str | None = None
    created_at: datetime
    last_login: datetime | None = None
    preferences: dict = {}
    is_verified: bool = False


class UserCreateV2(BaseModel):
    """V2 user creation request - more options."""

    email: str
    name: str
    password: str
    avatar_url: str | None = None
    preferences: dict = {}


# ============================================================================
# Deprecation Utilities
# ============================================================================

def add_deprecation_headers(
    response: Response,
    version: int,
) -> None:
    """Add deprecation headers for deprecated versions."""
    if version in VersionConfig.DEPRECATED_VERSIONS:
        config = VersionConfig.DEPRECATED_VERSIONS[version]
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = config["sunset_date"].strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        )
        response.headers["X-Migration-Guide"] = config["migration_guide"]


def deprecation_warning(version: int) -> dict | None:
    """Get deprecation warning for response body."""
    if version in VersionConfig.DEPRECATED_VERSIONS:
        config = VersionConfig.DEPRECATED_VERSIONS[version]
        return {
            "warning": f"API v{version} is deprecated",
            "sunset_date": config["sunset_date"].isoformat(),
            "migration_guide": config["migration_guide"],
        }
    return None


# ============================================================================
# Shared Service (Version-Agnostic)
# ============================================================================

class User:
    """Domain user model."""

    def __init__(
        self,
        id: str,
        email: str,
        name: str,
        avatar_url: str | None = None,
        created_at: datetime = None,
        last_login: datetime | None = None,
        preferences: dict = None,
        is_verified: bool = False,
    ):
        self.id = id
        self.email = email
        self.name = name
        self.avatar_url = avatar_url
        self.created_at = created_at or datetime.utcnow()
        self.last_login = last_login
        self.preferences = preferences or {}
        self.is_verified = is_verified


class UserService:
    """User service - version agnostic."""

    async def get_by_id(self, user_id: str) -> User | None:
        # Simulated database fetch
        return User(
            id=user_id,
            email="user@example.com",
            name="John Doe",
            avatar_url="https://example.com/avatar.jpg",
            created_at=datetime(2024, 1, 1),
            is_verified=True,
        )

    async def create(self, email: str, name: str, **kwargs) -> User:
        return User(
            id="new-user-id",
            email=email,
            name=name,
            **kwargs,
        )


def get_user_service() -> UserService:
    return UserService()


# ============================================================================
# V1 Router
# ============================================================================

v1_router = APIRouter(tags=["v1"])


@v1_router.get(
    "/users/{user_id}",
    response_model=UserResponseV1,
    responses={
        200: {"description": "User found"},
        404: {"description": "User not found"},
    },
)
async def get_user_v1(
    user_id: str,
    response: Response,
    service: UserService = Depends(get_user_service),
) -> UserResponseV1:
    """
    Get user by ID (V1).

    **Deprecated**: This endpoint is deprecated. Please migrate to v2.
    """
    add_deprecation_headers(response, version=1)

    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponseV1(
        id=user.id,
        email=user.email,
        name=user.name,
    )


@v1_router.post(
    "/users",
    response_model=UserResponseV1,
    status_code=201,
)
async def create_user_v1(
    request: UserCreateV1,
    response: Response,
    service: UserService = Depends(get_user_service),
) -> UserResponseV1:
    """Create a new user (V1)."""
    add_deprecation_headers(response, version=1)

    user = await service.create(
        email=request.email,
        name=request.name,
    )

    return UserResponseV1(
        id=user.id,
        email=user.email,
        name=user.name,
    )


# ============================================================================
# V2 Router
# ============================================================================

v2_router = APIRouter(tags=["v2"])


@v2_router.get(
    "/users/{user_id}",
    response_model=UserResponseV2,
    responses={
        200: {"description": "User found"},
        404: {"description": "User not found"},
    },
)
async def get_user_v2(
    user_id: str,
    service: UserService = Depends(get_user_service),
) -> UserResponseV2:
    """
    Get user by ID (V2).

    Returns extended user information including avatar, preferences,
    and verification status.
    """
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponseV2(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        last_login=user.last_login,
        preferences=user.preferences,
        is_verified=user.is_verified,
    )


@v2_router.post(
    "/users",
    response_model=UserResponseV2,
    status_code=201,
)
async def create_user_v2(
    request: UserCreateV2,
    service: UserService = Depends(get_user_service),
) -> UserResponseV2:
    """
    Create a new user (V2).

    Supports avatar and preferences on creation.
    """
    user = await service.create(
        email=request.email,
        name=request.name,
        avatar_url=request.avatar_url,
        preferences=request.preferences,
    )

    return UserResponseV2(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        preferences=user.preferences,
        is_verified=user.is_verified,
    )


# ============================================================================
# Header-Based Versioning (Alternative)
# ============================================================================

def get_api_version(
    x_api_version: str | None = Header(
        default=None,
        description="API version (1 or 2)",
    ),
) -> int:
    """Extract API version from header, default to current."""
    if x_api_version is None:
        return VersionConfig.CURRENT_VERSION

    try:
        version = int(x_api_version)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid API version: {x_api_version}",
        )

    if version not in VersionConfig.SUPPORTED_VERSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported version: {version}. Supported: {VersionConfig.SUPPORTED_VERSIONS}",
        )

    return version


header_versioned_router = APIRouter(tags=["header-versioned"])


@header_versioned_router.get("/users/{user_id}")
async def get_user_header_versioned(
    user_id: str,
    response: Response,
    version: int = Depends(get_api_version),
    service: UserService = Depends(get_user_service),
):
    """Get user - version determined by X-API-Version header."""
    add_deprecation_headers(response, version)

    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if version == 1:
        return UserResponseV1(
            id=user.id,
            email=user.email,
            name=user.name,
        )

    return UserResponseV2(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        last_login=user.last_login,
        preferences=user.preferences,
        is_verified=user.is_verified,
    )


# ============================================================================
# App Setup
# ============================================================================

def create_versioned_app():
    """Create FastAPI app with versioned routers."""
    from fastapi import FastAPI

    app = FastAPI(
        title="Versioned API",
        version="2.0.0",
        description="API with URL path versioning",
    )

    # Mount versioned routers
    app.include_router(v1_router, prefix="/api/v1")
    app.include_router(v2_router, prefix="/api/v2")

    # Optional: Header-based versioning on /api
    app.include_router(header_versioned_router, prefix="/api")

    return app


# ============================================================================
# Usage
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    app = create_versioned_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)

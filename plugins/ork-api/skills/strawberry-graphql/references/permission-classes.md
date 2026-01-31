# Permission Classes

Authentication and authorization with reusable permission classes.

## Basic Permission

```python
from strawberry.permission import BasePermission
from strawberry.types import Info

class IsAuthenticated(BasePermission):
    message = "Authentication required"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.current_user is not None
```

## Role-Based Access

```python
class HasRole(BasePermission):
    """Check if user has required role."""

    def __init__(self, role: str):
        self.role = role
        self.message = f"Role '{role}' required"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        user = info.context.current_user
        if not user:
            return False
        return self.role in user.roles

# Factory for common roles
IsAdmin = lambda: HasRole("admin")
IsModerator = lambda: HasRole("moderator")

# Usage
@strawberry.field(permission_classes=[IsAdmin()])
async def admin_dashboard(self, info: Info) -> AdminStats:
    return await info.context.admin_service.get_stats()
```

## Resource Ownership

```python
class IsOwner(BasePermission):
    """Check if user owns the resource."""
    message = "You can only access your own resources"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        user = info.context.current_user
        if not user:
            return False

        # Check kwargs for resource ID
        resource_id = kwargs.get("id")
        if resource_id:
            resource = await self._get_resource(info, resource_id)
            return resource and resource.owner_id == user.id

        # Check source object
        if hasattr(source, "owner_id"):
            return source.owner_id == user.id
        if hasattr(source, "user_id"):
            return source.user_id == user.id

        return False

    async def _get_resource(self, info: Info, resource_id: str):
        # Override in subclasses for specific resources
        return None

class IsPostOwner(IsOwner):
    async def _get_resource(self, info: Info, resource_id: str):
        return await info.context.post_service.get(resource_id)
```

## Permission Combination

```python
class AllPermissions(BasePermission):
    """All permissions must pass (AND logic)."""

    def __init__(self, *permissions: BasePermission):
        self.permissions = permissions
        self.message = "Permission denied"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        for perm in self.permissions:
            if not await perm.has_permission(source, info, **kwargs):
                self.message = perm.message
                return False
        return True

class AnyPermission(BasePermission):
    """At least one permission must pass (OR logic)."""

    def __init__(self, *permissions: BasePermission):
        self.permissions = permissions
        self.message = "Permission denied"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        for perm in self.permissions:
            if await perm.has_permission(source, info, **kwargs):
                return True
        return False

# Usage
@strawberry.mutation(permission_classes=[
    AllPermissions(IsAuthenticated(), AnyPermission(IsAdmin(), IsPostOwner()))
])
async def update_post(self, info: Info, id: strawberry.ID, input: UpdatePostInput) -> Post:
    return await info.context.post_service.update(id, input)
```

## Rate Limiting

```python
from datetime import datetime, timedelta

class RateLimited(BasePermission):
    """Rate limit GraphQL operations."""

    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.message = f"Rate limit exceeded. Max {max_requests} requests per {window_seconds}s"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        user_id = info.context.current_user_id or info.context.client_ip
        key = f"rate:{info.field_name}:{user_id}"

        redis = info.context.redis
        current = await redis.incr(key)

        if current == 1:
            await redis.expire(key, self.window)

        return current <= self.max_requests

# Usage
@strawberry.mutation(permission_classes=[IsAuthenticated(), RateLimited(10, 60)])
async def create_post(self, info: Info, input: CreatePostInput) -> Post:
    return await info.context.post_service.create(input)
```

## Field-Level Permissions

```python
@strawberry.type
class User:
    id: strawberry.ID
    email: str
    name: str

    @strawberry.field(permission_classes=[IsOwnerOrAdmin()])
    async def private_data(self, info: Info) -> PrivateUserData:
        return await info.context.user_service.get_private(self.id)

    @strawberry.field(permission_classes=[IsAdmin()])
    async def admin_notes(self, info: Info) -> str | None:
        return await info.context.admin_service.get_user_notes(self.id)
```

## Context Authentication

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class CurrentUser:
    id: str
    email: str
    roles: list[str]

async def get_context(request: Request) -> GraphQLContext:
    current_user = None

    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_jwt(token)
            current_user = CurrentUser(
                id=payload["sub"],
                email=payload["email"],
                roles=payload.get("roles", []),
            )
        except JWTError:
            pass  # Invalid token, user remains None

    return GraphQLContext(
        request=request,
        current_user=current_user,
        # ... other context
    )
```

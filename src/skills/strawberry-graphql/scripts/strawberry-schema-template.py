"""
Strawberry GraphQL Schema Template (0.240+)

Type-safe GraphQL schema with resolvers, input types, and pagination.
Copy and adapt for your domain entities.
"""

import strawberry
from strawberry import Private
from strawberry.types import Info
from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID


# =============================================================================
# ENUMS
# =============================================================================

@strawberry.enum
class EntityStatus:
    """Status enum - customize for your domain."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    ARCHIVED = "archived"


# =============================================================================
# BASE TYPES
# =============================================================================

T = TypeVar("T")


@strawberry.type
class PageInfo:
    """Relay-style pagination info."""
    has_next_page: bool
    has_previous_page: bool
    start_cursor: str | None = None
    end_cursor: str | None = None
    total_count: int = 0


@strawberry.type
class Edge(Generic[T]):
    """Generic edge type for connections."""
    cursor: str
    node: T


@strawberry.type
class Connection(Generic[T]):
    """Generic connection type for paginated results."""
    edges: list[Edge[T]]
    page_info: PageInfo


# =============================================================================
# ENTITY TYPES
# =============================================================================

@strawberry.type
class Entity:
    """
    Base entity with common fields.

    Usage:
        @strawberry.type
        class Product(Entity):
            name: str
            price: float
    """
    id: strawberry.ID
    created_at: datetime
    updated_at: datetime | None = None

    # Private field (not exposed in schema)
    internal_notes: Private[str | None] = None


@strawberry.type
class User:
    """Example user type with resolvers."""

    id: strawberry.ID
    email: str
    name: str
    status: EntityStatus
    created_at: datetime
    avatar_url: str | None = None

    # Private fields - not in schema
    password_hash: Private[str]

    @strawberry.field
    def display_name(self) -> str:
        """Computed field example."""
        return f"{self.name} ({self.email})"

    @strawberry.field
    def gravatar_url(self, size: int = 80) -> str:
        """Field with arguments."""
        import hashlib
        email_hash = hashlib.md5(self.email.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?s={size}&d=identicon"

    @strawberry.field
    async def posts(
        self,
        info: Info,
        first: int = 10,
    ) -> list["Post"]:
        """Nested resolver using DataLoader to prevent N+1."""
        loader = info.context.post_loader
        return await loader.load_by_user(self.id, first)


@strawberry.type
class Post:
    """Example post type with back-reference."""

    id: strawberry.ID
    title: str
    content: str
    author_id: strawberry.ID
    status: EntityStatus
    published_at: datetime | None
    created_at: datetime

    @strawberry.field
    async def author(self, info: Info) -> User:
        """Resolve author using DataLoader."""
        return await info.context.user_loader.load(self.author_id)

    @strawberry.field
    def excerpt(self, length: int = 200) -> str:
        """Return truncated content."""
        if len(self.content) <= length:
            return self.content
        return self.content[:length].rsplit(" ", 1)[0] + "..."


# =============================================================================
# INPUT TYPES
# =============================================================================

@strawberry.input
class CreateUserInput:
    """Input for creating a user."""
    email: str
    name: str
    password: str


@strawberry.input
class UpdateUserInput:
    """Input for updating a user - all fields optional."""
    name: str | None = None
    avatar_url: str | None = None
    status: EntityStatus | None = None


@strawberry.input
class CreatePostInput:
    """Input for creating a post."""
    title: str
    content: str
    published: bool = False


@strawberry.input
class UpdatePostInput:
    """Input for updating a post."""
    title: str | None = None
    content: str | None = None
    status: EntityStatus | None = None


@strawberry.input
class PaginationInput:
    """Cursor-based pagination input."""
    first: int = 10
    after: str | None = None


@strawberry.input
class FilterInput:
    """Example filter input."""
    status: EntityStatus | None = None
    search: str | None = None
    created_after: datetime | None = None
    created_before: datetime | None = None


# =============================================================================
# RESULT TYPES (Union for mutation responses)
# =============================================================================

@strawberry.type
class FieldError:
    """Field-level validation error."""
    field: str
    message: str
    code: str


@strawberry.type
class MutationError:
    """Error response for mutations."""
    message: str
    errors: list[FieldError] = strawberry.field(default_factory=list)


@strawberry.type
class CreateUserSuccess:
    """Success response for user creation."""
    user: User


CreateUserResult = strawberry.union(
    "CreateUserResult",
    types=[CreateUserSuccess, MutationError],
)


@strawberry.type
class UpdateUserSuccess:
    """Success response for user update."""
    user: User


UpdateUserResult = strawberry.union(
    "UpdateUserResult",
    types=[UpdateUserSuccess, MutationError],
)


@strawberry.type
class DeleteSuccess:
    """Success response for deletion."""
    success: bool
    id: strawberry.ID


DeleteResult = strawberry.union(
    "DeleteResult",
    types=[DeleteSuccess, MutationError],
)


# =============================================================================
# QUERY TYPE
# =============================================================================

@strawberry.type
class Query:
    """Root query type."""

    @strawberry.field
    async def user(self, info: Info, id: strawberry.ID) -> User | None:
        """Get user by ID."""
        service = info.context.user_service
        return await service.get(id)

    @strawberry.field
    async def users(
        self,
        info: Info,
        pagination: PaginationInput | None = None,
        filter: FilterInput | None = None,
    ) -> Connection[User]:
        """List users with pagination and filtering."""
        service = info.context.user_service
        pagination = pagination or PaginationInput()
        return await service.list_paginated(
            first=pagination.first,
            after=pagination.after,
            filter=filter,
        )

    @strawberry.field
    async def me(self, info: Info) -> User | None:
        """Get current authenticated user."""
        user_id = info.context.current_user_id
        if not user_id:
            return None
        return await info.context.user_service.get(user_id)

    @strawberry.field
    async def post(self, info: Info, id: strawberry.ID) -> Post | None:
        """Get post by ID."""
        return await info.context.post_service.get(id)

    @strawberry.field
    async def posts(
        self,
        info: Info,
        pagination: PaginationInput | None = None,
        filter: FilterInput | None = None,
    ) -> Connection[Post]:
        """List posts with pagination and filtering."""
        pagination = pagination or PaginationInput()
        return await info.context.post_service.list_paginated(
            first=pagination.first,
            after=pagination.after,
            filter=filter,
        )


# =============================================================================
# MUTATION TYPE
# =============================================================================

@strawberry.type
class Mutation:
    """Root mutation type."""

    @strawberry.mutation
    async def create_user(
        self,
        info: Info,
        input: CreateUserInput,
    ) -> CreateUserResult:
        """Create a new user."""
        errors = []

        # Validation
        if "@" not in input.email:
            errors.append(FieldError(
                field="email",
                message="Invalid email format",
                code="INVALID_EMAIL",
            ))

        if len(input.password) < 8:
            errors.append(FieldError(
                field="password",
                message="Password must be at least 8 characters",
                code="WEAK_PASSWORD",
            ))

        if errors:
            return MutationError(
                message="Validation failed",
                errors=errors,
            )

        try:
            user = await info.context.user_service.create(
                email=input.email,
                name=input.name,
                password=input.password,
            )
            return CreateUserSuccess(user=user)
        except ValueError as e:
            return MutationError(message=str(e))

    @strawberry.mutation
    async def update_user(
        self,
        info: Info,
        id: strawberry.ID,
        input: UpdateUserInput,
    ) -> UpdateUserResult:
        """Update an existing user."""
        # Authorization check
        if info.context.current_user_id != id:
            return MutationError(message="Cannot update other users")

        updates = {k: v for k, v in input.__dict__.items() if v is not None}
        if not updates:
            return MutationError(message="No updates provided")

        user = await info.context.user_service.update(id, **updates)
        if not user:
            return MutationError(message="User not found")

        return UpdateUserSuccess(user=user)

    @strawberry.mutation
    async def delete_user(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> DeleteResult:
        """Delete a user."""
        # Admin-only check
        if not info.context.is_admin:
            return MutationError(message="Admin access required")

        success = await info.context.user_service.delete(id)
        if not success:
            return MutationError(message="User not found")

        return DeleteSuccess(success=True, id=id)

    @strawberry.mutation
    async def create_post(
        self,
        info: Info,
        input: CreatePostInput,
    ) -> Post:
        """Create a new post."""
        user_id = info.context.current_user_id
        if not user_id:
            raise PermissionError("Authentication required")

        return await info.context.post_service.create(
            author_id=user_id,
            title=input.title,
            content=input.content,
            published=input.published,
        )


# =============================================================================
# SCHEMA
# =============================================================================

# Import Subscription from subscription-template.py for full schema
# from .subscriptions import Subscription

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    # subscription=Subscription,  # Uncomment when subscriptions needed
)


# =============================================================================
# USAGE NOTES
# =============================================================================
"""
1. Replace User/Post with your domain entities
2. Implement services (user_service, post_service) with:
   - get(id) -> Entity | None
   - list_paginated(first, after, filter) -> Connection[Entity]
   - create(**kwargs) -> Entity
   - update(id, **kwargs) -> Entity | None
   - delete(id) -> bool

3. Implement DataLoaders (see dataloader-template.py):
   - UserLoader
   - PostLoader

4. Create GraphQL context (see FastAPI integration):
   class GraphQLContext:
       user_service: UserService
       post_service: PostService
       user_loader: UserLoader
       post_loader: PostLoader
       current_user_id: str | None
       is_admin: bool

5. Cursor encoding:
   import base64
   def encode_cursor(id: str) -> str:
       return base64.b64encode(f"cursor:{id}".encode()).decode()
   def decode_cursor(cursor: str) -> str:
       return base64.b64decode(cursor.encode()).decode().replace("cursor:", "")
"""

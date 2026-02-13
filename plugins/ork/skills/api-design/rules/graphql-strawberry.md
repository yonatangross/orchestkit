---
title: Strawberry GraphQL Schema Design
impact: HIGH
impactDescription: "Type-safe GraphQL with code-first schema prevents runtime type mismatches and N+1 query problems"
tags: graphql, strawberry, python, code-first, dataloader
---

## Strawberry GraphQL Schema Design

**Incorrect -- N+1 queries in resolvers:**
```python
# Making database calls in resolver loops
@strawberry.type
class Post:
    author_id: strawberry.ID

    @strawberry.field
    async def author(self, info: strawberry.Info) -> "User":
        # N+1: One query per post!
        return await db.get_user(self.author_id)
```

**Correct -- DataLoader for batched loading:**
```python
from strawberry.dataloader import DataLoader

class UserLoader(DataLoader[str, "User"]):
    def __init__(self, user_repo):
        super().__init__(load_fn=self.batch_load)
        self.user_repo = user_repo

    async def batch_load(self, keys: list[str]) -> list["User"]:
        users = await self.user_repo.get_many(keys)
        user_map = {u.id: u for u in users}
        return [user_map.get(key) for key in keys]

@strawberry.type
class Post:
    author_id: strawberry.ID

    @strawberry.field
    async def author(self, info: strawberry.Info) -> "User":
        return await info.context.user_loader.load(self.author_id)
```

**Correct -- type-safe schema with Private fields:**
```python
import strawberry
from strawberry import Private

@strawberry.type
class User:
    id: strawberry.ID
    email: str
    name: str
    password_hash: Private[str]  # Not exposed in schema

    @strawberry.field
    def display_name(self) -> str:
        return f"{self.name} ({self.email})"

@strawberry.input
class CreateUserInput:
    email: str
    name: str
    password: str
```

**Correct -- union types for mutation error handling:**
```python
@strawberry.type
class CreateUserSuccess:
    user: User

@strawberry.type
class UserError:
    message: str
    code: str
    field: str | None = None

@strawberry.type
class CreateUserError:
    errors: list[UserError]

CreateUserResult = strawberry.union("CreateUserResult", [CreateUserSuccess, CreateUserError])
```

Key decisions:
- Schema approach: Code-first with Strawberry types
- N+1 prevention: DataLoader for ALL nested resolvers
- Pagination: Relay-style cursor pagination
- Auth: Permission classes (IsAuthenticated, IsAdmin)
- Errors: Union types for mutations
- Use when: Complex data relationships, client-driven fetching, real-time subscriptions
- Do NOT use when: Simple CRUD (use REST), internal microservices (use gRPC)

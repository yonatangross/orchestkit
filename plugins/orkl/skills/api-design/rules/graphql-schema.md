---
title: GraphQL Schema Patterns and FastAPI Integration
impact: HIGH
impactDescription: "Proper GraphQL schema patterns with auth and subscriptions prevent security gaps and enable real-time features"
tags: graphql, strawberry, fastapi, subscriptions, permissions, authentication
---

## GraphQL Schema Patterns and FastAPI Integration

**Incorrect -- unprotected GraphQL endpoints:**
```python
# No authentication or authorization
@strawberry.type
class Query:
    @strawberry.field
    async def all_users(self, info: strawberry.Info) -> list[User]:
        return await info.context.user_service.list_all()  # Anyone can see all users!

# Exposing internal IDs
@strawberry.type
class User:
    id: int  # Exposes auto-increment ID!
```

**Correct -- permission classes for authorization:**
```python
from strawberry.permission import BasePermission

class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    async def has_permission(self, source, info: strawberry.Info, **kwargs) -> bool:
        return info.context.current_user_id is not None

class IsAdmin(BasePermission):
    message = "Admin access required"

    async def has_permission(self, source, info: strawberry.Info, **kwargs) -> bool:
        user_id = info.context.current_user_id
        if not user_id:
            return False
        user = await info.context.user_service.get(user_id)
        return user and user.role == "admin"

@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def me(self, info: strawberry.Info) -> User:
        return await info.context.user_service.get(info.context.current_user_id)

    @strawberry.field(permission_classes=[IsAdmin])
    async def all_users(self, info: strawberry.Info) -> list[User]:
        return await info.context.user_service.list_all()
```

**Correct -- FastAPI integration with context getter:**
```python
from strawberry.fastapi import GraphQLRouter

schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)

async def get_context(request: Request, user_service=Depends(get_user_service)) -> GraphQLContext:
    return GraphQLContext(request=request, user_service=user_service)

graphql_router = GraphQLRouter(schema, context_getter=get_context, graphiql=True)
app = FastAPI()
app.include_router(graphql_router, prefix="/graphql")
```

**Correct -- subscriptions with Redis PubSub:**
```python
@strawberry.type
class Subscription:
    @strawberry.subscription
    async def user_updated(self, info: strawberry.Info, user_id: strawberry.ID) -> AsyncGenerator[User, None]:
        async for message in info.context.pubsub.subscribe(f"user:{user_id}:updated"):
            yield User(**message)
```

Key decisions:
- Use opaque IDs (strawberry.ID) not internal auto-increment
- Permission classes for field-level authorization
- Redis PubSub for subscription horizontal scaling
- Context getter for dependency injection

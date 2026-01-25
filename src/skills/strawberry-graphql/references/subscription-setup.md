# Subscription Setup

WebSocket subscriptions with Redis PubSub for horizontal scaling.

## Redis PubSub Implementation

```python
import redis.asyncio as redis
import json
from typing import AsyncGenerator
from contextlib import asynccontextmanager

class RedisPubSub:
    """Production-ready Redis PubSub for GraphQL subscriptions."""

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def publish(self, channel: str, data: dict) -> int:
        """Publish message to channel. Returns subscriber count."""
        return await self.redis.publish(channel, json.dumps(data))

    async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
        """Subscribe to channel and yield messages."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield json.loads(message["data"])
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    async def close(self):
        await self.redis.aclose()
```

## Subscription Resolver

```python
import strawberry
from strawberry.types import Info
from typing import AsyncGenerator

@strawberry.type
class Subscription:
    @strawberry.subscription
    async def post_created(
        self, info: Info
    ) -> AsyncGenerator["Post", None]:
        """Subscribe to new posts."""
        async for data in info.context.pubsub.subscribe("posts:created"):
            yield Post(**data)

    @strawberry.subscription
    async def user_activity(
        self, info: Info, user_id: strawberry.ID
    ) -> AsyncGenerator["UserActivity", None]:
        """Subscribe to specific user's activity."""
        # Auth check
        if not info.context.current_user_id:
            raise PermissionError("Authentication required")

        channel = f"user:{user_id}:activity"
        async for data in info.context.pubsub.subscribe(channel):
            yield UserActivity(**data)
```

## Publishing Events

```python
class PostService:
    def __init__(self, session: AsyncSession, pubsub: RedisPubSub):
        self.session = session
        self.pubsub = pubsub

    async def create(self, input: CreatePostInput, author_id: str) -> Post:
        post = PostModel(**input.__dict__, author_id=author_id)
        self.session.add(post)
        await self.session.commit()

        # Publish to subscribers
        await self.pubsub.publish("posts:created", {
            "id": str(post.id),
            "title": post.title,
            "content": post.content,
            "author_id": author_id,
            "created_at": post.created_at.isoformat(),
        })

        return Post.from_model(post)
```

## FastAPI WebSocket Setup

```python
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
)

graphql_router = GraphQLRouter(
    schema,
    context_getter=get_context,
    subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL],
)

app = FastAPI()
app.include_router(graphql_router, prefix="/graphql")
```

## Connection Lifecycle

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.pubsub = RedisPubSub(settings.redis_url)
    yield
    # Shutdown
    await app.state.pubsub.close()
```

## Multi-Channel Subscriptions

```python
@strawberry.subscription
async def notifications(
    self, info: Info, types: list[str] | None = None
) -> AsyncGenerator["Notification", None]:
    """Subscribe to multiple notification types."""
    user_id = info.context.current_user_id

    channels = [f"user:{user_id}:notification:{t}" for t in (types or ["all"])]

    async for channel, data in info.context.pubsub.subscribe_many(channels):
        yield Notification(**data)
```

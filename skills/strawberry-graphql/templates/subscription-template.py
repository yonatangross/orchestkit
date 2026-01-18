"""
Strawberry GraphQL Subscription Template (0.240+)

WebSocket-based subscriptions with Redis PubSub for horizontal scaling.
Supports real-time notifications, live updates, and event streaming.
"""

import strawberry
from strawberry.types import Info
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL
from typing import AsyncGenerator
import asyncio
import json
from datetime import datetime
from dataclasses import dataclass
from contextlib import asynccontextmanager
import redis.asyncio as redis


# =============================================================================
# PUBSUB IMPLEMENTATION
# =============================================================================

class RedisPubSub:
    """
    Redis-based PubSub for GraphQL subscriptions.
    Enables horizontal scaling across multiple server instances.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._redis: redis.Redis | None = None

    async def connect(self):
        """Initialize Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url)
        return self._redis

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def publish(self, channel: str, message: dict) -> int:
        """
        Publish message to channel.

        Args:
            channel: Channel name (e.g., "user:123:notifications")
            message: Dict to publish (will be JSON serialized)

        Returns:
            Number of subscribers that received the message
        """
        client = await self.connect()
        return await client.publish(channel, json.dumps(message))

    async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
        """
        Subscribe to channel and yield messages.

        Usage:
            async for message in pubsub.subscribe("events"):
                yield Event(**message)
        """
        client = await self.connect()
        pubsub = client.pubsub()

        try:
            await pubsub.subscribe(channel)

            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    yield data

        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    async def subscribe_pattern(self, pattern: str) -> AsyncGenerator[tuple[str, dict], None]:
        """
        Subscribe to pattern and yield (channel, message) tuples.

        Usage:
            async for channel, message in pubsub.subscribe_pattern("user:*:events"):
                print(f"Received on {channel}: {message}")
        """
        client = await self.connect()
        pubsub = client.pubsub()

        try:
            await pubsub.psubscribe(pattern)

            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"].decode()
                    data = json.loads(message["data"])
                    yield channel, data

        finally:
            await pubsub.punsubscribe(pattern)
            await pubsub.close()


# =============================================================================
# SUBSCRIPTION TYPES
# =============================================================================

@strawberry.type
class Notification:
    """Generic notification type."""
    id: strawberry.ID
    type: str
    title: str
    message: str
    read: bool
    created_at: datetime
    metadata: str | None = None  # JSON string for flexible data


@strawberry.type
class UserUpdate:
    """User update event."""
    user_id: strawberry.ID
    field: str
    old_value: str | None
    new_value: str | None
    updated_at: datetime


@strawberry.type
class NewPost:
    """New post event."""
    id: strawberry.ID
    title: str
    author_id: strawberry.ID
    author_name: str
    created_at: datetime


@strawberry.type
class LiveComment:
    """Live comment for real-time updates."""
    id: strawberry.ID
    post_id: strawberry.ID
    author_name: str
    text: str
    created_at: datetime


@strawberry.enum
class PresenceStatus:
    ONLINE = "online"
    AWAY = "away"
    OFFLINE = "offline"


@strawberry.type
class UserPresence:
    """User presence update."""
    user_id: strawberry.ID
    status: PresenceStatus
    last_seen: datetime


# =============================================================================
# SUBSCRIPTION RESOLVERS
# =============================================================================

@strawberry.type
class Subscription:
    """GraphQL subscription resolvers."""

    @strawberry.subscription
    async def notifications(
        self,
        info: Info,
    ) -> AsyncGenerator[Notification, None]:
        """
        Subscribe to user notifications.
        Requires authentication.
        """
        user_id = info.context.current_user_id
        if not user_id:
            raise PermissionError("Authentication required")

        pubsub: RedisPubSub = info.context.pubsub
        channel = f"user:{user_id}:notifications"

        async for message in pubsub.subscribe(channel):
            yield Notification(
                id=message["id"],
                type=message["type"],
                title=message["title"],
                message=message["message"],
                read=message.get("read", False),
                created_at=datetime.fromisoformat(message["created_at"]),
                metadata=message.get("metadata"),
            )

    @strawberry.subscription
    async def user_updates(
        self,
        info: Info,
        user_id: strawberry.ID,
    ) -> AsyncGenerator[UserUpdate, None]:
        """
        Subscribe to specific user updates.
        For profiles, follower counts, etc.
        """
        pubsub: RedisPubSub = info.context.pubsub
        channel = f"user:{user_id}:updates"

        async for message in pubsub.subscribe(channel):
            yield UserUpdate(
                user_id=user_id,
                field=message["field"],
                old_value=message.get("old_value"),
                new_value=message.get("new_value"),
                updated_at=datetime.fromisoformat(message["updated_at"]),
            )

    @strawberry.subscription
    async def new_posts(
        self,
        info: Info,
        author_id: strawberry.ID | None = None,
    ) -> AsyncGenerator[NewPost, None]:
        """
        Subscribe to new posts.
        Optionally filter by author.
        """
        pubsub: RedisPubSub = info.context.pubsub

        if author_id:
            channel = f"user:{author_id}:posts"
        else:
            channel = "posts:new"

        async for message in pubsub.subscribe(channel):
            yield NewPost(
                id=message["id"],
                title=message["title"],
                author_id=message["author_id"],
                author_name=message["author_name"],
                created_at=datetime.fromisoformat(message["created_at"]),
            )

    @strawberry.subscription
    async def live_comments(
        self,
        info: Info,
        post_id: strawberry.ID,
    ) -> AsyncGenerator[LiveComment, None]:
        """
        Subscribe to comments on a specific post.
        For real-time discussion updates.
        """
        pubsub: RedisPubSub = info.context.pubsub
        channel = f"post:{post_id}:comments"

        async for message in pubsub.subscribe(channel):
            yield LiveComment(
                id=message["id"],
                post_id=post_id,
                author_name=message["author_name"],
                text=message["text"],
                created_at=datetime.fromisoformat(message["created_at"]),
            )

    @strawberry.subscription
    async def user_presence(
        self,
        info: Info,
        user_ids: list[strawberry.ID],
    ) -> AsyncGenerator[UserPresence, None]:
        """
        Subscribe to presence status of multiple users.
        For showing online/offline status.
        """
        if not user_ids or len(user_ids) > 100:
            raise ValueError("Provide 1-100 user IDs")

        pubsub: RedisPubSub = info.context.pubsub

        # Subscribe to pattern for all requested users
        async for channel, message in pubsub.subscribe_pattern("presence:*"):
            # Extract user_id from channel (presence:user_id)
            presence_user_id = channel.split(":")[1]

            if presence_user_id in user_ids:
                yield UserPresence(
                    user_id=presence_user_id,
                    status=PresenceStatus(message["status"]),
                    last_seen=datetime.fromisoformat(message["last_seen"]),
                )

    @strawberry.subscription
    async def heartbeat(self, info: Info) -> AsyncGenerator[datetime, None]:
        """
        Simple heartbeat subscription for connection keep-alive.
        Useful for connection health monitoring.
        """
        while True:
            yield datetime.now()
            await asyncio.sleep(30)


# =============================================================================
# PUBLISHING HELPERS
# =============================================================================

class NotificationPublisher:
    """
    Helper for publishing notifications from business logic.

    Usage:
        publisher = NotificationPublisher(pubsub)
        await publisher.notify_user(
            user_id="123",
            type="comment",
            title="New comment",
            message="Someone commented on your post",
        )
    """

    def __init__(self, pubsub: RedisPubSub):
        self.pubsub = pubsub

    async def notify_user(
        self,
        user_id: str,
        type: str,
        title: str,
        message: str,
        metadata: dict | None = None,
    ):
        """Send notification to specific user."""
        from uuid_utils import uuid7
        await self.pubsub.publish(
            f"user:{user_id}:notifications",
            {
                "id": str(uuid7()),
                "type": type,
                "title": title,
                "message": message,
                "read": False,
                "created_at": datetime.now().isoformat(),
                "metadata": json.dumps(metadata) if metadata else None,
            },
        )

    async def publish_new_post(self, post: "Post"):
        """Broadcast new post to all subscribers."""
        message = {
            "id": str(post.id),
            "title": post.title,
            "author_id": str(post.author_id),
            "author_name": post.author_name,
            "created_at": datetime.now().isoformat(),
        }

        # Publish to global feed
        await self.pubsub.publish("posts:new", message)

        # Publish to author's followers
        await self.pubsub.publish(f"user:{post.author_id}:posts", message)

    async def publish_comment(self, comment: "Comment"):
        """Publish new comment to post subscribers."""
        await self.pubsub.publish(
            f"post:{comment.post_id}:comments",
            {
                "id": str(comment.id),
                "author_name": comment.author_name,
                "text": comment.text,
                "created_at": datetime.now().isoformat(),
            },
        )

    async def update_presence(self, user_id: str, status: str):
        """Broadcast user presence update."""
        await self.pubsub.publish(
            f"presence:{user_id}",
            {
                "status": status,
                "last_seen": datetime.now().isoformat(),
            },
        )


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

from fastapi import FastAPI, Depends
from strawberry.fastapi import GraphQLRouter


def create_subscription_router(
    schema: strawberry.Schema,
    pubsub: RedisPubSub,
    get_context,
) -> GraphQLRouter:
    """
    Create GraphQL router with subscription support.

    Args:
        schema: Strawberry schema with Subscription type
        pubsub: RedisPubSub instance
        get_context: Async function returning GraphQL context

    Usage:
        pubsub = RedisPubSub("redis://localhost:6379")
        router = create_subscription_router(schema, pubsub, get_context)
        app.include_router(router, prefix="/graphql")
    """

    async def context_with_pubsub(info) -> dict:
        """Inject pubsub into context."""
        ctx = await get_context(info)
        ctx.pubsub = pubsub
        return ctx

    return GraphQLRouter(
        schema,
        context_getter=context_with_pubsub,
        subscription_protocols=[
            GRAPHQL_TRANSPORT_WS_PROTOCOL,  # graphql-ws
            GRAPHQL_WS_PROTOCOL,  # subscriptions-transport-ws (legacy)
        ],
    )


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================

@asynccontextmanager
async def subscription_lifespan(app: FastAPI):
    """
    FastAPI lifespan for managing PubSub connection.

    Usage:
        app = FastAPI(lifespan=subscription_lifespan)
    """
    pubsub = RedisPubSub(app.state.redis_url)
    await pubsub.connect()
    app.state.pubsub = pubsub

    yield

    await pubsub.close()


# =============================================================================
# EXAMPLE SCHEMA
# =============================================================================

"""
Full schema with subscriptions:

from strawberry_schema_template import Query, Mutation
from subscription_template import Subscription, RedisPubSub

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
)

# FastAPI setup
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    pubsub = RedisPubSub()
    await pubsub.connect()
    app.state.pubsub = pubsub
    yield
    await pubsub.close()

app = FastAPI(lifespan=lifespan)

async def get_context(request):
    return GraphQLContext(
        request=request,
        pubsub=app.state.pubsub,
        # ... other dependencies
    )

router = GraphQLRouter(
    schema,
    context_getter=get_context,
    subscription_protocols=[
        GRAPHQL_TRANSPORT_WS_PROTOCOL,
        GRAPHQL_WS_PROTOCOL,
    ],
)

app.include_router(router, prefix="/graphql")
"""


# =============================================================================
# CLIENT USAGE
# =============================================================================

"""
JavaScript client with graphql-ws:

import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'ws://localhost:8000/graphql',
  connectionParams: {
    authorization: 'Bearer <token>',
  },
});

// Subscribe to notifications
const unsubscribe = client.subscribe(
  {
    query: `
      subscription {
        notifications {
          id
          type
          title
          message
          createdAt
        }
      }
    `,
  },
  {
    next: (data) => console.log('Notification:', data),
    error: (error) => console.error('Error:', error),
    complete: () => console.log('Subscription completed'),
  },
);

// Cleanup
unsubscribe();
"""

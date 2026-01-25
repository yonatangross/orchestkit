"""
Real-Time Notifications Example (Strawberry 0.240+)

Complete subscription-based notification system with:
- Multiple notification types (mentions, reactions, follows, system)
- Redis PubSub for horizontal scaling
- Notification preferences and filtering
- Read/unread state management
- Batch operations
"""

import strawberry
from strawberry.types import Info
from strawberry.permission import BasePermission
from strawberry.dataloader import DataLoader
from typing import AsyncGenerator, Sequence
from datetime import datetime
from collections import defaultdict
import asyncio
import json
import redis.asyncio as redis
from uuid_utils import uuid7
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL


# =============================================================================
# ENUMS
# =============================================================================

@strawberry.enum
class NotificationType:
    """Types of notifications."""
    MENTION = "mention"           # @mentioned in post/comment
    REACTION = "reaction"         # Someone reacted to your content
    FOLLOW = "follow"             # New follower
    COMMENT = "comment"           # Comment on your post
    REPLY = "reply"               # Reply to your comment
    SYSTEM = "system"             # System announcements
    ACHIEVEMENT = "achievement"   # Unlocked achievement/badge
    REMINDER = "reminder"         # Scheduled reminder


@strawberry.enum
class NotificationPriority:
    """Notification priority for filtering."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# =============================================================================
# TYPES
# =============================================================================

@strawberry.type
class NotificationActor:
    """User who triggered the notification."""
    id: strawberry.ID
    name: str
    avatar_url: str | None


@strawberry.type
class NotificationTarget:
    """The content/object the notification relates to."""
    id: strawberry.ID
    type: str  # "post", "comment", "user"
    title: str
    url: str


@strawberry.type
class Notification:
    """Individual notification."""
    id: strawberry.ID
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    read: bool
    read_at: datetime | None
    created_at: datetime
    expires_at: datetime | None

    # Optional actor (who triggered it)
    actor_id: strawberry.ID | None
    # Optional target (what it's about)
    target_id: strawberry.ID | None
    target_type: str | None

    # Extra data as JSON
    metadata: str | None

    @strawberry.field
    async def actor(self, info: Info) -> NotificationActor | None:
        """Load the user who triggered this notification."""
        if not self.actor_id:
            return None
        return await info.context.notification_actor_loader.load(self.actor_id)

    @strawberry.field
    def target_url(self) -> str | None:
        """Generate URL to the notification target."""
        if not self.target_id or not self.target_type:
            return None
        # URL generation logic
        url_map = {
            "post": f"/posts/{self.target_id}",
            "comment": f"/comments/{self.target_id}",
            "user": f"/users/{self.target_id}",
        }
        return url_map.get(self.target_type)


@strawberry.type
class NotificationEdge:
    cursor: str
    node: Notification


@strawberry.type
class PageInfo:
    has_next_page: bool
    has_previous_page: bool
    start_cursor: str | None = None
    end_cursor: str | None = None


@strawberry.type
class NotificationConnection:
    edges: list[NotificationEdge]
    page_info: PageInfo
    total_count: int
    unread_count: int


@strawberry.type
class NotificationPreferences:
    """User's notification preferences."""
    user_id: strawberry.ID
    email_enabled: bool
    push_enabled: bool
    mention_enabled: bool
    reaction_enabled: bool
    follow_enabled: bool
    comment_enabled: bool
    system_enabled: bool
    quiet_hours_start: int | None  # Hour (0-23)
    quiet_hours_end: int | None


@strawberry.type
class UnreadCounts:
    """Unread notification counts by type."""
    total: int
    mentions: int
    reactions: int
    follows: int
    comments: int
    system: int


# =============================================================================
# INPUT TYPES
# =============================================================================

@strawberry.input
class NotificationFilterInput:
    types: list[NotificationType] | None = None
    priority: NotificationPriority | None = None
    unread_only: bool = False
    since: datetime | None = None


@strawberry.input
class UpdatePreferencesInput:
    email_enabled: bool | None = None
    push_enabled: bool | None = None
    mention_enabled: bool | None = None
    reaction_enabled: bool | None = None
    follow_enabled: bool | None = None
    comment_enabled: bool | None = None
    system_enabled: bool | None = None
    quiet_hours_start: int | None = None
    quiet_hours_end: int | None = None


# =============================================================================
# PUBSUB
# =============================================================================

class NotificationPubSub:
    """Redis-based PubSub for notifications."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._redis: redis.Redis | None = None

    async def connect(self):
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url)
        return self._redis

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def publish_notification(self, user_id: str, notification: dict):
        """Publish notification to user's channel."""
        client = await self.connect()
        channel = f"notifications:{user_id}"
        await client.publish(channel, json.dumps(notification))

    async def publish_bulk(self, user_ids: list[str], notification: dict):
        """Publish same notification to multiple users."""
        client = await self.connect()
        for user_id in user_ids:
            channel = f"notifications:{user_id}"
            await client.publish(channel, json.dumps(notification))

    async def subscribe(self, user_id: str) -> AsyncGenerator[dict, None]:
        """Subscribe to user's notification channel."""
        client = await self.connect()
        pubsub = client.pubsub()
        channel = f"notifications:{user_id}"

        try:
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield json.loads(message["data"])
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


# =============================================================================
# NOTIFICATION SERVICE
# =============================================================================

class NotificationService:
    """Service for creating and managing notifications."""

    def __init__(self, db, pubsub: NotificationPubSub):
        self.db = db
        self.pubsub = pubsub

    async def create(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        actor_id: str | None = None,
        target_id: str | None = None,
        target_type: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        """Create and publish a notification."""

        # Check user preferences
        prefs = await self._get_preferences(user_id)
        if not self._should_notify(prefs, type):
            return None

        # Check quiet hours
        if self._in_quiet_hours(prefs):
            priority = NotificationPriority.LOW

        notification = Notification(
            id=str(uuid7()),
            type=type,
            priority=priority,
            title=title,
            message=message,
            read=False,
            read_at=None,
            created_at=datetime.now(),
            expires_at=None,
            actor_id=actor_id,
            target_id=target_id,
            target_type=target_type,
            metadata=json.dumps(metadata) if metadata else None,
        )

        # Save to database
        await self._save(user_id, notification)

        # Publish for real-time delivery
        await self.pubsub.publish_notification(user_id, self._to_dict(notification))

        return notification

    async def create_mention(
        self,
        mentioned_user_id: str,
        mentioner_id: str,
        content_id: str,
        content_type: str,
        content_preview: str,
    ) -> Notification:
        """Create a mention notification."""
        mentioner = await self._get_user(mentioner_id)
        return await self.create(
            user_id=mentioned_user_id,
            type=NotificationType.MENTION,
            title=f"{mentioner.name} mentioned you",
            message=content_preview[:100],
            priority=NotificationPriority.HIGH,
            actor_id=mentioner_id,
            target_id=content_id,
            target_type=content_type,
        )

    async def create_reaction(
        self,
        content_owner_id: str,
        reactor_id: str,
        reaction: str,
        content_id: str,
        content_type: str,
    ) -> Notification:
        """Create a reaction notification."""
        reactor = await self._get_user(reactor_id)
        return await self.create(
            user_id=content_owner_id,
            type=NotificationType.REACTION,
            title=f"{reactor.name} reacted with {reaction}",
            message=f"to your {content_type}",
            priority=NotificationPriority.LOW,
            actor_id=reactor_id,
            target_id=content_id,
            target_type=content_type,
            metadata={"reaction": reaction},
        )

    async def create_follow(
        self,
        followed_user_id: str,
        follower_id: str,
    ) -> Notification:
        """Create a follow notification."""
        follower = await self._get_user(follower_id)
        return await self.create(
            user_id=followed_user_id,
            type=NotificationType.FOLLOW,
            title=f"{follower.name} started following you",
            message="Check out their profile",
            priority=NotificationPriority.NORMAL,
            actor_id=follower_id,
            target_id=follower_id,
            target_type="user",
        )

    async def broadcast_system(
        self,
        user_ids: list[str],
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
    ):
        """Broadcast system notification to multiple users."""
        notification_dict = {
            "id": str(uuid7()),
            "type": NotificationType.SYSTEM.value,
            "priority": priority.value,
            "title": title,
            "message": message,
            "read": False,
            "read_at": None,
            "created_at": datetime.now().isoformat(),
            "actor_id": None,
            "target_id": None,
            "target_type": None,
            "metadata": None,
        }

        # Batch insert to database
        await self._bulk_save(user_ids, notification_dict)

        # Publish to all users
        await self.pubsub.publish_bulk(user_ids, notification_dict)

    async def mark_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read."""
        # Database update
        return await self._update_read_status(notification_id, user_id, True)

    async def mark_all_read(self, user_id: str) -> int:
        """Mark all notifications as read for user."""
        return await self._mark_all_read(user_id)

    async def get_unread_counts(self, user_id: str) -> UnreadCounts:
        """Get unread counts by type."""
        counts = await self._get_counts(user_id)
        return UnreadCounts(
            total=sum(counts.values()),
            mentions=counts.get(NotificationType.MENTION.value, 0),
            reactions=counts.get(NotificationType.REACTION.value, 0),
            follows=counts.get(NotificationType.FOLLOW.value, 0),
            comments=counts.get(NotificationType.COMMENT.value, 0),
            system=counts.get(NotificationType.SYSTEM.value, 0),
        )

    # Private helper methods (implement with actual DB)
    async def _get_preferences(self, user_id: str) -> NotificationPreferences:
        # Fetch from DB
        pass

    def _should_notify(self, prefs: NotificationPreferences, type: NotificationType) -> bool:
        # Check preferences
        type_map = {
            NotificationType.MENTION: prefs.mention_enabled if prefs else True,
            NotificationType.REACTION: prefs.reaction_enabled if prefs else True,
            NotificationType.FOLLOW: prefs.follow_enabled if prefs else True,
            NotificationType.COMMENT: prefs.comment_enabled if prefs else True,
            NotificationType.SYSTEM: prefs.system_enabled if prefs else True,
        }
        return type_map.get(type, True)

    def _in_quiet_hours(self, prefs: NotificationPreferences) -> bool:
        if not prefs or prefs.quiet_hours_start is None:
            return False
        current_hour = datetime.now().hour
        start = prefs.quiet_hours_start
        end = prefs.quiet_hours_end or start
        if start <= end:
            return start <= current_hour < end
        return current_hour >= start or current_hour < end

    async def _save(self, user_id: str, notification: Notification):
        # Save to database
        pass

    async def _bulk_save(self, user_ids: list[str], notification_dict: dict):
        # Bulk insert
        pass

    async def _get_user(self, user_id: str):
        # Fetch user
        pass

    def _to_dict(self, notification: Notification) -> dict:
        return {
            "id": notification.id,
            "type": notification.type.value,
            "priority": notification.priority.value,
            "title": notification.title,
            "message": notification.message,
            "read": notification.read,
            "created_at": notification.created_at.isoformat(),
            "actor_id": notification.actor_id,
            "target_id": notification.target_id,
            "target_type": notification.target_type,
            "metadata": notification.metadata,
        }

    async def _update_read_status(self, notification_id: str, user_id: str, read: bool) -> bool:
        pass

    async def _mark_all_read(self, user_id: str) -> int:
        pass

    async def _get_counts(self, user_id: str) -> dict:
        pass


# =============================================================================
# PERMISSIONS
# =============================================================================

class IsAuthenticated(BasePermission):
    message = "Authentication required"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.current_user_id is not None


# =============================================================================
# DATALOADERS
# =============================================================================

class NotificationActorLoader(DataLoader[str, NotificationActor]):
    def __init__(self, user_repo):
        super().__init__(load_fn=self.batch_load)
        self.user_repo = user_repo

    async def batch_load(self, keys: list[str]) -> Sequence[NotificationActor | None]:
        users = await self.user_repo.get_many(keys)
        user_map = {}
        for u in users:
            user_map[str(u.id)] = NotificationActor(
                id=str(u.id),
                name=u.name,
                avatar_url=u.avatar_url,
            )
        return [user_map.get(k) for k in keys]


# =============================================================================
# SUBSCRIPTION
# =============================================================================

@strawberry.type
class Subscription:
    @strawberry.subscription
    async def notifications(
        self,
        info: Info,
        types: list[NotificationType] | None = None,
    ) -> AsyncGenerator[Notification, None]:
        """
        Subscribe to real-time notifications.
        Optionally filter by notification types.
        """
        user_id = info.context.current_user_id
        if not user_id:
            raise PermissionError("Authentication required")

        pubsub: NotificationPubSub = info.context.pubsub

        async for message in pubsub.subscribe(user_id):
            notification = Notification(
                id=message["id"],
                type=NotificationType(message["type"]),
                priority=NotificationPriority(message["priority"]),
                title=message["title"],
                message=message["message"],
                read=message["read"],
                read_at=None,
                created_at=datetime.fromisoformat(message["created_at"]),
                expires_at=None,
                actor_id=message.get("actor_id"),
                target_id=message.get("target_id"),
                target_type=message.get("target_type"),
                metadata=message.get("metadata"),
            )

            # Filter by type if specified
            if types and notification.type not in types:
                continue

            yield notification

    @strawberry.subscription
    async def unread_count(self, info: Info) -> AsyncGenerator[UnreadCounts, None]:
        """
        Subscribe to unread notification count updates.
        Emits new count whenever it changes.
        """
        user_id = info.context.current_user_id
        if not user_id:
            raise PermissionError("Authentication required")

        service: NotificationService = info.context.notification_service

        # Emit initial count
        yield await service.get_unread_counts(user_id)

        # Then emit on each notification
        async for _ in info.context.pubsub.subscribe(user_id):
            yield await service.get_unread_counts(user_id)


# =============================================================================
# QUERY
# =============================================================================

@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def notifications(
        self,
        info: Info,
        first: int = 20,
        after: str | None = None,
        filter: NotificationFilterInput | None = None,
    ) -> NotificationConnection:
        """Get paginated notifications for current user."""
        service: NotificationService = info.context.notification_service
        return await service.list_paginated(
            user_id=info.context.current_user_id,
            first=min(first, 100),
            after=after,
            filter=filter,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def unread_counts(self, info: Info) -> UnreadCounts:
        """Get unread notification counts."""
        service: NotificationService = info.context.notification_service
        return await service.get_unread_counts(info.context.current_user_id)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def notification_preferences(self, info: Info) -> NotificationPreferences:
        """Get notification preferences for current user."""
        return await info.context.notification_service.get_preferences(
            info.context.current_user_id
        )


# =============================================================================
# MUTATION
# =============================================================================

@strawberry.type
class Mutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def mark_notification_read(
        self,
        info: Info,
        notification_id: strawberry.ID,
    ) -> bool:
        """Mark a notification as read."""
        service: NotificationService = info.context.notification_service
        return await service.mark_read(
            notification_id=notification_id,
            user_id=info.context.current_user_id,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def mark_all_notifications_read(self, info: Info) -> int:
        """Mark all notifications as read. Returns count of affected."""
        service: NotificationService = info.context.notification_service
        return await service.mark_all_read(info.context.current_user_id)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_notification_preferences(
        self,
        info: Info,
        input: UpdatePreferencesInput,
    ) -> NotificationPreferences:
        """Update notification preferences."""
        service: NotificationService = info.context.notification_service
        updates = {k: v for k, v in input.__dict__.items() if v is not None}
        return await service.update_preferences(
            user_id=info.context.current_user_id,
            **updates,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_notification(
        self,
        info: Info,
        notification_id: strawberry.ID,
    ) -> bool:
        """Delete a notification."""
        service: NotificationService = info.context.notification_service
        return await service.delete(
            notification_id=notification_id,
            user_id=info.context.current_user_id,
        )


# =============================================================================
# SCHEMA
# =============================================================================

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
)


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

class NotificationContext:
    def __init__(
        self,
        request: Request,
        current_user_id: str | None,
        pubsub: NotificationPubSub,
        notification_service: NotificationService,
        user_repo,
    ):
        self.request = request
        self.current_user_id = current_user_id
        self.pubsub = pubsub
        self.notification_service = notification_service
        self.notification_actor_loader = NotificationActorLoader(user_repo)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with PubSub management."""
    pubsub = NotificationPubSub(app.state.redis_url)
    await pubsub.connect()
    app.state.pubsub = pubsub

    yield

    await pubsub.close()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.state.redis_url = "redis://localhost:6379"

    async def get_context(request: Request) -> NotificationContext:
        # Extract user from JWT (simplified)
        auth = request.headers.get("authorization", "")
        user_id = decode_token(auth) if auth else None

        return NotificationContext(
            request=request,
            current_user_id=user_id,
            pubsub=request.app.state.pubsub,
            notification_service=NotificationService(
                db=request.app.state.db,
                pubsub=request.app.state.pubsub,
            ),
            user_repo=request.app.state.user_repo,
        )

    graphql_router = GraphQLRouter(
        schema,
        context_getter=get_context,
        subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL],
    )

    app.include_router(graphql_router, prefix="/graphql")
    return app


def decode_token(auth: str) -> str | None:
    """Decode JWT token. Implement with actual JWT library."""
    if auth.startswith("Bearer "):
        # Simplified - implement with jose or authlib
        return "user_123"
    return None


# =============================================================================
# CLIENT USAGE EXAMPLE
# =============================================================================

"""
JavaScript client example:

import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'ws://localhost:8000/graphql',
  connectionParams: {
    authorization: 'Bearer <token>',
  },
});

// Subscribe to all notifications
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
          actor {
            name
            avatarUrl
          }
          targetUrl
        }
      }
    `,
  },
  {
    next: (data) => {
      const notification = data.data.notifications;
      showToast(notification);
    },
    error: (error) => console.error('Error:', error),
    complete: () => console.log('Completed'),
  },
);

// Subscribe to unread count only
const countUnsub = client.subscribe(
  {
    query: `
      subscription {
        unreadCount {
          total
          mentions
          reactions
        }
      }
    `,
  },
  {
    next: (data) => {
      updateBadge(data.data.unreadCount.total);
    },
  },
);

// Query notifications
const result = await client.query({
  query: `
    query GetNotifications($filter: NotificationFilterInput) {
      notifications(first: 20, filter: $filter) {
        edges {
          node {
            id
            type
            title
            message
            read
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        unreadCount
      }
    }
  `,
  variables: {
    filter: { unreadOnly: true },
  },
});

// Mark as read
await client.mutate({
  query: `
    mutation MarkRead($id: ID!) {
      markNotificationRead(notificationId: $id)
    }
  `,
  variables: { id: notificationId },
});
"""

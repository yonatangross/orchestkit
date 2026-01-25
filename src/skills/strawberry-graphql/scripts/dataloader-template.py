"""
Strawberry DataLoader Template (0.240+)

Generic DataLoader patterns for preventing N+1 queries in GraphQL resolvers.
Batches multiple requests into single database queries.
"""

from strawberry.dataloader import DataLoader
from typing import TypeVar, Generic, Sequence, Callable, Awaitable
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload


T = TypeVar("T")
K = TypeVar("K")


# =============================================================================
# GENERIC BASE LOADER
# =============================================================================

class BaseLoader(Generic[K, T]):
    """
    Base DataLoader with common patterns.

    Usage:
        class UserLoader(BaseLoader[str, User]):
            async def batch_load(self, keys: list[str]) -> list[User | None]:
                users = await self.repo.get_many(keys)
                return self._map_results(keys, users, lambda u: u.id)
    """

    def __init__(self):
        self._loader = DataLoader(load_fn=self.batch_load)

    async def load(self, key: K) -> T | None:
        """Load single item by key."""
        return await self._loader.load(key)

    async def load_many(self, keys: list[K]) -> list[T | None]:
        """Load multiple items by keys."""
        return await self._loader.load_many(keys)

    async def batch_load(self, keys: list[K]) -> Sequence[T | None]:
        """
        Override this method to implement batch loading.
        Must return results in same order as keys.
        """
        raise NotImplementedError

    def _map_results(
        self,
        keys: list[K],
        items: list[T],
        key_fn: Callable[[T], K],
    ) -> list[T | None]:
        """
        Map items to keys, returning None for missing items.
        Maintains order of keys.
        """
        item_map = {key_fn(item): item for item in items}
        return [item_map.get(key) for key in keys]


# =============================================================================
# ENTITY LOADERS
# =============================================================================

class UserLoader(BaseLoader[str, "User"]):
    """
    Load users by ID with batching.

    Usage in resolver:
        @strawberry.field
        async def author(self, info: Info) -> User:
            return await info.context.user_loader.load(self.author_id)
    """

    def __init__(self, session: AsyncSession):
        super().__init__()
        self.session = session

    async def batch_load(self, keys: list[str]) -> Sequence["User | None"]:
        # Single query for all requested users
        result = await self.session.execute(
            select(UserModel).where(UserModel.id.in_(keys))
        )
        users = result.scalars().all()

        # Convert ORM models to GraphQL types
        graphql_users = [User.from_orm(u) for u in users]

        # Return in same order as keys
        return self._map_results(keys, graphql_users, lambda u: str(u.id))


class PostLoader(BaseLoader[str, "Post"]):
    """Load posts by ID with batching."""

    def __init__(self, session: AsyncSession):
        super().__init__()
        self.session = session

    async def batch_load(self, keys: list[str]) -> Sequence["Post | None"]:
        result = await self.session.execute(
            select(PostModel).where(PostModel.id.in_(keys))
        )
        posts = result.scalars().all()
        graphql_posts = [Post.from_orm(p) for p in posts]
        return self._map_results(keys, graphql_posts, lambda p: str(p.id))


# =============================================================================
# RELATIONSHIP LOADERS
# =============================================================================

class PostsByUserLoader:
    """
    Load posts grouped by user_id.
    Returns list of posts for each user.

    Usage:
        @strawberry.field
        async def posts(self, info: Info, limit: int = 10) -> list[Post]:
            return await info.context.posts_by_user_loader.load(self.id, limit)
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, user_id: str, limit: int = 10) -> list["Post"]:
        """Load posts for a user with limit."""
        # Include limit in cache key
        return await self._loader.load((user_id, limit))

    async def _batch_load(
        self,
        keys: list[tuple[str, int]],
    ) -> Sequence[list["Post"]]:
        # Extract unique user IDs and max limit
        user_ids = list(set(k[0] for k in keys))
        max_limit = max(k[1] for k in keys)

        # Single query with window function for per-user limit
        # This is more efficient than N+1 queries
        result = await self.session.execute(
            select(PostModel)
            .where(PostModel.author_id.in_(user_ids))
            .order_by(PostModel.created_at.desc())
        )
        posts = result.scalars().all()

        # Group by user_id
        posts_by_user: dict[str, list[Post]] = defaultdict(list)
        for post in posts:
            posts_by_user[str(post.author_id)].append(Post.from_orm(post))

        # Return results in same order as keys, applying per-key limit
        return [
            posts_by_user.get(user_id, [])[:limit]
            for user_id, limit in keys
        ]


class CommentsByPostLoader:
    """
    Load comments grouped by post_id.
    Similar pattern to PostsByUserLoader.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, post_id: str, limit: int = 50) -> list["Comment"]:
        return await self._loader.load((post_id, limit))

    async def _batch_load(
        self,
        keys: list[tuple[str, int]],
    ) -> Sequence[list["Comment"]]:
        post_ids = list(set(k[0] for k in keys))

        result = await self.session.execute(
            select(CommentModel)
            .where(CommentModel.post_id.in_(post_ids))
            .order_by(CommentModel.created_at.asc())
        )
        comments = result.scalars().all()

        comments_by_post: dict[str, list[Comment]] = defaultdict(list)
        for comment in comments:
            comments_by_post[str(comment.post_id)].append(
                Comment.from_orm(comment)
            )

        return [
            comments_by_post.get(post_id, [])[:limit]
            for post_id, limit in keys
        ]


# =============================================================================
# COUNT LOADERS
# =============================================================================

class PostCountByUserLoader:
    """
    Load post counts by user_id.
    Efficient for showing counts without loading all posts.

    Usage:
        @strawberry.field
        async def post_count(self, info: Info) -> int:
            return await info.context.post_count_loader.load(self.id)
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, user_id: str) -> int:
        return await self._loader.load(user_id)

    async def _batch_load(self, keys: list[str]) -> Sequence[int]:
        from sqlalchemy import func

        result = await self.session.execute(
            select(
                PostModel.author_id,
                func.count(PostModel.id).label("count"),
            )
            .where(PostModel.author_id.in_(keys))
            .group_by(PostModel.author_id)
        )
        counts = {str(row.author_id): row.count for row in result}

        # Return 0 for users with no posts
        return [counts.get(key, 0) for key in keys]


# =============================================================================
# AGGREGATE LOADERS
# =============================================================================

class UserStatsLoader:
    """
    Load multiple aggregates for users in one query.

    Usage:
        @strawberry.field
        async def stats(self, info: Info) -> UserStats:
            return await info.context.user_stats_loader.load(self.id)
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, user_id: str) -> "UserStats":
        return await self._loader.load(user_id)

    async def _batch_load(self, keys: list[str]) -> Sequence["UserStats"]:
        from sqlalchemy import func

        # Aggregate query for all stats
        result = await self.session.execute(
            select(
                PostModel.author_id,
                func.count(PostModel.id).label("post_count"),
                func.count(PostModel.id).filter(
                    PostModel.status == "published"
                ).label("published_count"),
                func.max(PostModel.created_at).label("last_post_at"),
            )
            .where(PostModel.author_id.in_(keys))
            .group_by(PostModel.author_id)
        )

        stats_map = {}
        for row in result:
            stats_map[str(row.author_id)] = UserStats(
                post_count=row.post_count,
                published_count=row.published_count,
                last_post_at=row.last_post_at,
            )

        # Return default stats for users with no posts
        default = UserStats(post_count=0, published_count=0, last_post_at=None)
        return [stats_map.get(key, default) for key in keys]


# =============================================================================
# CONTEXT FACTORY
# =============================================================================

class LoaderContext:
    """
    Factory for creating loaders with shared session.
    Create new instance per request.

    Usage in FastAPI:
        async def get_context(
            request: Request,
            session: AsyncSession = Depends(get_session),
        ) -> LoaderContext:
            return LoaderContext(session)
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self._user_loader: UserLoader | None = None
        self._post_loader: PostLoader | None = None
        self._posts_by_user: PostsByUserLoader | None = None
        self._post_count: PostCountByUserLoader | None = None
        self._user_stats: UserStatsLoader | None = None

    @property
    def user_loader(self) -> UserLoader:
        """Lazy initialization of user loader."""
        if self._user_loader is None:
            self._user_loader = UserLoader(self.session)
        return self._user_loader

    @property
    def post_loader(self) -> PostLoader:
        if self._post_loader is None:
            self._post_loader = PostLoader(self.session)
        return self._post_loader

    @property
    def posts_by_user_loader(self) -> PostsByUserLoader:
        if self._posts_by_user is None:
            self._posts_by_user = PostsByUserLoader(self.session)
        return self._posts_by_user

    @property
    def post_count_loader(self) -> PostCountByUserLoader:
        if self._post_count is None:
            self._post_count = PostCountByUserLoader(self.session)
        return self._post_count

    @property
    def user_stats_loader(self) -> UserStatsLoader:
        if self._user_stats is None:
            self._user_stats = UserStatsLoader(self.session)
        return self._user_stats


# =============================================================================
# TYPE STUBS (Replace with actual types)
# =============================================================================

import strawberry
from datetime import datetime


@strawberry.type
class User:
    id: strawberry.ID
    email: str
    name: str

    @classmethod
    def from_orm(cls, model) -> "User":
        return cls(id=str(model.id), email=model.email, name=model.name)


@strawberry.type
class Post:
    id: strawberry.ID
    title: str
    content: str
    author_id: strawberry.ID

    @classmethod
    def from_orm(cls, model) -> "Post":
        return cls(
            id=str(model.id),
            title=model.title,
            content=model.content,
            author_id=str(model.author_id),
        )


@strawberry.type
class Comment:
    id: strawberry.ID
    text: str
    post_id: strawberry.ID

    @classmethod
    def from_orm(cls, model) -> "Comment":
        return cls(
            id=str(model.id),
            text=model.text,
            post_id=str(model.post_id),
        )


@strawberry.type
class UserStats:
    post_count: int
    published_count: int
    last_post_at: datetime | None


# ORM Model stubs (replace with actual SQLAlchemy models)
class UserModel:
    id: str
    email: str
    name: str


class PostModel:
    id: str
    title: str
    content: str
    author_id: str
    status: str
    created_at: datetime


class CommentModel:
    id: str
    text: str
    post_id: str
    created_at: datetime

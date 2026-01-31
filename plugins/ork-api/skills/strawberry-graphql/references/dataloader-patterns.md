# DataLoader Patterns

Prevent N+1 queries with batch loading and request-scoped caching.

## Core Pattern

```python
from strawberry.dataloader import DataLoader
from typing import Sequence

class UserLoader(DataLoader[str, User | None]):
    """Load users by ID with automatic batching."""

    def __init__(self, session: AsyncSession):
        super().__init__(load_fn=self.batch_load)
        self.session = session

    async def batch_load(self, keys: list[str]) -> Sequence[User | None]:
        # Single query for all keys
        result = await self.session.execute(
            select(UserModel).where(UserModel.id.in_(keys))
        )
        users = {u.id: u for u in result.scalars()}
        # Return in same order as keys
        return [users.get(key) for key in keys]
```

## One-to-Many Loading

```python
class PostsByUserLoader(DataLoader[str, list[Post]]):
    """Load posts grouped by user_id."""

    async def batch_load(self, user_ids: list[str]) -> Sequence[list[Post]]:
        result = await self.session.execute(
            select(PostModel)
            .where(PostModel.user_id.in_(user_ids))
            .order_by(PostModel.created_at.desc())
        )

        posts_by_user: dict[str, list[Post]] = defaultdict(list)
        for post in result.scalars():
            posts_by_user[post.user_id].append(post)

        return [posts_by_user.get(uid, []) for uid in user_ids]
```

## Parameterized Loading

```python
class PostLoader:
    """Loader with configurable parameters."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache: dict[tuple, DataLoader] = {}

    def by_user(self, limit: int = 10) -> DataLoader[str, list[Post]]:
        key = ("by_user", limit)
        if key not in self._cache:
            self._cache[key] = DataLoader(
                load_fn=lambda ids: self._load_by_user(ids, limit)
            )
        return self._cache[key]

    async def _load_by_user(
        self, user_ids: list[str], limit: int
    ) -> Sequence[list[Post]]:
        # Use window function for per-user limit
        stmt = (
            select(PostModel)
            .where(PostModel.user_id.in_(user_ids))
            .order_by(PostModel.user_id, PostModel.created_at.desc())
        )
        # Apply limit per user with Python (or use ROW_NUMBER in SQL)
        result = await self.session.execute(stmt)

        posts_by_user: dict[str, list[Post]] = defaultdict(list)
        for post in result.scalars():
            if len(posts_by_user[post.user_id]) < limit:
                posts_by_user[post.user_id].append(post)

        return [posts_by_user.get(uid, []) for uid in user_ids]
```

## Context Factory Pattern

```python
from dataclasses import dataclass

@dataclass
class Loaders:
    """Request-scoped loader container."""
    users: UserLoader
    posts: PostLoader
    comments: CommentLoader

async def create_loaders(session: AsyncSession) -> Loaders:
    return Loaders(
        users=UserLoader(session),
        posts=PostLoader(session),
        comments=CommentLoader(session),
    )

async def get_context(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> GraphQLContext:
    loaders = await create_loaders(session)
    return GraphQLContext(request=request, loaders=loaders)
```

## Caching Behavior

- **Request-scoped**: Loaders reset per GraphQL request
- **Automatic deduplication**: Same key loads once per request
- **Order preservation**: Results match input key order

## Anti-Patterns

```python
# WRONG: Creating loader in resolver (no batching)
@strawberry.field
async def author(self, info: Info) -> User:
    loader = UserLoader(info.context.session)  # New loader each time!
    return await loader.load(self.author_id)

# CORRECT: Use context-scoped loader
@strawberry.field
async def author(self, info: Info) -> User:
    return await info.context.loaders.users.load(self.author_id)
```

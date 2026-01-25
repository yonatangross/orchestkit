# Blog API Example

Complete GraphQL API with users, posts, and comments.

## Schema Types

```python
# app/graphql/types.py
import strawberry
from datetime import datetime
from typing import Optional
from strawberry import Private

@strawberry.enum
class PostStatus:
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

@strawberry.type
class User:
    id: strawberry.ID
    email: str
    name: str
    bio: Optional[str] = None
    created_at: datetime

    # Private - not exposed in schema
    password_hash: Private[str]

    @strawberry.field
    async def posts(
        self,
        info: strawberry.Info,
        status: Optional[PostStatus] = None,
        limit: int = 10,
    ) -> list["Post"]:
        return await info.context.loaders.posts.load(
            self.id, status=status, limit=limit
        )

    @strawberry.field
    async def post_count(self, info: strawberry.Info) -> int:
        return await info.context.post_service.count_by_user(self.id)

@strawberry.type
class Post:
    id: strawberry.ID
    title: str
    slug: str
    content: str
    excerpt: Optional[str] = None
    status: PostStatus
    author_id: strawberry.ID
    created_at: datetime
    published_at: Optional[datetime] = None

    @strawberry.field
    async def author(self, info: strawberry.Info) -> User:
        return await info.context.loaders.users.load(self.author_id)

    @strawberry.field
    async def comments(
        self,
        info: strawberry.Info,
        limit: int = 20,
    ) -> list["Comment"]:
        return await info.context.loaders.comments_by_post.load(
            self.id, limit=limit
        )

    @strawberry.field
    async def comment_count(self, info: strawberry.Info) -> int:
        return await info.context.comment_service.count_by_post(self.id)

@strawberry.type
class Comment:
    id: strawberry.ID
    content: str
    post_id: strawberry.ID
    author_id: strawberry.ID
    created_at: datetime

    @strawberry.field
    async def author(self, info: strawberry.Info) -> User:
        return await info.context.loaders.users.load(self.author_id)

    @strawberry.field
    async def post(self, info: strawberry.Info) -> Post:
        return await info.context.loaders.posts_by_id.load(self.post_id)
```

## Pagination Types

```python
@strawberry.type
class PageInfo:
    has_next_page: bool
    has_previous_page: bool
    start_cursor: Optional[str] = None
    end_cursor: Optional[str] = None

@strawberry.type
class PostEdge:
    cursor: str
    node: Post

@strawberry.type
class PostConnection:
    edges: list[PostEdge]
    page_info: PageInfo
    total_count: int
```

## Input Types

```python
@strawberry.input
class CreatePostInput:
    title: str
    content: str
    excerpt: Optional[str] = None
    status: PostStatus = PostStatus.DRAFT

@strawberry.input
class UpdatePostInput:
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    status: Optional[PostStatus] = None

@strawberry.input
class CreateCommentInput:
    post_id: strawberry.ID
    content: str
```

## Query Resolvers

```python
@strawberry.type
class Query:
    @strawberry.field
    async def me(self, info: strawberry.Info) -> Optional[User]:
        user_id = info.context.current_user_id
        if not user_id:
            return None
        return await info.context.user_service.get(user_id)

    @strawberry.field
    async def user(
        self, info: strawberry.Info, id: strawberry.ID
    ) -> Optional[User]:
        return await info.context.user_service.get(id)

    @strawberry.field
    async def post(
        self, info: strawberry.Info, slug: str
    ) -> Optional[Post]:
        return await info.context.post_service.get_by_slug(slug)

    @strawberry.field
    async def posts(
        self,
        info: strawberry.Info,
        first: int = 10,
        after: Optional[str] = None,
        status: Optional[PostStatus] = PostStatus.PUBLISHED,
    ) -> PostConnection:
        return await info.context.post_service.list_paginated(
            first=first,
            after=after,
            status=status,
        )

    @strawberry.field
    async def search_posts(
        self,
        info: strawberry.Info,
        query: str,
        limit: int = 10,
    ) -> list[Post]:
        return await info.context.post_service.search(query, limit)
```

## Mutation Resolvers

```python
from app.graphql.permissions import IsAuthenticated, IsPostOwner

@strawberry.type
class CreatePostSuccess:
    post: Post

@strawberry.type
class CreatePostError:
    message: str
    code: str

CreatePostResult = strawberry.union(
    "CreatePostResult", [CreatePostSuccess, CreatePostError]
)

@strawberry.type
class Mutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_post(
        self, info: strawberry.Info, input: CreatePostInput
    ) -> CreatePostResult:
        try:
            post = await info.context.post_service.create(
                author_id=info.context.current_user_id,
                **input.__dict__,
            )
            return CreatePostSuccess(post=post)
        except ValidationError as e:
            return CreatePostError(message=str(e), code="VALIDATION_ERROR")

    @strawberry.mutation(permission_classes=[IsAuthenticated, IsPostOwner])
    async def update_post(
        self,
        info: strawberry.Info,
        id: strawberry.ID,
        input: UpdatePostInput,
    ) -> Post:
        return await info.context.post_service.update(id, **input.__dict__)

    @strawberry.mutation(permission_classes=[IsAuthenticated, IsPostOwner])
    async def delete_post(
        self, info: strawberry.Info, id: strawberry.ID
    ) -> bool:
        await info.context.post_service.delete(id)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_comment(
        self, info: strawberry.Info, input: CreateCommentInput
    ) -> Comment:
        return await info.context.comment_service.create(
            post_id=input.post_id,
            author_id=info.context.current_user_id,
            content=input.content,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def publish_post(
        self, info: strawberry.Info, id: strawberry.ID
    ) -> Post:
        return await info.context.post_service.publish(id)
```

## Subscription Resolvers

```python
@strawberry.type
class Subscription:
    @strawberry.subscription
    async def new_post(
        self, info: strawberry.Info
    ) -> AsyncGenerator[Post, None]:
        async for data in info.context.pubsub.subscribe("posts:published"):
            yield Post(**data)

    @strawberry.subscription
    async def new_comment(
        self, info: strawberry.Info, post_id: strawberry.ID
    ) -> AsyncGenerator[Comment, None]:
        channel = f"post:{post_id}:comments"
        async for data in info.context.pubsub.subscribe(channel):
            yield Comment(**data)
```

## Example Queries

```graphql
# Get current user with posts
query Me {
  me {
    id
    name
    email
    posts(status: PUBLISHED, limit: 5) {
      id
      title
      slug
      commentCount
    }
  }
}

# Get post with comments
query GetPost($slug: String!) {
  post(slug: $slug) {
    id
    title
    content
    publishedAt
    author {
      name
      bio
    }
    comments(limit: 10) {
      id
      content
      author {
        name
      }
      createdAt
    }
  }
}

# Paginated posts
query ListPosts($after: String) {
  posts(first: 10, after: $after, status: PUBLISHED) {
    edges {
      cursor
      node {
        id
        title
        slug
        excerpt
        author {
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

## Example Mutations

```graphql
# Create post
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on CreatePostSuccess {
      post {
        id
        slug
      }
    }
    ... on CreatePostError {
      message
      code
    }
  }
}

# Add comment
mutation AddComment($input: CreateCommentInput!) {
  createComment(input: $input) {
    id
    content
    createdAt
    author {
      name
    }
  }
}
```

## DataLoader Setup

```python
class BlogLoaders:
    def __init__(self, session: AsyncSession):
        self.users = UserLoader(session)
        self.posts_by_id = PostByIdLoader(session)
        self.posts = PostsByUserLoader(session)
        self.comments_by_post = CommentsByPostLoader(session)

class PostsByUserLoader(DataLoader[str, list[Post]]):
    async def batch_load(self, user_ids: list[str]) -> Sequence[list[Post]]:
        result = await self.session.execute(
            select(PostModel)
            .where(PostModel.author_id.in_(user_ids))
            .order_by(PostModel.created_at.desc())
        )
        posts_by_user = defaultdict(list)
        for post in result.scalars():
            posts_by_user[str(post.author_id)].append(Post.from_model(post))
        return [posts_by_user.get(uid, []) for uid in user_ids]
```

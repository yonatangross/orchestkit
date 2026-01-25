# Federation Patterns

Apollo Federation 2 setup for distributed GraphQL microservices.

## Entity Definition (Owner Service)

```python
# users-service/schema.py
import strawberry
from strawberry.federation import Schema

@strawberry.federation.type(keys=["id"])
class User:
    """User entity - owned by users-service."""
    id: strawberry.ID
    email: str
    name: str
    created_at: datetime

    @classmethod
    async def resolve_reference(
        cls, info: strawberry.Info, id: strawberry.ID
    ) -> "User | None":
        """Resolve User when referenced from other services."""
        return await info.context.user_service.get(id)

@strawberry.type
class Query:
    @strawberry.field
    async def user(self, info: strawberry.Info, id: strawberry.ID) -> User | None:
        return await info.context.user_service.get(id)

    @strawberry.field
    async def users(self, info: strawberry.Info) -> list[User]:
        return await info.context.user_service.list_all()

schema = Schema(query=Query, enable_federation_2=True)
```

## Extending External Types

```python
# posts-service/schema.py
import strawberry
from strawberry.federation import Schema

@strawberry.federation.type(keys=["id"], extend=True)
class User:
    """Extended User - adds posts field from posts-service."""
    id: strawberry.ID = strawberry.federation.field(external=True)

    @strawberry.field
    async def posts(
        self, info: strawberry.Info, limit: int = 10
    ) -> list["Post"]:
        return await info.context.post_service.get_by_user(self.id, limit)

    @strawberry.field
    async def post_count(self, info: strawberry.Info) -> int:
        return await info.context.post_service.count_by_user(self.id)

@strawberry.federation.type(keys=["id"])
class Post:
    """Post entity - owned by posts-service."""
    id: strawberry.ID
    title: str
    content: str
    author_id: strawberry.ID
    created_at: datetime

    @strawberry.field
    def author(self) -> User:
        """Reference to User entity (resolved by gateway)."""
        return User(id=self.author_id)

    @classmethod
    async def resolve_reference(
        cls, info: strawberry.Info, id: strawberry.ID
    ) -> "Post | None":
        return await info.context.post_service.get(id)

schema = Schema(query=Query, enable_federation_2=True)
```

## Compound Keys

```python
@strawberry.federation.type(keys=["userId productId"])
class Review:
    """Entity with compound key."""
    user_id: strawberry.ID = strawberry.federation.field(name="userId")
    product_id: strawberry.ID = strawberry.federation.field(name="productId")
    rating: int
    content: str

    @classmethod
    async def resolve_reference(
        cls, info: strawberry.Info, userId: strawberry.ID, productId: strawberry.ID
    ) -> "Review | None":
        return await info.context.review_service.get(userId, productId)
```

## Shareable Types

```python
@strawberry.federation.type(shareable=True)
class Money:
    """Value type shared across services."""
    amount: Decimal
    currency: str

@strawberry.federation.type(keys=["id"])
class Product:
    id: strawberry.ID
    name: str
    price: Money  # Shareable type
```

## Gateway Configuration (Apollo Router)

```yaml
# router.yaml
supergraph:
  introspection: true
  listen: 0.0.0.0:4000

subgraphs:
  users:
    routing_url: http://users-service:8000/graphql
    schema:
      subgraph_url: http://users-service:8000/graphql
  posts:
    routing_url: http://posts-service:8000/graphql
    schema:
      subgraph_url: http://posts-service:8000/graphql
  reviews:
    routing_url: http://reviews-service:8000/graphql
    schema:
      subgraph_url: http://reviews-service:8000/graphql

headers:
  all:
    request:
      - propagate:
          named: authorization
          default: ""
```

## Entity Batching

```python
@strawberry.federation.type(keys=["id"])
class User:
    id: strawberry.ID

    @classmethod
    async def resolve_references(
        cls, info: strawberry.Info, representations: list[dict]
    ) -> list["User | None"]:
        """Batch resolve multiple User references."""
        ids = [rep["id"] for rep in representations]
        users = await info.context.user_service.get_many(ids)
        user_map = {u.id: u for u in users}
        return [user_map.get(id) for id in ids]
```

## Key Decisions

| Aspect | Recommendation |
|--------|----------------|
| Entity ownership | One service owns each entity type |
| References | Return stub with ID, gateway resolves |
| Batching | Use resolve_references for performance |
| Shared types | Mark with @shareable directive |

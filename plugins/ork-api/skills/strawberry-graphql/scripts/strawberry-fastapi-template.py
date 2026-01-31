"""
Strawberry GraphQL + FastAPI Integration Template

Production-ready setup with:
- Async context with dependency injection
- Request-scoped DataLoaders
- Authentication via JWT
- Redis PubSub for subscriptions
- Error logging extension
"""

from contextlib import asynccontextmanager
from dataclasses import dataclass

import strawberry
from fastapi import Depends, FastAPI, Request
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.extensions import SchemaExtension
from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL

from app.core.auth import decode_jwt, JWTError
from app.core.config import settings
from app.db.session import get_db
from app.graphql.loaders import UserLoader, PostLoader
from app.graphql.pubsub import RedisPubSub
from app.graphql.resolvers import Query, Mutation, Subscription
from app.services.user_service import UserService
from app.services.post_service import PostService


# -----------------------------------------------------------------------------
# Context
# -----------------------------------------------------------------------------

@dataclass
class CurrentUser:
    """Authenticated user from JWT."""
    id: str
    email: str
    roles: list[str]


@dataclass
class GraphQLContext:
    """Request-scoped context available in all resolvers."""
    request: Request
    session: AsyncSession
    current_user: CurrentUser | None

    # Services
    user_service: UserService
    post_service: PostService

    # DataLoaders (request-scoped for batching)
    user_loader: UserLoader
    post_loader: PostLoader

    # PubSub for subscriptions
    pubsub: RedisPubSub

    @property
    def current_user_id(self) -> str | None:
        return self.current_user.id if self.current_user else None


async def get_context(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> GraphQLContext:
    """Build context for each GraphQL request."""

    # Parse JWT from Authorization header
    current_user = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_jwt(token)
            current_user = CurrentUser(
                id=payload["sub"],
                email=payload["email"],
                roles=payload.get("roles", []),
            )
        except JWTError:
            pass  # Invalid token - user remains None

    # Create services
    user_service = UserService(session)
    post_service = PostService(session)

    # Create request-scoped loaders
    user_loader = UserLoader(session)
    post_loader = PostLoader(session)

    return GraphQLContext(
        request=request,
        session=session,
        current_user=current_user,
        user_service=user_service,
        post_service=post_service,
        user_loader=user_loader,
        post_loader=post_loader,
        pubsub=request.app.state.pubsub,
    )


# -----------------------------------------------------------------------------
# Extensions
# -----------------------------------------------------------------------------

class ErrorLoggingExtension(SchemaExtension):
    """Log GraphQL errors for monitoring."""

    def on_operation(self):
        yield
        result = self.execution_context.result
        if result and result.errors:
            for error in result.errors:
                # Log with structured logging
                import structlog
                logger = structlog.get_logger()
                logger.error(
                    "graphql_error",
                    message=str(error.message),
                    path=error.path,
                    locations=error.locations,
                    operation=self.execution_context.operation_name,
                )


# -----------------------------------------------------------------------------
# Schema
# -----------------------------------------------------------------------------

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
    extensions=[ErrorLoggingExtension],
)


# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------

graphql_router = GraphQLRouter(
    schema,
    context_getter=get_context,
    graphiql=settings.debug,  # Enable GraphiQL in development
    subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL],
)


# -----------------------------------------------------------------------------
# Application
# -----------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    app.state.pubsub = RedisPubSub(settings.redis_url)

    yield

    # Shutdown
    await app.state.pubsub.close()


app = FastAPI(
    title="GraphQL API",
    lifespan=lifespan,
)

app.include_router(graphql_router, prefix="/graphql")


# -----------------------------------------------------------------------------
# Health Check
# -----------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Complete User Service Implementation

Production-ready gRPC user service with all patterns.

## Project Structure

```
user-service/
├── protos/
│   └── user/
│       └── v1/
│           └── user_service.proto
├── app/
│   ├── __init__.py
│   ├── protos/           # Generated code
│   │   └── user_v1/
│   ├── services/
│   │   └── user_service.py
│   ├── repositories/
│   │   └── user_repository.py
│   ├── interceptors/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── logging.py
│   │   └── retry.py
│   └── main.py
├── tests/
│   └── test_user_service.py
├── buf.yaml
├── buf.gen.yaml
└── pyproject.toml
```

## Proto Definition

```protobuf
// protos/user/v1/user_service.proto
syntax = "proto3";

package user.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
  UserStatus status = 4;
  google.protobuf.Timestamp created_at = 5;
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_INACTIVE = 2;
}

message GetUserRequest { string user_id = 1; }
message CreateUserRequest { string email = 1; string name = 2; string password = 3; }
message UpdateUserRequest { string user_id = 1; optional string name = 2; }
message DeleteUserRequest { string user_id = 1; }
message ListUsersRequest { int32 page_size = 1; string page_token = 2; }
```

## Service Implementation

```python
# app/services/user_service.py
from collections.abc import AsyncIterator

import grpc
from google.protobuf.empty_pb2 import Empty
from google.protobuf.timestamp_pb2 import Timestamp

from app.protos.user_v1 import user_service_pb2 as pb2
from app.protos.user_v1 import user_service_pb2_grpc as pb2_grpc
from app.repositories.user_repository import UserRepository


class UserServiceServicer(pb2_grpc.UserServiceServicer):
    def __init__(self, repository: UserRepository):
        self.repo = repository

    async def GetUser(
        self,
        request: pb2.GetUserRequest,
        context: grpc.aio.ServicerContext,
    ) -> pb2.User:
        if not request.user_id:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "user_id required")

        user = await self.repo.get(request.user_id)
        if not user:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"User {request.user_id} not found")

        return self._to_proto(user)

    async def CreateUser(
        self,
        request: pb2.CreateUserRequest,
        context: grpc.aio.ServicerContext,
    ) -> pb2.User:
        # Validation
        if not request.email or "@" not in request.email:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Invalid email")

        if len(request.password) < 8:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Password min 8 chars")

        # Check uniqueness
        existing = await self.repo.get_by_email(request.email)
        if existing:
            await context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email taken")

        user = await self.repo.create(
            email=request.email,
            name=request.name,
            password=request.password,
        )
        return self._to_proto(user)

    async def UpdateUser(
        self,
        request: pb2.UpdateUserRequest,
        context: grpc.aio.ServicerContext,
    ) -> pb2.User:
        user = await self.repo.get(request.user_id)
        if not user:
            await context.abort(grpc.StatusCode.NOT_FOUND, "User not found")

        updates = {}
        if request.HasField("name"):
            updates["name"] = request.name

        if updates:
            user = await self.repo.update(request.user_id, **updates)

        return self._to_proto(user)

    async def DeleteUser(
        self,
        request: pb2.DeleteUserRequest,
        context: grpc.aio.ServicerContext,
    ) -> Empty:
        deleted = await self.repo.delete(request.user_id)
        if not deleted:
            await context.abort(grpc.StatusCode.NOT_FOUND, "User not found")

        return Empty()

    async def ListUsers(
        self,
        request: pb2.ListUsersRequest,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[pb2.User]:
        page_size = min(request.page_size or 100, 1000)
        cursor = request.page_token or None

        async for user in self.repo.iterate(cursor=cursor, limit=page_size):
            if context.cancelled():
                return
            yield self._to_proto(user)

    def _to_proto(self, user) -> pb2.User:
        created_at = Timestamp()
        created_at.FromDatetime(user.created_at)

        return pb2.User(
            id=str(user.id),
            email=user.email,
            name=user.name,
            status=pb2.UserStatus.Value(f"USER_STATUS_{user.status.upper()}"),
            created_at=created_at,
        )
```

## Repository Pattern

```python
# app/repositories/user_repository.py
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: str) -> User | None:
        return await self.session.get(User, UUID(user_id))

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(self, email: str, name: str, password: str) -> User:
        user = User(email=email, name=name, password_hash=hash_password(password))
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user_id: str, **kwargs) -> User:
        user = await self.get(user_id)
        for key, value in kwargs.items():
            setattr(user, key, value)
        user.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return user

    async def delete(self, user_id: str) -> bool:
        user = await self.get(user_id)
        if not user:
            return False
        await self.session.delete(user)
        await self.session.commit()
        return True

    async def iterate(self, cursor: str | None, limit: int) -> AsyncIterator[User]:
        query = select(User).order_by(User.created_at).limit(limit)
        if cursor:
            query = query.where(User.id > UUID(cursor))

        result = await self.session.stream_scalars(query)
        async for user in result:
            yield user
```

## Main Server

```python
# app/main.py
import asyncio
import signal

import grpc
from grpc import aio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
import structlog

from app.protos.user_v1 import user_service_pb2_grpc as pb2_grpc
from app.services.user_service import UserServiceServicer
from app.interceptors.auth import AuthInterceptor
from app.interceptors.logging import LoggingInterceptor

logger = structlog.get_logger()


async def create_server(port: int = 50051) -> tuple[aio.Server, health.HealthServicer]:
    interceptors = [
        LoggingInterceptor(),
        AuthInterceptor(public_methods={"/user.v1.UserService/CreateUser"}),
    ]

    server = aio.server(
        interceptors=interceptors,
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
            ("grpc.keepalive_time_ms", 30000),
            ("grpc.keepalive_timeout_ms", 10000),
        ],
    )

    # Add user service
    repository = await create_repository()
    pb2_grpc.add_UserServiceServicer_to_server(UserServiceServicer(repository), server)

    # Add health service
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    server.add_insecure_port(f"[::]:{port}")

    return server, health_servicer


async def main():
    server, health_servicer = await create_server()
    shutdown = asyncio.Event()

    def signal_handler():
        logger.info("Shutdown signal received")
        health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)
        shutdown.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)

    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("user.v1.UserService", health_pb2.HealthCheckResponse.SERVING)

    await server.start()
    logger.info("Server started on port 50051")

    await shutdown.wait()
    await server.stop(30)
    logger.info("Server stopped")


if __name__ == "__main__":
    asyncio.run(main())
```

## Client Usage

```python
# client_example.py
import asyncio

import grpc
from grpc import aio

from app.protos.user_v1 import user_service_pb2 as pb2
from app.protos.user_v1 import user_service_pb2_grpc as pb2_grpc


async def main():
    async with aio.insecure_channel("localhost:50051") as channel:
        stub = pb2_grpc.UserServiceStub(channel)

        # Create user
        user = await stub.CreateUser(
            pb2.CreateUserRequest(
                email="test@example.com",
                name="Test User",
                password="securepass123",
            ),
            timeout=5.0,
        )
        print(f"Created: {user.id}")

        # Get user
        user = await stub.GetUser(pb2.GetUserRequest(user_id=user.id), timeout=5.0)
        print(f"Got: {user.name}")

        # List users
        async for u in stub.ListUsers(pb2.ListUsersRequest(page_size=10)):
            print(f"Listed: {u.email}")


if __name__ == "__main__":
    asyncio.run(main())
```

## Testing

```python
# tests/test_user_service.py
import pytest
from grpc import aio

from app.services.user_service import UserServiceServicer
from app.protos.user_v1 import user_service_pb2 as pb2


class MockContext:
    def __init__(self):
        self._cancelled = False
        self._code = None
        self._message = None

    def cancelled(self):
        return self._cancelled

    async def abort(self, code, message):
        self._code = code
        self._message = message
        raise Exception(f"{code}: {message}")


@pytest.fixture
def service():
    repo = MockUserRepository()
    return UserServiceServicer(repo)


@pytest.mark.asyncio
async def test_get_user_not_found(service):
    context = MockContext()
    request = pb2.GetUserRequest(user_id="nonexistent")

    with pytest.raises(Exception) as exc:
        await service.GetUser(request, context)

    assert "NOT_FOUND" in str(exc.value)


@pytest.mark.asyncio
async def test_create_user_invalid_email(service):
    context = MockContext()
    request = pb2.CreateUserRequest(email="invalid", name="Test", password="password123")

    with pytest.raises(Exception) as exc:
        await service.CreateUser(request, context)

    assert "INVALID_ARGUMENT" in str(exc.value)
```

## buf.gen.yaml

```yaml
version: v1
plugins:
  - plugin: python
    out: app/protos
  - plugin: pyi
    out: app/protos
  - plugin: grpc_python
    out: app/protos
```

## Generate Code

```bash
# Using buf
buf generate

# Using grpc_tools
python -m grpc_tools.protoc \
  -I./protos \
  --python_out=./app/protos \
  --pyi_out=./app/protos \
  --grpc_python_out=./app/protos \
  ./protos/user/v1/user_service.proto
```

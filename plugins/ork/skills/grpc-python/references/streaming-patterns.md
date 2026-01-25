# gRPC Streaming Patterns (Python 3.11+ Async)

All four streaming types with production-ready async patterns.

## 1. Unary RPC (Request-Response)

```python
# Async Server
async def GetUser(
    self,
    request: pb2.GetUserRequest,
    context: grpc.aio.ServicerContext,
) -> pb2.User:
    user = await self.repo.get(request.user_id)
    if not user:
        await context.abort(grpc.StatusCode.NOT_FOUND, "User not found")
    return self._to_proto(user)

# Async Client
async with grpc.aio.insecure_channel("localhost:50051") as channel:
    stub = pb2_grpc.UserServiceStub(channel)
    user = await stub.GetUser(pb2.GetUserRequest(user_id="123"), timeout=5.0)
```

## 2. Server Streaming

Server sends multiple responses. Use for large datasets, real-time feeds.

```python
# Async Server
async def ListUsers(
    self,
    request: pb2.ListUsersRequest,
    context: grpc.aio.ServicerContext,
):
    """Stream users with cancellation check."""
    async for user in self.repo.iterate_async(limit=request.page_size):
        if context.cancelled():
            return
        yield self._to_proto(user)

# Async Client with backpressure
async def consume_users():
    async with grpc.aio.insecure_channel("localhost:50051") as channel:
        stub = pb2_grpc.UserServiceStub(channel)
        async for user in stub.ListUsers(pb2.ListUsersRequest(page_size=100)):
            await process_user(user)  # Backpressure handled automatically
```

## 3. Client Streaming

Client sends multiple requests, server responds once. Use for bulk uploads.

```python
# Async Server
async def BulkCreateUsers(
    self,
    request_iterator: AsyncIterator[pb2.CreateUserRequest],
    context: grpc.aio.ServicerContext,
) -> pb2.BulkResponse:
    created, errors = [], []
    async for request in request_iterator:
        try:
            user = await self.repo.create(email=request.email)
            created.append(user.id)
        except Exception as e:
            errors.append(f"{request.email}: {e}")
    return pb2.BulkResponse(created_count=len(created), errors=errors)

# Async Client
async def upload_users(users: list[dict]):
    async def generate():
        for u in users:
            yield pb2.CreateUserRequest(email=u["email"], name=u["name"])

    async with grpc.aio.insecure_channel("localhost:50051") as channel:
        stub = pb2_grpc.UserServiceStub(channel)
        return await stub.BulkCreateUsers(generate())
```

## 4. Bidirectional Streaming

Both sides stream simultaneously. Use for chat, real-time sync.

```python
# Async Server
async def Chat(
    self,
    request_iterator: AsyncIterator[pb2.ChatMessage],
    context: grpc.aio.ServicerContext,
):
    """Echo messages with processing."""
    async for message in request_iterator:
        if context.cancelled():
            return
        yield pb2.ChatMessage(
            text=f"Echo: {message.text}",
            sender="server",
        )

# Async Client with concurrent send/receive
async def chat_session():
    async with grpc.aio.insecure_channel("localhost:50051") as channel:
        stub = pb2_grpc.ChatServiceStub(channel)

        async def send_messages():
            for text in ["Hello", "World"]:
                yield pb2.ChatMessage(text=text)
                await asyncio.sleep(0.5)

        async for response in stub.Chat(send_messages()):
            print(f"Received: {response.text}")
```

## Cancellation Best Practices

```python
async def ListLargeDataset(self, request, context):
    """Always check cancellation in long-running streams."""
    try:
        async for item in self.datasource.stream():
            if context.cancelled():
                logger.info("Client cancelled stream")
                return
            yield item
    except asyncio.CancelledError:
        logger.info("Stream cancelled")
        raise
```

## Quick Reference

| Type | Server | Client | Use Case |
|------|--------|--------|----------|
| Unary | `async def` returns | `await stub.Method()` | CRUD |
| Server Stream | `async def` yields | `async for` | Large lists |
| Client Stream | `async for request_iterator` | `async def generate()` | Uploads |
| Bidirectional | Combine both | Combine both | Real-time |

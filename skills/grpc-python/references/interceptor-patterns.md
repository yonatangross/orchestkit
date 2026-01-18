# gRPC Interceptor Patterns (Python 3.11+ Async)

Server and client interceptors for logging, auth, and retry.

## Async Server Interceptors

### Logging Interceptor

```python
import grpc.aio
import structlog
import time

logger = structlog.get_logger()

class AsyncLoggingInterceptor(grpc.aio.ServerInterceptor):
    async def intercept_service(
        self,
        continuation,
        handler_call_details: grpc.HandlerCallDetails,
    ):
        method = handler_call_details.method
        start = time.perf_counter()

        handler = await continuation(handler_call_details)

        async def logged_handler(request, context):
            try:
                response = await handler.unary_unary(request, context)
                logger.info("grpc.call", method=method, duration_ms=(time.perf_counter() - start) * 1000)
                return response
            except Exception as e:
                logger.error("grpc.error", method=method, error=str(e))
                raise

        return grpc.unary_unary_rpc_method_handler(logged_handler)
```

### Auth Interceptor

```python
class AsyncAuthInterceptor(grpc.aio.ServerInterceptor):
    def __init__(self, auth_service, public_methods: set[str]):
        self.auth_service = auth_service
        self.public_methods = public_methods

    async def intercept_service(self, continuation, handler_call_details):
        method = handler_call_details.method
        if method in self.public_methods:
            return await continuation(handler_call_details)

        metadata = dict(handler_call_details.invocation_metadata)
        token = metadata.get("authorization", "").removeprefix("Bearer ")

        if not token or not await self.auth_service.verify(token):
            async def abort(request, context):
                await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
            return grpc.unary_unary_rpc_method_handler(abort)

        return await continuation(handler_call_details)
```

## Async Client Interceptors

### Retry Interceptor

```python
class AsyncRetryInterceptor(grpc.aio.UnaryUnaryClientInterceptor):
    RETRYABLE = {grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED}

    def __init__(self, max_retries: int = 3, base_delay: float = 0.5):
        self.max_retries = max_retries
        self.base_delay = base_delay

    async def intercept_unary_unary(self, continuation, client_call_details, request):
        for attempt in range(self.max_retries + 1):
            try:
                return await continuation(client_call_details, request)
            except grpc.aio.AioRpcError as e:
                if e.code() not in self.RETRYABLE or attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.base_delay * (2 ** attempt))
```

### Metadata Injection

```python
class AsyncMetadataInterceptor(grpc.aio.UnaryUnaryClientInterceptor):
    def __init__(self, get_token, get_trace_id):
        self.get_token = get_token
        self.get_trace_id = get_trace_id

    async def intercept_unary_unary(self, continuation, client_call_details, request):
        metadata = list(client_call_details.metadata or [])
        metadata.extend([
            ("authorization", f"Bearer {await self.get_token()}"),
            ("x-trace-id", self.get_trace_id()),
        ])
        new_details = client_call_details._replace(metadata=metadata)
        return await continuation(new_details, request)
```

## Registration

```python
# Async Server
server = grpc.aio.server(interceptors=[
    AsyncLoggingInterceptor(),
    AsyncAuthInterceptor(auth_svc, {"/user.v1.UserService/Login"}),
])

# Async Client
channel = grpc.aio.insecure_channel("localhost:50051", interceptors=[
    AsyncRetryInterceptor(max_retries=3),
    AsyncMetadataInterceptor(get_token, get_trace_id),
])
```

## Interceptor Order

```
Request:  Client -> [Retry] -> [Metadata] -> Server
Server:   -> [Logging] -> [Auth] -> [RateLimit] -> Handler
Response: Handler -> [Logging] -> Client
```

First registered runs first for requests, last for responses.

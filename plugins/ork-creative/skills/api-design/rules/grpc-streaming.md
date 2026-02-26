---
title: Implement gRPC streaming patterns and interceptors for real-time data and observability
impact: HIGH
impactDescription: "gRPC streaming patterns enable real-time data flows while interceptors provide cross-cutting auth and observability"
tags: grpc, streaming, interceptors, bidirectional, auth, retry
---

## gRPC Streaming and Interceptors

**Incorrect -- ignoring stream cancellation:**
```python
# Client may disconnect but server keeps processing
def ListUsers(self, request, context):
    for user in all_users:
        yield self._to_proto(user)  # No cancellation check!
```

**Correct -- server streaming with cancellation check:**
```python
def ListUsers(self, request, context):
    """Server streaming: yield users one by one."""
    for user in self.user_repo.iterate(page_size=request.page_size or 100):
        if not context.is_active():  # Check if client disconnected
            return
        yield self._to_proto(user)
```

**Correct -- bidirectional streaming:**
```python
async def UserUpdates(self, request_iterator, context):
    """Bidirectional: receive updates, yield results."""
    async for request in request_iterator:
        if not context.is_active():
            return
        user = await self.user_repo.update(request.user_id, request.changes)
        yield self._to_proto(user)
```

**Correct -- auth interceptor:**
```python
class AuthInterceptor(grpc.ServerInterceptor):
    def __init__(self, auth_service):
        self.auth_service = auth_service
        self.public_methods = {"/user.v1.UserService/CreateUser"}

    def intercept_service(self, continuation, handler_call_details):
        if handler_call_details.method not in self.public_methods:
            metadata = dict(handler_call_details.invocation_metadata)
            token = metadata.get("authorization", "").replace("Bearer ", "")
            if not token or not self.auth_service.verify(token):
                return grpc.unary_unary_rpc_method_handler(
                    lambda req, ctx: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
                )
        return continuation(handler_call_details)
```

**Correct -- client retry interceptor with exponential backoff:**
```python
class RetryInterceptor(grpc.UnaryUnaryClientInterceptor):
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
        self.retry_codes = {grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED}

    def intercept_unary_unary(self, continuation, client_call_details, request):
        for attempt in range(self.max_retries):
            try:
                return continuation(client_call_details, request)
            except grpc.RpcError as e:
                if e.code() not in self.retry_codes or attempt == self.max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff
```

Key decisions:
- Server streaming: Always check `context.is_active()` before yielding
- Auth: Interceptor with metadata, JWT tokens, public method allowlist
- Retry: Exponential backoff, only retry UNAVAILABLE and DEADLINE_EXCEEDED
- Always close channels to prevent resource leaks
- Never skip deadline/timeout on client calls

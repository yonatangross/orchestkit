# gRPC Error Handling (Python 3.11+ Async)

Status codes, rich error details, and exception mapping.

## gRPC Status Codes

| Code | HTTP | Use Case |
|------|------|----------|
| OK (0) | 200 | Success |
| INVALID_ARGUMENT (3) | 400 | Validation errors |
| NOT_FOUND (5) | 404 | Resource missing |
| ALREADY_EXISTS (6) | 409 | Duplicate |
| PERMISSION_DENIED (7) | 403 | Forbidden |
| UNAUTHENTICATED (16) | 401 | Auth required |
| RESOURCE_EXHAUSTED (8) | 429 | Rate limited |
| INTERNAL (13) | 500 | Server error |
| UNAVAILABLE (14) | 503 | Service down |

## Basic Async Error Handling

```python
async def GetUser(self, request, context: grpc.aio.ServicerContext):
    if not request.user_id:
        await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "user_id required")

    user = await self.repo.get(request.user_id)
    if not user:
        await context.abort(grpc.StatusCode.NOT_FOUND, f"User {request.user_id} not found")

    return self._to_proto(user)
```

## Rich Error Details (google.rpc.Status)

```python
from grpc_status import rpc_status
from google.rpc import status_pb2, error_details_pb2
from google.protobuf import any_pb2

async def abort_with_details(context, code: grpc.StatusCode, message: str, details: list = None):
    status = status_pb2.Status(code=code.value[0], message=message)
    if details:
        for d in details:
            detail_any = any_pb2.Any()
            detail_any.Pack(d)
            status.details.append(detail_any)
    await context.abort_with_status(rpc_status.to_status(status))
```

## Validation Errors

```python
async def CreateUser(self, request, context):
    violations = []
    if not request.email or "@" not in request.email:
        violations.append(error_details_pb2.BadRequest.FieldViolation(
            field="email", description="Valid email required"
        ))
    if len(request.password) < 8:
        violations.append(error_details_pb2.BadRequest.FieldViolation(
            field="password", description="Min 8 characters"
        ))

    if violations:
        await abort_with_details(
            context,
            grpc.StatusCode.INVALID_ARGUMENT,
            "Validation failed",
            [error_details_pb2.BadRequest(field_violations=violations)]
        )
```

## Client Error Parsing

```python
from grpc_status import rpc_status
from google.rpc import error_details_pb2

async def get_user(stub, user_id: str):
    try:
        return await stub.GetUser(pb2.GetUserRequest(user_id=user_id), timeout=5.0)
    except grpc.aio.AioRpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise UserNotFoundError(user_id)

        if e.code() == grpc.StatusCode.INVALID_ARGUMENT:
            status = rpc_status.from_call(e)
            if status:
                for detail in status.details:
                    if detail.Is(error_details_pb2.BadRequest.DESCRIPTOR):
                        bad_req = error_details_pb2.BadRequest()
                        detail.Unpack(bad_req)
                        errors = {v.field: v.description for v in bad_req.field_violations}
                        raise ValidationError(errors)
        raise
```

## Exception Mapping Decorator

```python
from functools import wraps

EXCEPTION_MAP = {
    ValueError: grpc.StatusCode.INVALID_ARGUMENT,
    PermissionError: grpc.StatusCode.PERMISSION_DENIED,
    KeyError: grpc.StatusCode.NOT_FOUND,
}

def grpc_exceptions(func):
    @wraps(func)
    async def wrapper(self, request, context):
        try:
            return await func(self, request, context)
        except grpc.RpcError:
            raise
        except Exception as e:
            code = EXCEPTION_MAP.get(type(e), grpc.StatusCode.INTERNAL)
            await context.abort(code, str(e))
    return wrapper

class UserServiceServicer(pb2_grpc.UserServiceServicer):
    @grpc_exceptions
    async def GetUser(self, request, context):
        return await self.repo.get(request.user_id)  # KeyError -> NOT_FOUND
```

## Rate Limit with Retry-After

```python
from google.protobuf import duration_pb2

async def rate_limit_error(context, retry_after: int = 60):
    retry_info = error_details_pb2.RetryInfo(
        retry_delay=duration_pb2.Duration(seconds=retry_after)
    )
    await abort_with_details(context, grpc.StatusCode.RESOURCE_EXHAUSTED, "Rate limited", [retry_info])
```

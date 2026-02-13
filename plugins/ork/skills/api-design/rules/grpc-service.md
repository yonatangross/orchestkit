---
title: gRPC Service Definition and Implementation
impact: HIGH
impactDescription: "gRPC provides 10x lower latency than REST for internal microservice communication with compile-time type safety"
tags: grpc, protobuf, microservices, rpc, python
---

## gRPC Service Definition and Implementation

**Incorrect -- REST for internal service communication:**
```python
# Using REST for high-frequency internal calls
response = requests.post("http://user-service/api/users",
                         json={"email": email, "name": name})
# High serialization overhead, no compile-time validation, manual error mapping
```

**Correct -- protobuf service definition:**
```protobuf
syntax = "proto3";
package user.v1;

import "google/protobuf/timestamp.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);       // Server streaming
  rpc BulkCreateUsers(stream CreateUserRequest) returns (BulkCreateResponse);  // Client streaming
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
```

**Correct -- async server implementation:**
```python
import grpc.aio
from app.protos import user_service_pb2 as pb2, user_service_pb2_grpc as pb2_grpc

class UserServiceServicer(pb2_grpc.UserServiceServicer):
    async def GetUser(self, request, context):
        user = await self.user_repo.get(request.user_id)
        if not user:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"User {request.user_id} not found")
        return self._to_proto(user)

    async def CreateUser(self, request, context):
        if not request.email or "@" not in request.email:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Invalid email")
        user = await self.user_repo.create(email=request.email, name=request.name)
        return self._to_proto(user)
```

**Correct -- client with timeout and retry:**
```python
class UserServiceClient:
    def __init__(self, host: str = "localhost:50051"):
        self.channel = grpc.insecure_channel(host, options=[
            ("grpc.keepalive_time_ms", 30000),
            ("grpc.keepalive_timeout_ms", 10000),
        ])
        self.stub = pb2_grpc.UserServiceStub(self.channel)

    def get_user(self, user_id: str, timeout: float = 5.0):
        try:
            return self.stub.GetUser(pb2.GetUserRequest(user_id=user_id), timeout=timeout)
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                raise UserNotFoundError(user_id)
            raise
```

Key decisions:
- Proto organization: One service per file, shared messages in common.proto
- Versioning: Package version (user.v1, user.v2), backward compatible
- Always set client-side deadlines (timeout)
- Always include health checks for load balancers
- Use when: Internal microservices, streaming, polyglot, strong typing needed
- Do NOT use when: Public APIs (use REST/GraphQL), simple CRUD, no HTTP/2

# gRPC API Design

## Proto File Structure

```protobuf
syntax = "proto3";

package company.user.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
  rpc WatchUsers(WatchUsersRequest) returns (stream UserEvent);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
  UserRole role = 4;
  google.protobuf.Timestamp created_at = 5;
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_ADMIN = 1;
  USER_ROLE_DEVELOPER = 2;
  USER_ROLE_VIEWER = 3;
}

message GetUserRequest {
  string id = 1;
}

message GetUserResponse {
  User user = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
  int32 total_size = 3;
}
```

## gRPC Status Codes

| Code | HTTP Equivalent | Use Case |
|------|-----------------|----------|
| OK | 200 | Success |
| INVALID_ARGUMENT | 400 | Invalid request |
| NOT_FOUND | 404 | Resource not found |
| ALREADY_EXISTS | 409 | Duplicate |
| PERMISSION_DENIED | 403 | Forbidden |
| UNAUTHENTICATED | 401 | Auth required |
| RESOURCE_EXHAUSTED | 429 | Rate limit |
| INTERNAL | 500 | Server error |
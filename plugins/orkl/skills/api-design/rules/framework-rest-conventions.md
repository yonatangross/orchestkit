---
title: Follow REST conventions for naming, HTTP methods, and status codes consistently
impact: HIGH
impactDescription: "REST conventions form the foundation of API usability — inconsistent naming, wrong HTTP methods, or incorrect status codes confuse consumers and break integrations"
tags: rest, http-methods, status-codes, pagination, naming
---

## REST API Conventions

Standard conventions for RESTful API design covering resource naming, HTTP methods, status codes, and pagination.

**Resource Naming:**

```
# Plural nouns for collections
GET /users
GET /users/123
POST /users

# Hierarchical relationships
GET /users/123/orders          # Orders for specific user
GET /teams/5/members           # Members of specific team
POST /projects/10/tasks        # Create task in project 10

# Kebab-case for multi-word resources
/shopping-carts
/order-items
/user-preferences
```

**HTTP Methods:**

| Method | Purpose | Idempotent | Safe | Example |
|--------|---------|------------|------|---------|
| GET | Retrieve resource(s) | Yes | Yes | `GET /users/123` |
| POST | Create resource | No | No | `POST /users` |
| PUT | Replace entire resource | Yes | No | `PUT /users/123` |
| PATCH | Partial update | No | No | `PATCH /users/123` |
| DELETE | Remove resource | Yes | No | `DELETE /users/123` |

**Status Codes:**

| Code | Name | Use Case |
|------|------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST (include `Location` header) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request syntax |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate/constraint violation |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

**Cursor-Based Pagination (Recommended):**

```python
@router.get("/analyses")
async def list_analyses(
    cursor: str | None = None,
    limit: int = Query(default=20, le=100)
) -> PaginatedResponse:
    results = await repo.get_paginated(cursor=cursor, limit=limit)

    return {
        "data": results,
        "pagination": {
            "next_cursor": encode_cursor(results[-1].id) if results else None,
            "has_more": len(results) == limit
        }
    }
```

**Common Pitfalls:**

| Pitfall | Bad | Good |
|---------|-----|------|
| Verbs in URLs | `POST /createUser` | `POST /users` |
| Inconsistent naming | `/users, /userOrders` | `/users, /orders` |
| Ignoring HTTP methods | `POST /users/123/delete` | `DELETE /users/123` |
| Exposing internals | `/users-table` | `/users` |
| Generic errors | `"Something went wrong"` | `"Email already exists"` |

**Incorrect — Verbs in URLs:**
```python
# RPC-style endpoints
POST /createUser
POST /users/123/delete
GET /getUserOrders?id=123
```

**Correct — REST conventions:**
```python
# Resource-oriented
POST /users
DELETE /users/123
GET /users/123/orders
```

**Key rules:**
- Always use plural nouns for resources
- Use kebab-case for multi-word resource names
- Map CRUD to proper HTTP methods
- Include `Location` header in 201 responses
- Use cursor-based pagination for large datasets

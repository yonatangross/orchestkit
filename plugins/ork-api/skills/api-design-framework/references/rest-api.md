# REST API Design

## Resource Naming Conventions

**Use plural nouns for resources:**
```
GET /users
GET /users/123
GET /users/123/orders
```

**Use hierarchical relationships:**
```
GET /users/123/orders          # Orders for specific user
GET /teams/5/members           # Members of specific team
POST /projects/10/tasks        # Create task in project 10
```

**Use kebab-case for multi-word resources:**
```
/shopping-carts
/order-items
/user-preferences
```

## HTTP Methods

| Method | Purpose | Idempotent | Safe | Example |
|--------|---------|------------|------|---------|
| GET | Retrieve resource(s) | Yes | Yes | `GET /users/123` |
| POST | Create resource | No | No | `POST /users` |
| PUT | Replace entire resource | Yes | No | `PUT /users/123` |
| PATCH | Partial update | No* | No | `PATCH /users/123` |
| DELETE | Remove resource | Yes | No | `DELETE /users/123` |
| HEAD | Metadata only (no body) | Yes | Yes | `HEAD /users/123` |
| OPTIONS | Allowed methods | Yes | Yes | `OPTIONS /users` |

## Status Codes

### Success (2xx)
- **200 OK**: Successful GET, PUT, PATCH, or DELETE
- **201 Created**: Successful POST (include `Location` header)
- **202 Accepted**: Request accepted, processing async
- **204 No Content**: Successful DELETE or PUT with no response body

### Client Errors (4xx)
- **400 Bad Request**: Invalid request body or parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated but not authorized
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity**: Validation failed
- **429 Too Many Requests**: Rate limit exceeded

### Server Errors (5xx)
- **500 Internal Server Error**: Generic server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Temporary unavailability

## Request/Response Formats

**Request Body (POST/PUT/PATCH):**
```json
POST /users
Content-Type: application/json

{
  "email": "jane@example.com",
  "name": "Jane Smith",
  "role": "developer"
}
```

**Success Response:**
```json
HTTP/1.1 201 Created
Location: /users/123

{
  "id": 123,
  "email": "jane@example.com",
  "name": "Jane Smith",
  "created_at": "2025-10-31T10:30:00Z"
}
```

## Pagination

### Cursor-Based (Recommended)
```
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  }
}
```

**Use for**: Large datasets, real-time data, infinite scroll

### Offset-Based
```
GET /users?page=2&per_page=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 487,
    "total_pages": 25
  }
}
```

**Use for**: Small datasets, admin panels, known bounds

## Filtering and Sorting

```
GET /users?status=active&role=developer
GET /users?sort=created_at:desc
GET /users?fields=id,name,email
```

## API Versioning

### URI Versioning (Recommended)
```
/api/v1/users
/api/v2/users
```

### Header Versioning
```
GET /api/users
Accept: application/vnd.company.v2+json
```

## Rate Limiting Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1635724800
```

## Authentication

**Bearer Token (JWT):**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**API Key:**
```
X-API-Key: sk_live_abc123...
```
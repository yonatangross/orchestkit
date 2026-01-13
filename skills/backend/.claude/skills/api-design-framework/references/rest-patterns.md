# RESTful API Design Patterns

Comprehensive guide to RESTful API design patterns including resource modeling, HTTP methods, status codes, versioning, pagination, filtering, and error handling.

## Resource Modeling

### Naming Conventions

**Use plural nouns for collections:**
```
✅ GET /api/v1/analyses
✅ GET /api/v1/artifacts
✅ GET /api/v1/users

❌ GET /api/v1/analysis
❌ GET /api/v1/getArtifact
```

**Hierarchical relationships:**
```
✅ GET /api/v1/analyses/{analysis_id}/artifact
✅ GET /api/v1/teams/{team_id}/members
✅ POST /api/v1/projects/{project_id}/tasks

❌ GET /api/v1/artifact?analysis_id={id}  # Query param for relationship
❌ GET /api/v1/analysis_artifact/{id}      # Flat structure
```

**Use kebab-case for multi-word resources:**
```
✅ /api/v1/shopping-carts
✅ /api/v1/user-preferences
✅ /api/v1/order-items

❌ /api/v1/shoppingCarts  (camelCase)
❌ /api/v1/shopping_carts  (snake_case in URL)
```

### HTTP Methods (CRUD Operations)

| Method | Purpose | Idempotent | Safe | Response | Example |
|--------|---------|------------|------|----------|---------|
| **GET** | Retrieve resource(s) | ✅ | ✅ | 200 OK | `GET /analyses/123` |
| **POST** | Create resource | ❌ | ❌ | 201 Created | `POST /analyses` |
| **PUT** | Replace entire resource | ✅ | ❌ | 200 OK | `PUT /analyses/123` |
| **PATCH** | Partial update | ⚠️ | ❌ | 200 OK | `PATCH /analyses/123` |
| **DELETE** | Remove resource | ✅ | ❌ | 204 No Content | `DELETE /analyses/123` |
| **HEAD** | Metadata only | ✅ | ✅ | 200 OK | `HEAD /analyses/123` |
| **OPTIONS** | Allowed methods | ✅ | ✅ | 200 OK | `OPTIONS /analyses` |

**Idempotency Note**: PATCH can be designed to be idempotent by using absolute values instead of relative operations.

### HTTP Status Codes

#### Success (2xx)

**200 OK** - Successful GET, PUT, PATCH, DELETE with response body
```python
@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: uuid.UUID) -> AnalysisResponse:
    return AnalysisResponse(...)  # 200 OK
```

**201 Created** - Successful POST, include `Location` header
```python
@router.post("/analyses", status_code=status.HTTP_201_CREATED)
async def create_analysis(request: AnalyzeRequest) -> AnalyzeCreateResponse:
    # Include SSE endpoint in response
    return AnalyzeCreateResponse(
        analysis_id=str(analysis_uuid),
        sse_endpoint=f"/api/v1/analyze/{analysis_uuid}/stream"
    )
```

**202 Accepted** - Request accepted, processing asynchronously
```python
@router.post("/long-running-task", status_code=status.HTTP_202_ACCEPTED)
async def start_task() -> TaskStatusResponse:
    # Start background task
    return TaskStatusResponse(
        task_id="...",
        status="pending",
        status_url="/tasks/123/status"
    )
```

**204 No Content** - Successful DELETE or PUT with no response body
```python
@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(analysis_id: uuid.UUID) -> None:
    await repo.delete(analysis_id)
```

#### Client Errors (4xx)

**400 Bad Request** - Invalid request syntax or malformed parameters
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request body is not valid JSON",
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

**401 Unauthorized** - Missing or invalid authentication
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token",
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

**403 Forbidden** - Authenticated but not authorized
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource",
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

**404 Not Found** - Resource doesn't exist
```python
@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: uuid.UUID) -> ArtifactResponse:
    artifact = await repo.get_artifact_by_id(artifact_id)

    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact {artifact_id} not found"
        )
```

**422 Unprocessable Entity** - Validation failed
```python
try:
    content_type = detect_content_type(url_str)
except ContentTypeError as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid URL format: {e!s}"
    ) from e
```

**429 Too Many Requests** - Rate limit exceeded
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703163600

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded. Try again in 1 hour.",
    "retry_after": 3600
  }
}
```

#### Server Errors (5xx)

**500 Internal Server Error** - Generic server error
```python
except Exception as e:
    logger.error(
        "analysis_creation_failed",
        error=str(e),
        exc_info=True
    )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to create analysis record"
    ) from e
```

**502 Bad Gateway** - Upstream service error
**503 Service Unavailable** - Temporary unavailability (maintenance)
**504 Gateway Timeout** - Upstream timeout

## API Versioning

### Strategy 1: URI Versioning (Recommended for Public APIs)

**SkillForge uses this approach:**
```python
# app/core/config.py
API_V1_PREFIX = "/api/v1"

# app/main.py
app.include_router(
    analysis_router,
    prefix=f"{settings.API_V1_PREFIX}/analyze"
)
```

**URL structure:**
```
/api/v1/analyses
/api/v2/analyses  # New version with breaking changes
```

**Pros:**
- Clear and visible in URLs
- Easy to test and debug
- Cache-friendly
- Can route different versions to different servers

**Cons:**
- Verbose URLs
- Need to maintain multiple codebases

### Strategy 2: Header Versioning

```
GET /api/analyses
Accept: application/vnd.skillforge.v2+json
API-Version: v2
```

**Pros:**
- Clean URLs
- RESTful purist approach

**Cons:**
- Not visible in browser
- Harder to test manually
- Need custom headers

### Strategy 3: Query Parameter (Avoid)

```
GET /api/analyses?version=2
```

**Cons:**
- Mixes with business logic parameters
- Can be forgotten
- Not cache-friendly

## Pagination

### Cursor-Based Pagination (Recommended for Large Datasets)

**Best for**: Real-time data, infinite scroll, datasets that change frequently

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

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIzfQ",
    "has_more": true
  }
}
```

**Client usage:**
```javascript
// First page
const page1 = await fetch('/api/v1/analyses?limit=20')
const { data, pagination } = await page1.json()

// Next page
if (pagination.has_more) {
  const page2 = await fetch(`/api/v1/analyses?cursor=${pagination.next_cursor}&limit=20`)
}
```

### Offset-Based Pagination (For Known Bounds)

**Best for**: Admin panels, small datasets, "jump to page N" UX

```python
@router.get("/analyses")
async def list_analyses(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, le=100)
) -> PaginatedResponse:
    offset = (page - 1) * per_page
    results, total = await repo.get_paginated(offset=offset, limit=per_page)

    return {
        "data": results,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    }
```

**Response:**
```json
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

## Filtering and Sorting

### Query Parameter Filtering

```python
@router.get("/analyses")
async def list_analyses(
    status: str | None = None,
    content_type: str | None = None,
    created_after: datetime | None = None,
    created_before: datetime | None = None
) -> list[AnalysisResponse]:
    filters = {}
    if status:
        filters["status"] = status
    if content_type:
        filters["content_type"] = content_type
    # ...

    return await repo.find_all(filters=filters)
```

**Usage:**
```
GET /api/v1/analyses?status=completed&content_type=article
GET /api/v1/analyses?created_after=2025-01-01&created_before=2025-12-31
```

### Sorting

```python
@router.get("/analyses")
async def list_analyses(
    sort: str = Query(default="-created_at")
) -> list[AnalysisResponse]:
    # Parse sort parameter: "-created_at" -> ("created_at", "desc")
    direction = "desc" if sort.startswith("-") else "asc"
    field = sort.lstrip("-")

    return await repo.find_all(
        order_by=field,
        direction=direction
    )
```

**Usage:**
```
GET /api/v1/analyses?sort=-created_at       # Newest first
GET /api/v1/analyses?sort=title              # Alphabetical
GET /api/v1/analyses?sort=-status,title      # Multiple fields
```

### Field Selection (Sparse Fieldsets)

```python
@router.get("/analyses")
async def list_analyses(
    fields: str | None = None
) -> list[dict[str, Any]]:
    selected_fields = fields.split(",") if fields else None
    results = await repo.find_all()

    if selected_fields:
        return [
            {k: v for k, v in item.dict().items() if k in selected_fields}
            for item in results
        ]

    return results
```

**Usage:**
```
GET /api/v1/analyses?fields=id,title,status
```

## Error Response Format

### Standard Error Structure

```python
# app/api/schemas/errors.py
class ErrorDetail(BaseModel):
    field: str
    message: str
    code: str

class ErrorResponse(BaseModel):
    error: dict[str, Any]

    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": [
                        {
                            "field": "url",
                            "message": "Invalid URL format",
                            "code": "INVALID_URL"
                        }
                    ],
                    "timestamp": "2025-12-21T10:30:00Z",
                    "request_id": "req_abc123"
                }
            }
        }
```

### FastAPI Exception Handlers

```python
# app/main.py
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": request.url.path
            }
        }
    )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "code": error["type"]
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": errors,
                "timestamp": datetime.now(UTC).isoformat()
            }
        }
    )
```

## Rate Limiting

### Response Headers

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.get("/analyses")
@limiter.limit("100/minute")
async def list_analyses(request: Request) -> list[AnalysisResponse]:
    # Rate limited to 100 requests per minute
    pass
```

**Response headers:**
```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1703163600
```

**When exceeded:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703163600

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retry_after": 60,
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

## Best Practices

### 1. Always Return Consistent Response Format

```python
# Good: Consistent structure
{
  "data": {...},
  "metadata": {...}
}

# Bad: Inconsistent structure
{...}  # Sometimes flat object
{"results": [...]}  # Sometimes wrapped
```

### 2. Use Pydantic for Request/Response Validation

```python
from pydantic import BaseModel, HttpUrl, Field

class AnalyzeRequest(BaseModel):
    url: HttpUrl
    analysis_id: str | None = None
    skill_level: str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
```

### 3. Include Metadata in Responses

```python
{
  "analysis_id": "123",
  "url": "https://example.com",
  "created_at": "2025-12-21T10:30:00Z",
  "updated_at": "2025-12-21T11:00:00Z"
}
```

### 4. Use OpenAPI Documentation

```python
@router.get(
    "/analyses/{analysis_id}",
    responses={
        404: {"model": ErrorResponse, "description": "Analysis not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Get analysis details",
    description="Retrieve detailed information about a specific analysis including status and artifacts"
)
async def get_analysis(
    analysis_id: Annotated[uuid.UUID, Path(description="Analysis UUID")]
) -> AnalysisResponse:
    ...
```

### 5. Handle Edge Cases

```python
# Empty collections: Return empty array, not null
{"data": []}  # ✅
{"data": null}  # ❌

# Deleted resources: Return 404, not null
# ❌ {"data": null}
# ✅ 404 Not Found

# Null fields: Be explicit
{
  "title": null,  # ✅ Explicitly null
  "description": ""  # ✅ Empty string if required
}
```

## Related Files

- See `templates/openapi-template.yaml` for full OpenAPI specification example
- See `examples/skillforge-api-design.md` for SkillForge-specific patterns
- See SKILL.md for GraphQL and gRPC patterns

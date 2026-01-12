# SkillForge API Design Decisions

Real-world API design decisions from the SkillForge project, documenting endpoint structure, versioning strategy, and architectural choices.

## Project Context

**SkillForge**: Intelligent Learning Integration Platform - Multi-agent system for analyzing technical content.

**Stack**: FastAPI (Python) + React 19 frontend
**API Base**: `http://localhost:8500/api/v1`
**Development Ports**:
- Backend API: `localhost:8500`
- Frontend: `localhost:5173`
- PostgreSQL: `localhost:5437`

## API Structure

### URI Versioning

**Decision**: Use URI-based versioning (`/api/v1/`)

**Location**: `backend/app/core/config.py`
```python
API_V1_PREFIX = "/api/v1"
```

**Rationale**:
- Clear visibility in URLs for debugging
- Easy to route different versions to different handlers
- Frontend can easily target specific API versions
- Cache-friendly (CDNs can cache different versions separately)

**Implementation**: `backend/app/main.py`
```python
from app.core.config import settings

# Include analysis router with versioned prefix
app.include_router(
    analysis_router,
    prefix=f"{settings.API_V1_PREFIX}/analyze"
)

# Include artifact router
app.include_router(
    artifact_router,
    prefix=settings.API_V1_PREFIX
)
```

## Endpoint Design

### Analysis Endpoints

**Location**: `backend/app/api/v1/analysis/endpoints.py`

#### 1. Create Analysis (Async Task Pattern)

```python
POST /api/v1/analyze
Content-Type: application/json

{
  "url": "https://example.com/article",
  "analysis_id": "optional-custom-id",  # Optional
  "skill_level": "beginner"              # Optional: beginner|intermediate|advanced
}
```

**Response**: `201 Created`
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/article",
  "content_type": "article",
  "status": "pending",
  "sse_endpoint": "/api/v1/analyze/550e8400-e29b-41d4-a716-446655440000/stream"
}
```

**Design Decision**: Return immediately with analysis_id + SSE endpoint
- **Why**: Analysis workflow takes 30-120 seconds to complete
- **Pattern**: Async task creation + progress streaming (see SSE section)
- **Client flow**: Create analysis → Connect to SSE endpoint → Receive progress updates

**Implementation**:
```python
@router.post(
    "/analyze",
    status_code=status.HTTP_201_CREATED,
    responses={
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def create_analysis(
    request: AnalyzeRequest,
    fastapi_request: Request,
    analysis_repo: Annotated[IAnalysisRepository, Depends(get_analysis_repository)]
) -> AnalyzeCreateResponse:
    """Create analysis and start workflow asynchronously."""

    # 1. Detect content type
    content_type = detect_content_type(str(request.url))

    # 2. Normalize custom analysis_id if provided (optional)
    analysis_uuid = (
        normalize_analysis_id_to_uuid(request.analysis_id)
        if request.analysis_id
        else None  # Let DB generate UUID v7 via server_default
    )

    # 3. Create Analysis record (status: pending)
    # PostgreSQL 18 generates UUID v7 via server_default=text("uuidv7()")
    created_analysis = await analysis_repo.create_analysis(
        analysis_id=analysis_uuid,  # None → DB generates UUID v7
        url=url_str,
        content_type=content_type,
        status="pending"
    )
    analysis_uuid = cast("AnalysisID", created_analysis.id)

    # 4. Start workflow asynchronously (fire-and-forget)
    task = asyncio.create_task(
        run_workflow_task(analysis_uuid, url_str, request.skill_level)
    )
    background_tasks = fastapi_request.app.state.background_tasks
    background_tasks.add(task)
    task.add_done_callback(partial(_handle_task_completion, background_tasks=background_tasks))

    # 5. Return immediately with SSE endpoint
    sse_endpoint = f"{settings.API_V1_PREFIX}/analyze/{analysis_uuid}/stream"

    return AnalyzeCreateResponse(
        analysis_id=str(analysis_uuid),
        url=url_str,
        content_type=content_type,
        status="pending",
        sse_endpoint=sse_endpoint
    )
```

#### 2. Get Analysis Status

```python
GET /api/v1/analyze/{analysis_id}
```

**Response**: `200 OK`
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/article",
  "content_type": "article",
  "status": "completed",
  "title": "Understanding React Server Components",
  "artifact_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2025-12-21T10:30:00Z",
  "updated_at": "2025-12-21T10:32:45Z"
}
```

**Design Decision**: Return latest artifact_id in status response
- **Why**: Frontend needs artifact_id to fetch results
- **Alternative considered**: Separate endpoint for artifact lookup (rejected: extra round trip)

#### 3. Stream Analysis Progress (SSE)

```python
GET /api/v1/analyze/{analysis_id}/stream
Accept: text/event-stream
```

**Response**: Server-Sent Events stream
```
event: progress
data: {"type":"progress","stage":"extraction","status":"running","timestamp":"2025-12-21T10:30:15Z"}

event: progress
data: {"type":"progress","stage":"extraction","status":"complete","word_count":5234}

event: progress
data: {"type":"progress","stage":"analysis","status":"running","agent":"tech_comparator"}

event: complete
data: {"type":"complete","stage":"artifact_generation","timestamp":"2025-12-21T10:32:45Z"}
```

**Design Decision**: Use SSE instead of WebSockets
- **Why**: Unidirectional (server→client) is sufficient for progress updates
- **Benefit**: Simpler client code (native EventSource API), automatic reconnection
- **Trade-off**: No client→server messaging (not needed for this use case)

See `references/sse-deep-dive.md` in `streaming-api-patterns` skill for details.

### Artifact Endpoints

**Location**: `backend/app/api/v1/analysis/artifacts.py`

#### 1. Get Artifact by Analysis

```python
GET /api/v1/analyze/{analysis_id}/artifact
```

**Response**: `200 OK`
```json
{
  "artifact_id": "660e8400-e29b-41d4-a716-446655440001",
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "markdown_content": "# Understanding React Server Components\n\n...",
  "artifact_metadata": {
    "word_count": 5234,
    "section_count": 8
  },
  "trace_id": "trace_abc123",
  "created_at": "2025-12-21T10:32:45Z"
}
```

**Design Decision**: Hierarchical URL (`/analyze/{id}/artifact`)
- **Why**: Expresses relationship: "artifact belongs to analysis"
- **Alternative considered**: `/artifacts?analysis_id={id}` (rejected: less RESTful)

#### 2. Get Artifact by ID

```python
GET /api/v1/artifacts/{artifact_id}
```

**Response**: Same as above

**Design Decision**: Provide both hierarchical AND direct ID lookup
- **Why**: Support different frontend access patterns
- **Use case 1**: After analysis complete → use hierarchical endpoint
- **Use case 2**: Direct link to artifact → use ID endpoint

#### 3. Download Artifact

```python
GET /api/v1/artifacts/{artifact_id}/download
```

**Response**: `200 OK` (file download)
```
Content-Type: text/markdown
Content-Disposition: attachment; filename="understanding-react-server-components-550e8400.md"

# Understanding React Server Components
...
```

**Design Decision**: Separate download endpoint with different response type
- **Why**: Different headers (Content-Disposition) and analytics (download_count)
- **Benefit**: Clean separation of view vs. download use cases

**Implementation**:
```python
@router.get("/artifacts/{artifact_id}/download", response_class=Response)
async def download_artifact(
    artifact_id: uuid.UUID,
    repo: Annotated[IArtifactRepository, Depends(get_artifact_repository)]
) -> Response:
    # Get artifact with analysis (for title)
    result = await repo.get_artifact_with_analysis(artifact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Artifact not found")

    artifact, analysis = result

    # Extract title from analysis metadata
    title = None
    if analysis.extraction_metadata:
        title = analysis.extraction_metadata.get("title")

    # Generate filename: "article-title-uuid.md"
    filename = generate_filename(title, str(artifact.analysis_id))

    # Increment download_count for analytics
    await repo.increment_download_count(artifact_id)

    # Return with download headers
    return Response(
        content=artifact.markdown_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
```

### Health Check Endpoint

**Location**: `backend/app/api/v1/health.py`

```python
GET /api/v1/health
```

**Response**: `200 OK`
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "database": {
    "status": "connected"
  }
}
```

**Design Decision**: Include database connectivity check
- **Why**: Kubernetes readiness/liveness probes need to verify DB connection
- **Timeout**: 5 seconds (configurable via DB_TIMEOUT constant)
- **Error response**: Still returns 200 OK, but with `database.status: "disconnected"`

## Error Handling

### Standardized Error Format

**Location**: `backend/app/api/schemas/errors.py`

```python
class ErrorResponse(BaseModel):
    error: dict[str, Any]

    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "timestamp": "2025-12-21T10:30:00Z"
                }
            }
        }
```

### Example Error Responses

**404 Not Found**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Artifact 660e8400-e29b-41d4-a716-446655440001 not found",
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

**422 Validation Error**:
```python
try:
    content_type = detect_content_type(url_str)
except ContentTypeError as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid URL format: {e!s}"
    ) from e
```

Response:
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Invalid URL format: Must be a valid HTTP/HTTPS URL",
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

## URL Normalization

### UUID Analysis IDs

**Decision**: Always use UUIDs for analysis_id (not string slugs)

**Normalization logic**: `backend/app/core/utils.py`
```python
def normalize_analysis_id_to_uuid(analysis_id: str) -> uuid.UUID:
    """Normalize analysis_id to UUID format.

    Supports:
    - Full UUID: "550e8400-e29b-41d4-a716-446655440000"
    - Short form: "550e8400" (first 8 chars)
    """
    # Try parsing as full UUID
    try:
        return uuid.UUID(analysis_id)
    except ValueError:
        pass

    # Try short form (8 chars)
    if len(analysis_id) == 8:
        try:
            # Pad to full UUID format
            full_uuid = f"{analysis_id}-0000-0000-0000-000000000000"
            return uuid.UUID(full_uuid)
        except ValueError:
            pass

    raise ValueError(f"Invalid analysis_id format: {analysis_id}")
```

**Benefit**: Allows short URLs while maintaining UUID uniqueness

## Repository Pattern

### Dependency Injection

**Pattern**: Use FastAPI Depends() for repository injection

```python
from typing import Annotated

@router.get("/artifacts/{artifact_id}")
async def get_artifact(
    artifact_id: Annotated[uuid.UUID, Path(description="Artifact UUID")],
    repo: Annotated[IArtifactRepository, Depends(get_artifact_repository)]
) -> ArtifactMetadataResponse:
    artifact = await repo.get_artifact_by_id(artifact_id)
    ...
```

**Benefits**:
- Easy testing (mock repository)
- Clean separation of concerns
- Type-safe with Annotated

## API Documentation

### OpenAPI Spec

**Auto-generated**: Available at `/docs` (Swagger UI) and `/redoc` (ReDoc)

**Custom documentation**:
```python
@router.get(
    "/analyze/{analysis_id}/stream",
    responses={
        404: {"model": ErrorResponse, "description": "Analysis not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def stream_analysis_progress_endpoint(
    analysis_id: Annotated[uuid.UUID, Path(description="Analysis UUID")],
    request: Request
):
    """Stream real-time analysis progress via Server-Sent Events (SSE).

    See app.api.v1.sse_handler.stream_analysis_progress for full documentation.
    """
    return await stream_analysis_progress_handler(analysis_id, request)
```

## Design Principles

### 1. Immediate Response for Long Operations

**Pattern**: Create → Return ID + Progress URL
- **Example**: POST /analyze → Returns analysis_id + sse_endpoint
- **Why**: Prevents timeout on long-running operations
- **Client UX**: Show loading state with progress updates

### 2. Include Related Resource URLs

**Pattern**: Include navigation URLs in responses
```json
{
  "analysis_id": "123",
  "sse_endpoint": "/api/v1/analyze/123/stream",  ← Progress URL
  "artifact_id": "456"                            ← Related resource
}
```

**Benefit**: Frontend doesn't need to construct URLs

### 3. Hierarchical URLs for Relationships

**Pattern**: `/parent/{id}/child` for 1:1 or 1:many relationships
- `/analyze/{analysis_id}/artifact` - Analysis has one latest artifact
- `/teams/{team_id}/members` - Team has many members

**Benefit**: Clear relationship modeling

### 4. UUID Path Parameters

**Pattern**: Use typed UUID path parameters
```python
analysis_id: Annotated[uuid.UUID, Path(description="Analysis UUID")]
```

**Benefit**: Automatic validation (400 if not valid UUID)

### 5. Repository + Dependency Injection

**Pattern**: Abstract database access behind repository interface
```python
class IArtifactRepository(Protocol):
    async def get_artifact_by_id(self, artifact_id: uuid.UUID) -> Artifact | None: ...

def get_artifact_repository() -> IArtifactRepository:
    return ArtifactRepository(get_db_session())
```

**Benefits**:
- Easy to mock for testing
- Clean architecture
- Database-agnostic API layer

## Related Files

- **SSE Implementation**: `backend/app/api/v1/analysis/sse_handler.py`
- **Event Broadcaster**: `backend/app/shared/services/messaging/broadcaster.py`
- **Error Schemas**: `backend/app/api/schemas/errors.py`
- **Config**: `backend/app/core/config.py`
- **API Schemas**: `backend/app/domains/analysis/schemas/api.py`

## References

- See `references/rest-patterns.md` for general REST patterns
- See `streaming-api-patterns` skill for SSE implementation details
- See `templates/openapi-template.yaml` for OpenAPI specification template

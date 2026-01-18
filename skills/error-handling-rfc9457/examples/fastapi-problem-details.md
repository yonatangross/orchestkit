# FastAPI Problem Details Implementation

Complete example implementing RFC 9457 Problem Details in FastAPI.

## Problem Detail Schema

```python
# app/core/exceptions.py
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Any


class ProblemDetail(BaseModel):
    """RFC 9457 Problem Details response schema."""

    type: str = Field(
        default="about:blank",
        description="URI reference identifying the problem type",
    )
    title: str = Field(
        description="Short, human-readable summary",
    )
    status: int = Field(
        description="HTTP status code",
    )
    detail: str | None = Field(
        default=None,
        description="Human-readable explanation specific to this occurrence",
    )
    instance: str | None = Field(
        default=None,
        description="URI reference identifying the specific occurrence",
    )
    # Common extensions
    trace_id: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_schema_extra = {
            "example": {
                "type": "https://api.skillforge.dev/problems/validation-error",
                "title": "Validation Error",
                "status": 422,
                "detail": "The url field is required",
                "instance": "/api/v1/analyses",
                "trace_id": "abc123",
                "timestamp": "2026-01-07T10:30:00Z",
            }
        }


class ValidationProblem(ProblemDetail):
    """Problem detail with validation errors."""

    errors: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of validation errors",
    )


class RateLimitProblem(ProblemDetail):
    """Problem detail for rate limiting."""

    retry_after: int = Field(description="Seconds until retry is allowed")
    limit: int = Field(description="Request limit")
    window: str = Field(description="Time window for limit")
```

## Custom Exception Classes

```python
# app/core/exceptions.py
from fastapi import HTTPException


class ProblemException(Exception):
    """Base exception that renders as RFC 9457 Problem Detail."""

    def __init__(
        self,
        status_code: int,
        problem_type: str,
        title: str,
        detail: str | None = None,
        instance: str | None = None,
        **extensions,
    ):
        self.status_code = status_code
        self.problem_type = problem_type
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extensions = extensions

    def to_problem_detail(self, trace_id: str | None = None) -> dict:
        """Convert to Problem Detail dict."""
        problem = {
            "type": self.problem_type,
            "title": self.title,
            "status": self.status_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if self.detail:
            problem["detail"] = self.detail
        if self.instance:
            problem["instance"] = self.instance
        if trace_id:
            problem["trace_id"] = trace_id
        problem.update(self.extensions)
        return problem


class ResourceNotFoundError(ProblemException):
    """Resource not found error."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
    ):
        super().__init__(
            status_code=404,
            problem_type="https://api.skillforge.dev/problems/resource-not-found",
            title="Resource Not Found",
            detail=f"{resource_type} with ID '{resource_id}' was not found",
            resource_type=resource_type,
            resource_id=resource_id,
        )


class ValidationError(ProblemException):
    """Validation error with field-level details."""

    def __init__(
        self,
        errors: list[dict],
        detail: str = "One or more fields failed validation",
    ):
        super().__init__(
            status_code=422,
            problem_type="https://api.skillforge.dev/problems/validation-error",
            title="Validation Error",
            detail=detail,
            errors=errors,
        )


class ConflictError(ProblemException):
    """Resource conflict error."""

    def __init__(
        self,
        detail: str,
        conflicting_field: str | None = None,
    ):
        super().__init__(
            status_code=409,
            problem_type="https://api.skillforge.dev/problems/resource-conflict",
            title="Resource Conflict",
            detail=detail,
            conflicting_field=conflicting_field,
        )


class RateLimitError(ProblemException):
    """Rate limit exceeded error."""

    def __init__(
        self,
        retry_after: int,
        limit: int,
        window: str = "1 minute",
    ):
        super().__init__(
            status_code=429,
            problem_type="https://api.skillforge.dev/problems/rate-limit-exceeded",
            title="Rate Limit Exceeded",
            detail=f"You have exceeded {limit} requests per {window}",
            retry_after=retry_after,
            limit=limit,
            window=window,
        )


class AuthenticationError(ProblemException):
    """Authentication required error."""

    def __init__(self, detail: str = "Authentication is required"):
        super().__init__(
            status_code=401,
            problem_type="https://api.skillforge.dev/problems/authentication-required",
            title="Authentication Required",
            detail=detail,
        )


class AuthorizationError(ProblemException):
    """Insufficient permissions error."""

    def __init__(
        self,
        detail: str = "You don't have permission to access this resource",
        required_permission: str | None = None,
    ):
        super().__init__(
            status_code=403,
            problem_type="https://api.skillforge.dev/problems/insufficient-permissions",
            title="Insufficient Permissions",
            detail=detail,
            required_permission=required_permission,
        )
```

## Exception Handlers

```python
# app/core/exception_handlers.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import ProblemException


def setup_exception_handlers(app: FastAPI):
    """Register all exception handlers."""

    @app.exception_handler(ProblemException)
    async def problem_exception_handler(
        request: Request,
        exc: ProblemException,
    ) -> JSONResponse:
        """Handle custom problem exceptions."""
        trace_id = getattr(request.state, "request_id", None)
        exc.instance = request.url.path

        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_problem_detail(trace_id),
            media_type="application/problem+json",
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(x) for x in error["loc"][1:]),  # Skip 'body'
                "code": error["type"],
                "message": error["msg"],
            })

        trace_id = getattr(request.state, "request_id", None)

        return JSONResponse(
            status_code=422,
            content={
                "type": "https://api.skillforge.dev/problems/validation-error",
                "title": "Validation Error",
                "status": 422,
                "detail": "Request validation failed",
                "instance": request.url.path,
                "trace_id": trace_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "errors": errors,
            },
            media_type="application/problem+json",
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request,
        exc: IntegrityError,
    ) -> JSONResponse:
        """Handle database integrity errors."""
        trace_id = getattr(request.state, "request_id", None)

        # Parse constraint name from error
        detail = "A database constraint was violated"
        if "unique" in str(exc.orig).lower():
            detail = "A resource with this value already exists"

        return JSONResponse(
            status_code=409,
            content={
                "type": "https://api.skillforge.dev/problems/resource-conflict",
                "title": "Resource Conflict",
                "status": 409,
                "detail": detail,
                "instance": request.url.path,
                "trace_id": trace_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        """Handle unexpected exceptions."""
        import structlog
        logger = structlog.get_logger()

        trace_id = getattr(request.state, "request_id", None)

        # Log the full error
        logger.exception(
            "unhandled_exception",
            trace_id=trace_id,
            path=request.url.path,
            error=str(exc),
        )

        return JSONResponse(
            status_code=500,
            content={
                "type": "https://api.skillforge.dev/problems/internal-error",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "An unexpected error occurred. Please try again later.",
                "instance": request.url.path,
                "trace_id": trace_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "support_url": "https://support.skillforge.dev",
            },
            media_type="application/problem+json",
        )
```

## Usage in Routes

```python
# app/api/v1/routes/analyses.py
from fastapi import APIRouter, Depends
from app.core.exceptions import ResourceNotFoundError, ValidationError

router = APIRouter()

@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    service: AnalysisService = Depends(get_analysis_service),
):
    """Get analysis by ID."""
    analysis = await service.get_by_id(analysis_id)

    if not analysis:
        raise ResourceNotFoundError(
            resource_type="Analysis",
            resource_id=analysis_id,
        )

    return AnalysisResponse.from_domain(analysis)


@router.post("/analyses")
async def create_analysis(
    request: AnalyzeRequest,
    service: AnalysisService = Depends(get_analysis_service),
):
    """Create a new analysis."""
    # Custom validation beyond Pydantic
    if not is_valid_url(str(request.url)):
        raise ValidationError(
            errors=[
                {
                    "field": "url",
                    "code": "invalid_url",
                    "message": "URL is not accessible or returns an error",
                }
            ]
        )

    return await service.create(request)
```

## OpenAPI Documentation

```python
# app/api/v1/routes/analyses.py
from fastapi import APIRouter
from app.core.exceptions import ProblemDetail, ValidationProblem

router = APIRouter()

@router.get(
    "/analyses/{analysis_id}",
    responses={
        404: {
            "model": ProblemDetail,
            "description": "Analysis not found",
            "content": {
                "application/problem+json": {
                    "example": {
                        "type": "https://api.skillforge.dev/problems/resource-not-found",
                        "title": "Resource Not Found",
                        "status": 404,
                        "detail": "Analysis with ID 'abc123' was not found",
                    }
                }
            },
        },
        500: {
            "model": ProblemDetail,
            "description": "Internal server error",
        },
    },
)
async def get_analysis(analysis_id: str):
    ...
```

## Testing

```python
# tests/test_error_handling.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_not_found_returns_problem_detail(client: AsyncClient):
    response = await client.get("/api/v1/analyses/nonexistent")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"

    problem = response.json()
    assert problem["type"] == "https://api.skillforge.dev/problems/resource-not-found"
    assert problem["status"] == 404
    assert "Analysis" in problem["detail"]

@pytest.mark.asyncio
async def test_validation_error_includes_field_errors(client: AsyncClient):
    response = await client.post("/api/v1/analyses", json={"url": "not-a-url"})

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"

    problem = response.json()
    assert problem["type"] == "https://api.skillforge.dev/problems/validation-error"
    assert "errors" in problem
    assert any(e["field"] == "url" for e in problem["errors"])
```

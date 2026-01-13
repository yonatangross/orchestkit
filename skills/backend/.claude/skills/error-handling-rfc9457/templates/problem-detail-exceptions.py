"""
RFC 9457 Problem Detail Exceptions Template

Production-ready exception handling for FastAPI with:
- RFC 9457 compliant responses
- Field-level validation errors
- Trace ID correlation
- Structured logging
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field


# ============================================================================
# Problem Detail Schema
# ============================================================================

class ProblemDetail(BaseModel):
    """RFC 9457 Problem Details response."""

    type: str = Field(
        default="about:blank",
        description="URI reference identifying the problem type",
    )
    title: str = Field(description="Short, human-readable summary")
    status: int = Field(description="HTTP status code")
    detail: str | None = Field(
        default=None,
        description="Human-readable explanation",
    )
    instance: str | None = Field(
        default=None,
        description="URI reference to the specific occurrence",
    )
    trace_id: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class FieldError(BaseModel):
    """Individual field validation error."""

    field: str
    code: str
    message: str


class ValidationProblem(ProblemDetail):
    """Problem with validation errors."""

    errors: list[FieldError] = Field(default_factory=list)


# ============================================================================
# Problem Type Registry
# ============================================================================

class ProblemType:
    """Registry of problem type URIs."""

    BASE = "https://api.example.com/problems"

    VALIDATION_ERROR = f"{BASE}/validation-error"
    RESOURCE_NOT_FOUND = f"{BASE}/resource-not-found"
    RESOURCE_CONFLICT = f"{BASE}/resource-conflict"
    AUTHENTICATION_REQUIRED = f"{BASE}/authentication-required"
    INSUFFICIENT_PERMISSIONS = f"{BASE}/insufficient-permissions"
    RATE_LIMIT_EXCEEDED = f"{BASE}/rate-limit-exceeded"
    INTERNAL_ERROR = f"{BASE}/internal-error"
    SERVICE_UNAVAILABLE = f"{BASE}/service-unavailable"


# ============================================================================
# Base Exception
# ============================================================================

@dataclass
class ProblemException(Exception):
    """Base exception that renders as RFC 9457 Problem Detail."""

    status_code: int
    problem_type: str
    title: str
    detail: str | None = None
    instance: str | None = None
    extensions: dict[str, Any] = field(default_factory=dict)

    def to_dict(self, trace_id: str | None = None) -> dict[str, Any]:
        """Convert to Problem Detail dictionary."""
        result = {
            "type": self.problem_type,
            "title": self.title,
            "status": self.status_code,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if self.detail:
            result["detail"] = self.detail
        if self.instance:
            result["instance"] = self.instance
        if trace_id:
            result["trace_id"] = trace_id

        result.update(self.extensions)
        return result

    def to_response(
        self,
        trace_id: str | None = None,
    ) -> JSONResponse:
        """Convert to FastAPI JSONResponse."""
        headers = {}

        # Add Retry-After for rate limiting
        if "retry_after" in self.extensions:
            headers["Retry-After"] = str(self.extensions["retry_after"])

        return JSONResponse(
            status_code=self.status_code,
            content=self.to_dict(trace_id),
            media_type="application/problem+json",
            headers=headers or None,
        )


# ============================================================================
# Specific Exceptions
# ============================================================================

class ResourceNotFoundError(ProblemException):
    """Resource was not found."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
    ):
        super().__init__(
            status_code=404,
            problem_type=ProblemType.RESOURCE_NOT_FOUND,
            title="Resource Not Found",
            detail=f"{resource_type} with ID '{resource_id}' was not found",
            extensions={
                "resource_type": resource_type,
                "resource_id": resource_id,
            },
        )


class ValidationError(ProblemException):
    """Request validation failed."""

    def __init__(
        self,
        errors: list[dict[str, str]],
        detail: str = "One or more fields failed validation",
    ):
        super().__init__(
            status_code=422,
            problem_type=ProblemType.VALIDATION_ERROR,
            title="Validation Error",
            detail=detail,
            extensions={"errors": errors},
        )

    @classmethod
    def from_field(
        cls,
        field_name: str,
        code: str,
        message: str,
    ) -> "ValidationError":
        """Create from a single field error."""
        return cls(
            errors=[{"field": field_name, "code": code, "message": message}]
        )


class ConflictError(ProblemException):
    """Resource conflict (duplicate, constraint violation)."""

    def __init__(
        self,
        detail: str,
        conflicting_field: str | None = None,
    ):
        extensions = {}
        if conflicting_field:
            extensions["conflicting_field"] = conflicting_field

        super().__init__(
            status_code=409,
            problem_type=ProblemType.RESOURCE_CONFLICT,
            title="Resource Conflict",
            detail=detail,
            extensions=extensions,
        )


class AuthenticationError(ProblemException):
    """Authentication required."""

    def __init__(
        self,
        detail: str = "Authentication is required to access this resource",
    ):
        super().__init__(
            status_code=401,
            problem_type=ProblemType.AUTHENTICATION_REQUIRED,
            title="Authentication Required",
            detail=detail,
        )


class AuthorizationError(ProblemException):
    """Insufficient permissions."""

    def __init__(
        self,
        detail: str = "You don't have permission to access this resource",
        required_permission: str | None = None,
    ):
        extensions = {}
        if required_permission:
            extensions["required_permission"] = required_permission

        super().__init__(
            status_code=403,
            problem_type=ProblemType.INSUFFICIENT_PERMISSIONS,
            title="Insufficient Permissions",
            detail=detail,
            extensions=extensions,
        )


class RateLimitError(ProblemException):
    """Rate limit exceeded."""

    def __init__(
        self,
        retry_after: int,
        limit: int,
        window: str = "minute",
    ):
        super().__init__(
            status_code=429,
            problem_type=ProblemType.RATE_LIMIT_EXCEEDED,
            title="Rate Limit Exceeded",
            detail=f"You have exceeded {limit} requests per {window}",
            extensions={
                "retry_after": retry_after,
                "limit": limit,
                "window": window,
            },
        )


class ServiceUnavailableError(ProblemException):
    """Service temporarily unavailable."""

    def __init__(
        self,
        detail: str = "The service is temporarily unavailable",
        retry_after: int | None = None,
    ):
        extensions = {}
        if retry_after:
            extensions["retry_after"] = retry_after

        super().__init__(
            status_code=503,
            problem_type=ProblemType.SERVICE_UNAVAILABLE,
            title="Service Unavailable",
            detail=detail,
            extensions=extensions,
        )


# ============================================================================
# Exception Handlers
# ============================================================================

def setup_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on FastAPI app."""

    @app.exception_handler(ProblemException)
    async def problem_exception_handler(
        request: Request,
        exc: ProblemException,
    ) -> JSONResponse:
        """Handle ProblemException subclasses."""
        exc.instance = request.url.path
        trace_id = getattr(request.state, "request_id", None)
        return exc.to_response(trace_id)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        errors = []
        for error in exc.errors():
            # Skip 'body' prefix in location
            loc = error["loc"]
            field_path = ".".join(str(x) for x in loc[1:]) if len(loc) > 1 else str(loc[0])

            errors.append({
                "field": field_path,
                "code": error["type"],
                "message": error["msg"],
            })

        trace_id = getattr(request.state, "request_id", None)

        return JSONResponse(
            status_code=422,
            content={
                "type": ProblemType.VALIDATION_ERROR,
                "title": "Validation Error",
                "status": 422,
                "detail": "Request validation failed",
                "instance": request.url.path,
                "trace_id": trace_id,
                "timestamp": datetime.utcnow().isoformat(),
                "errors": errors,
            },
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        """Handle unexpected exceptions."""
        import logging

        logger = logging.getLogger(__name__)
        trace_id = getattr(request.state, "request_id", None)

        logger.exception(
            "Unhandled exception",
            extra={
                "trace_id": trace_id,
                "path": request.url.path,
                "method": request.method,
            },
        )

        return JSONResponse(
            status_code=500,
            content={
                "type": ProblemType.INTERNAL_ERROR,
                "title": "Internal Server Error",
                "status": 500,
                "detail": "An unexpected error occurred. Please try again later.",
                "instance": request.url.path,
                "trace_id": trace_id,
                "timestamp": datetime.utcnow().isoformat(),
            },
            media_type="application/problem+json",
        )


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    from fastapi import FastAPI

    app = FastAPI()
    setup_exception_handlers(app)

    @app.get("/users/{user_id}")
    async def get_user(user_id: str):
        # Simulate not found
        raise ResourceNotFoundError(
            resource_type="User",
            resource_id=user_id,
        )

    @app.post("/users")
    async def create_user():
        # Simulate validation error
        raise ValidationError.from_field(
            field_name="email",
            code="invalid_format",
            message="Invalid email format",
        )

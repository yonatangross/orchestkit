"""Official Python client for the OrchestKit public docs API.

Read-only, unauthenticated, rate-limited (120 req/min per IP per endpoint).
Errors use RFC 9457 Problem Details. Every response carries IETF RateLimit headers.
"""

from __future__ import annotations

from .client import (
    DEFAULT_BASE_URL,
    ApiError,
    Client,
    Problem,
    RateLimit,
    SearchHit,
    ask,
    create_client,
    read_doc,
    search,
)

__version__ = "0.1.0"

__all__ = [
    "DEFAULT_BASE_URL",
    "ApiError",
    "Client",
    "Problem",
    "RateLimit",
    "SearchHit",
    "__version__",
    "ask",
    "create_client",
    "read_doc",
    "search",
]

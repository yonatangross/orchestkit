---
name: api-design
license: MIT
compatibility: "Claude Code 2.1.34+."
description: API design patterns for REST/GraphQL framework design, versioning strategies, and RFC 9457 error handling. Use when designing API endpoints, choosing versioning schemes, implementing Problem Details errors, or building OpenAPI specifications.
tags: [api-design, rest, graphql, versioning, error-handling, rfc9457, openapi, problem-details]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# API Design

Comprehensive API design patterns covering REST/GraphQL framework design, versioning strategies, and RFC 9457 error handling. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [API Framework](#api-framework) | 3 | HIGH | REST conventions, resource modeling, OpenAPI specifications |
| [Versioning](#versioning) | 3 | HIGH | URL path versioning, header versioning, deprecation/sunset policies |
| [Error Handling](#error-handling) | 3 | HIGH | RFC 9457 Problem Details, validation errors, error type registries |
| [GraphQL](#graphql) | 2 | HIGH | Strawberry code-first, DataLoader, permissions, subscriptions |
| [gRPC](#grpc) | 2 | HIGH | Protobuf services, streaming, interceptors, retry |
| [Streaming](#streaming) | 2 | HIGH | SSE endpoints, WebSocket bidirectional, async generators |

| [Integrations](#integrations) | 2 | HIGH | Messaging platforms (WhatsApp, Telegram), Payload CMS patterns |

**Total: 17 rules across 7 categories**

## API Framework

REST and GraphQL API design conventions for consistent, developer-friendly APIs.

| Rule | File | Key Pattern |
|------|------|-------------|
| REST Conventions | `rules/framework-rest-conventions.md` | Plural nouns, HTTP methods, status codes, pagination |
| Resource Modeling | `rules/framework-resource-modeling.md` | Hierarchical URLs, filtering, sorting, field selection |
| OpenAPI | `rules/framework-openapi.md` | OpenAPI 3.1 specs, documentation, schema definitions |

## Versioning

Strategies for API evolution without breaking clients.

| Rule | File | Key Pattern |
|------|------|-------------|
| URL Path | `rules/versioning-url-path.md` | `/api/v1/` prefix routing, version-specific schemas |
| Header | `rules/versioning-header.md` | `X-API-Version` header, content negotiation |
| Deprecation | `rules/versioning-deprecation.md` | Sunset headers, lifecycle management, breaking change policy |

## Error Handling

RFC 9457 Problem Details for machine-readable, standardized error responses.

| Rule | File | Key Pattern |
|------|------|-------------|
| Problem Details | `rules/errors-problem-details.md` | RFC 9457 schema, `application/problem+json`, exception classes |
| Validation | `rules/errors-validation.md` | Field-level errors, Pydantic integration, 422 responses |
| Error Catalog | `rules/errors-error-catalog.md` | Problem type registry, error type URIs, client handling |

## GraphQL

Strawberry GraphQL code-first schema with type-safe resolvers and FastAPI integration.

| Rule | File | Key Pattern |
|------|------|-------------|
| Schema Design | `rules/graphql-strawberry.md` | Type-safe schema, DataLoader, union errors, Private fields |
| Patterns & Auth | `rules/graphql-schema.md` | Permission classes, FastAPI integration, subscriptions |

## gRPC

High-performance gRPC for internal microservice communication.

| Rule | File | Key Pattern |
|------|------|-------------|
| Service Definition | `rules/grpc-service.md` | Protobuf, async server, client timeout, code generation |
| Streaming & Interceptors | `rules/grpc-streaming.md` | Server/bidirectional streaming, auth, retry backoff |

## Streaming

Real-time data streaming with SSE, WebSockets, and proper cleanup.

| Rule | File | Key Pattern |
|------|------|-------------|
| SSE | `rules/streaming-sse.md` | SSE endpoints, LLM streaming, reconnection, keepalive |
| WebSocket | `rules/streaming-websocket.md` | Bidirectional, heartbeat, aclosing(), backpressure |

## Integrations

Messaging platform integrations and headless CMS patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Messaging Platforms | `rules/messaging-integrations.md` | WhatsApp WAHA, Telegram Bot API, webhook security |
| Payload CMS | `rules/payload-cms.md` | Payload 3.0 collections, access control, CMS selection |

## Quick Start Example

```python
# REST endpoint with versioning and RFC 9457 errors
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/api/v1/users/{user_id}")
async def get_user(user_id: str, service: UserService = Depends()):
    user = await service.get_user(user_id)
    if not user:
        raise NotFoundProblem(
            resource="User",
            resource_id=user_id,
        )
    return UserResponseV1(id=user.id, name=user.full_name)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Versioning strategy | URL path (`/api/v1/`) for public APIs |
| Resource naming | Plural nouns, kebab-case |
| Pagination | Cursor-based for large datasets |
| Error format | RFC 9457 Problem Details with `application/problem+json` |
| Error type URI | Your API domain + `/problems/` prefix |
| Support window | Current + 1 previous version |
| Deprecation notice | 3 months minimum before sunset |
| Sunset period | 6 months after deprecation |
| GraphQL schema | Code-first with Strawberry types |
| N+1 prevention | DataLoader for all nested resolvers |
| GraphQL auth | Permission classes (context-based) |
| gRPC proto | One service per file, shared common.proto |
| gRPC streaming | Server stream for lists, bidirectional for real-time |
| SSE keepalive | Every 30 seconds |
| WebSocket heartbeat | ping-pong every 30 seconds |
| Async generator cleanup | aclosing() for all external resources |

## Common Mistakes

1. Verbs in URLs (`POST /createUser` instead of `POST /users`)
2. Inconsistent error formats across endpoints
3. Breaking contracts without version bump
4. Plain text error responses instead of Problem Details
5. Sunsetting versions without deprecation headers
6. Exposing internal details (stack traces, DB errors) in errors
7. Missing `Content-Type: application/problem+json` on error responses
8. Supporting too many concurrent API versions (max 2-3)
9. Caching without considering version isolation

## Evaluations

See `test-cases.json` for 9 test cases across all categories.

## Related Skills

- `fastapi-advanced` - FastAPI-specific implementation patterns
- `rate-limiting` - Advanced rate limiting implementations and algorithms
- `observability-monitoring` - Version usage metrics and error tracking
- `input-validation` - Validation patterns beyond API error handling
- `streaming-api-patterns` - SSE and WebSocket patterns for real-time APIs

## Capability Details

### rest-design
**Keywords:** rest, restful, http, endpoint, route, path, resource, CRUD
**Solves:**
- How do I design RESTful APIs?
- REST endpoint patterns and conventions
- HTTP methods and status codes

### graphql-design
**Keywords:** graphql, schema, query, mutation, connection, relay
**Solves:**
- How do I design GraphQL APIs?
- Schema design best practices
- Connection pattern for pagination

### endpoint-design
**Keywords:** endpoint, route, path, resource, CRUD, openapi
**Solves:**
- How do I structure API endpoints?
- What's the best URL pattern for this resource?
- RESTful endpoint naming conventions

### url-versioning
**Keywords:** url version, path version, /v1/, /v2/
**Solves:**
- How to version REST APIs?
- URL-based API versioning

### header-versioning
**Keywords:** header version, X-API-Version, content negotiation
**Solves:**
- Clean URL versioning
- Header-based API version

### deprecation
**Keywords:** deprecation, sunset, version lifecycle, backward compatible
**Solves:**
- How to deprecate API versions?
- Version sunset policy
- Breaking vs non-breaking changes

### problem-details
**Keywords:** problem details, RFC 9457, RFC 7807, structured error, application/problem+json
**Solves:**
- How to standardize API error responses?
- What format for API errors?

### validation-errors
**Keywords:** validation, field error, 422, unprocessable, pydantic
**Solves:**
- How to handle validation errors in APIs?
- Field-level error responses

### error-registry
**Keywords:** error registry, problem types, error catalog, error codes
**Solves:**
- How to document all API errors?
- Error type management

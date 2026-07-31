---
name: api-design
license: MIT
compatibility: "Claude Code 2.1.220+."
description: API contract design for REST and GraphQL, covering resource shape, URL and header versioning with deprecation windows, RFC 9457 Problem Details error handling, and OpenAPI specs. Use when specifying the wire contract an endpoint exposes, choosing a versioning scheme, or standardizing error response bodies across services. Framework-agnostic protocol layer, not runtime implementation.
tags: [api-design, rest, graphql, versioning, error-handling, rfc9457, openapi, problem-details]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["**/routes/**", "**/api/**", "**/endpoints/**", "openapi.*", "swagger.*"]
---

# API Design

Comprehensive API design patterns covering REST/GraphQL framework design, versioning strategies, and RFC 9457 error handling. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [API Framework](#api-framework) | 3 | HIGH | REST conventions, resource modeling, OpenAPI specifications |
| [Versioning](#versioning) | 2 | HIGH | URL path versioning, header versioning; deprecation windows are house policy in `references/ork-delta.md` |
| [Error Handling](#error-handling) | 1 | HIGH | Agent-facing RFC 9457 extensions; base spec and FastAPI wiring are upstream |
| [GraphQL](#graphql) | 2 | HIGH | Strawberry code-first, DataLoader, permissions, subscriptions |
| [gRPC](#grpc) | 2 | HIGH | Protobuf services, streaming, interceptors, retry |
| [Streaming](#streaming) | 2 | HIGH | SSE endpoints, WebSocket bidirectional, async generators |
| [Integrations](#integrations) | 2 | HIGH | Messaging platforms (WhatsApp, Telegram), Payload CMS patterns |

**Total: 14 rules across 7 categories.** House decisions rescued from thinned files live in `references/ork-delta.md`; vendor and spec material is linked, not restated (see [Upstream coverage](#upstream-coverage-do-not-restate)).

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

Deprecation and sunset: the house window (3 months notice, 6 months sunset, current + 1 supported) is in `references/ork-delta.md`; header mechanics are upstream (RFC 8594, RFC 9745).

## Error Handling

RFC 9457 Problem Details for machine-readable, standardized error responses.

| Rule | File | Key Pattern |
|------|------|-------------|
| Agent-Facing Errors | `rules/errors-agent-facing.md` | Agent extensions: `retryable`, `error_category`, content negotiation, token efficiency |

The RFC 9457 base format, FastAPI exception-handler wiring, and Pydantic 422 mapping are upstream (see [Upstream coverage](#upstream-coverage-do-not-restate)). The house pieces survive here: problem type URI convention and typed exception vocabulary in `references/ork-delta.md`, full working implementation in `examples/fastapi-problem-details.md`.

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

## Upstream coverage (do not restate)

Topics removed in the 2026-07-31 wrap-plus-delta thinning. Consult the first-party source; only the ork delta (house policy, scars, working config) belongs in this skill.

| Topic | First-party source |
|-------|--------------------|
| RFC 9457 Problem Details spec (members, media type, `about:blank`, client parsing) | https://www.rfc-editor.org/rfc/rfc9457.html |
| FastAPI exception handlers, Pydantic validation errors (422), error catalog boilerplate | https://fastapi.tiangolo.com/tutorial/handling-errors/ |
| API versioning strategy tutorials and FastAPI versioned-router walkthroughs | https://fastapi.tiangolo.com/tutorial/bigger-applications/ |
| Deprecation and Sunset header mechanics | https://www.rfc-editor.org/rfc/rfc8594.html and https://www.rfc-editor.org/rfc/rfc9745.html |
| Generic REST reference (methods, status codes, pagination shapes, auth headers) | https://www.rfc-editor.org/rfc/rfc9110.html and https://developer.mozilla.org/en-US/docs/Web/HTTP |
| OpenAPI 3.1 spec authoring (template survives in `assets/openapi-template.yaml`) | https://spec.openapis.org/oas/v3.1.0 |
| gRPC proto style, service definition, status codes | https://grpc.io/docs/ and https://protobuf.dev/programming-guides/style/ |
| Payload CMS collection design, field types, access control | https://payloadcms.com/docs |
| Frontend API consumption (Zod boundary validation, ky, TanStack Query) | https://zod.dev and https://tanstack.com/query/latest/docs |
| API design / error handling / versioning review checklists | Derivable from the specs above; no checklist restatement kept |

## Evaluations

See `test-cases.json` for 13 test cases across all categories.

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

### agent-facing-errors
**Keywords:** agent error, AI agent, retryable, retry_after, error_category, content negotiation, accept header, token efficient, machine readable
**Solves:**
- How to design error responses for AI agent consumers?
- How to reduce token cost of error responses?
- How to enable deterministic agent error handling?
- Content negotiation for agents vs browsers vs LLMs

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

---
title: API Design Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. API Framework (framework) — HIGH — 3 rules

REST and GraphQL API design conventions for consistent, developer-friendly APIs.

- `framework-rest-conventions.md` — Plural nouns, HTTP methods, status codes, pagination patterns
- `framework-resource-modeling.md` — Hierarchical URLs, filtering, sorting, field selection
- `framework-openapi.md` — OpenAPI 3.1 specifications, documentation, schema definitions

## 2. Versioning (versioning) — HIGH — 3 rules

Strategies for API evolution without breaking clients.

- `versioning-url-path.md` — URL path versioning with /api/v1/ prefix routing and version-specific schemas
- `versioning-header.md` — X-API-Version header and content negotiation approaches
- `versioning-deprecation.md` — Sunset headers, lifecycle management, breaking vs non-breaking changes

## 3. Error Handling (errors) — HIGH — 3 rules

RFC 9457 Problem Details for machine-readable, standardized error responses.

- `errors-problem-details.md` — RFC 9457 schema, application/problem+json, ProblemException base class
- `errors-validation.md` — Field-level validation errors, Pydantic integration, 422 responses
- `errors-error-catalog.md` — Problem type registry, error type URIs, client handling patterns

## 4. GraphQL (graphql) — HIGH — 2 rules

Strawberry GraphQL code-first schema, DataLoader, subscriptions, and FastAPI integration.

- `graphql-strawberry.md` — Type-safe schema, DataLoader N+1 prevention, union error handling, Private fields
- `graphql-schema.md` — Permission classes, FastAPI integration, subscriptions, Redis PubSub

## 5. gRPC (grpc) — HIGH — 2 rules

gRPC service definition, streaming patterns, and interceptors for microservice communication.

- `grpc-service.md` — Protobuf definition, async server, client with timeout, code generation
- `grpc-streaming.md` — Server/bidirectional streaming, auth interceptor, retry with backoff

## 6. Streaming (streaming) — HIGH — 2 rules

Real-time data streaming with SSE, WebSockets, and async generator cleanup.

- `streaming-sse.md` — SSE endpoints, LLM token streaming, reconnection with exponential backoff
- `streaming-websocket.md` — WebSocket bidirectional, heartbeat, aclosing() for async generators

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

## 2. Versioning (versioning), HIGH, 2 rules

Strategies for API evolution without breaking clients. Deprecation window policy lives in `references/ork-delta.md` (house decision); Sunset/Deprecation header mechanics are upstream (RFC 8594, RFC 9745).

- `versioning-url-path.md`: URL path versioning with /api/v1/ prefix routing and version-specific schemas
- `versioning-header.md`: X-API-Version header and content negotiation approaches

## 3. Error Handling (errors), HIGH, 1 rule

Agent-facing RFC 9457 extensions (OrchestKit house guidance, #1067). Base spec and FastAPI wiring are upstream; house URI convention and typed exceptions are in `references/ork-delta.md`, full implementation in `examples/fastapi-problem-details.md`.

- `errors-agent-facing.md`: retryable/error_category extensions, content negotiation, token budget

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

## 7. Integrations (integration) — HIGH — 2 rules

Messaging platform and CMS integration patterns.

- `messaging-integrations.md` — WhatsApp WAHA, Telegram Bot API, webhook security, idempotency
- `payload-cms.md` — Payload 3.0 collections, access control, hooks, CMS selection (Payload vs Sanity)

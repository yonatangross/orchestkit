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

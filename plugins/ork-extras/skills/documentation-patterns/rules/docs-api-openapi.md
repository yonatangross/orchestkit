---
title: Document REST APIs using OpenAPI 3.1 with schemas, examples, and error responses
impact: HIGH
impactDescription: "Undocumented APIs cause integration failures, support burden, and inconsistent client implementations"
tags: [openapi, api-docs, rest, swagger, rfc-9457]
---

## API Documentation with OpenAPI 3.1

OpenAPI specs are the single source of truth for REST APIs. They enable code generation, validation, and interactive documentation.

**Incorrect -- undocumented API with no contract:**
```yaml
# No spec, just a comment in code:
# POST /users - creates a user
# Returns user object or error
```

**Correct -- complete OpenAPI 3.1 specification:**
```yaml
openapi: 3.1.0
info:
  title: User Service API
  version: 1.2.0
  description: |
    Manage user accounts. Requires Bearer token authentication.
    Rate limit: 100 requests/minute per API key.

servers:
  - url: https://api.example.com/v1
    description: Production

paths:
  /users:
    post:
      operationId: createUser
      summary: Create a new user account
      description: |
        Creates a user and sends a verification email.
        Returns 409 if email already registered.
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
            example:
              email: "alice@example.com"
              name: "Alice Smith"
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '409':
          description: Email already registered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        '422':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'

components:
  schemas:
    User:
      type: object
      required: [id, email, name, createdAt]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        createdAt:
          type: string
          format: date-time

    ProblemDetail:
      type: object
      description: RFC 9457 Problem Details
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri
```

**Key rules:**
- Every endpoint needs `operationId`, `summary`, `description`, and `tags`
- Define reusable schemas in `components/schemas` -- never inline complex objects
- Document ALL error responses (4xx, 5xx) with RFC 9457 Problem Details format
- Include `example` values for request bodies and responses
- Add authentication info in `info.description` and `components/securitySchemes`
- Version the API in the URL path (`/v1/`) and in `info.version`
- Rate limits and pagination patterns belong in `info.description`

**API doc checklist:**
- [ ] All endpoints have operationId, summary, and description
- [ ] Request/response schemas defined with required fields marked
- [ ] Error responses use RFC 9457 Problem Details
- [ ] Authentication and rate limits documented
- [ ] Examples provided for every request and response

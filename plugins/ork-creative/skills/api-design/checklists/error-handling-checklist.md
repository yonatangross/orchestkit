# Error Handling Implementation Checklist

## RFC 9457 Compliance

### Response Format

- [ ] All error responses use `application/problem+json` media type
- [ ] All responses include required fields:
  - [ ] `type` - URI reference for problem type
  - [ ] `status` - HTTP status code
- [ ] All responses include recommended fields:
  - [ ] `title` - Human-readable summary
  - [ ] `detail` - Specific error description
  - [ ] `instance` - Request path that caused error

### Problem Type URIs

- [ ] Define problem type registry (documented URIs)
- [ ] Each problem type has documentation at its URI
- [ ] URIs are stable (won't change)
- [ ] Using `about:blank` for generic HTTP errors

### Standard Problem Types

Define these common error types:

- [ ] `validation-error` (422) - Request validation failed
- [ ] `resource-not-found` (404) - Resource doesn't exist
- [ ] `resource-conflict` (409) - Duplicate or constraint violation
- [ ] `authentication-required` (401) - Missing/invalid credentials
- [ ] `insufficient-permissions` (403) - Not authorized
- [ ] `rate-limit-exceeded` (429) - Too many requests
- [ ] `internal-error` (500) - Unexpected server error

## Exception Handling

### Custom Exceptions

- [ ] Create base `ProblemException` class
- [ ] Create specific exception classes:
  - [ ] `ResourceNotFoundError`
  - [ ] `ValidationError`
  - [ ] `ConflictError`
  - [ ] `AuthenticationError`
  - [ ] `AuthorizationError`
  - [ ] `RateLimitError`

### Exception Handlers

- [ ] Register handler for `ProblemException`
- [ ] Register handler for `RequestValidationError` (Pydantic)
- [ ] Register handler for `IntegrityError` (SQLAlchemy)
- [ ] Register catch-all handler for `Exception`
- [ ] All handlers return `application/problem+json`

## Validation Errors

- [ ] Include field-level error details
- [ ] Use consistent error structure:
  ```json
  {
    "errors": [
      {"field": "email", "code": "invalid_format", "message": "..."}
    ]
  }
  ```
- [ ] Map Pydantic error types to user-friendly codes
- [ ] Include all validation errors, not just first

## Observability

### Logging

- [ ] Log all 5xx errors with full stack trace
- [ ] Log 4xx errors at warning level
- [ ] Include trace ID in all error logs
- [ ] Include request context (path, method, user)

### Trace IDs

- [ ] Generate unique trace ID per request
- [ ] Include trace ID in error responses
- [ ] Include trace ID in logs
- [ ] Pass trace ID through middleware

### Monitoring

- [ ] Track error rates by type
- [ ] Track error rates by endpoint
- [ ] Alert on error rate spikes
- [ ] Alert on 5xx errors

## Security

### Information Disclosure

- [ ] Never expose stack traces in production
- [ ] Never expose database errors to clients
- [ ] Never expose internal service details
- [ ] Sanitize error messages

### Consistent Responses

- [ ] Return 404 for missing resources (not 403)
- [ ] Return 401 before 403 (auth before authz)
- [ ] Don't leak existence of resources via errors

## Documentation

### OpenAPI

- [ ] Document all error responses in OpenAPI
- [ ] Include example error responses
- [ ] Document all problem types
- [ ] Include error schemas

### API Docs

- [ ] Document error response format
- [ ] Document common error codes
- [ ] Document retry strategies
- [ ] Provide error handling examples

## Testing

### Unit Tests

- [ ] Test each exception class
- [ ] Test problem detail serialization
- [ ] Test exception handlers

### Integration Tests

- [ ] Test 404 returns problem detail
- [ ] Test 422 includes field errors
- [ ] Test 401/403 responses
- [ ] Test 429 includes retry-after
- [ ] Test 500 doesn't leak details

### Error Scenarios

- [ ] Test invalid request body
- [ ] Test missing required fields
- [ ] Test invalid field values
- [ ] Test resource not found
- [ ] Test duplicate resource
- [ ] Test missing authentication
- [ ] Test insufficient permissions
- [ ] Test rate limit exceeded

## Client Handling

Document recommended client handling:

```python
# Python example
async def handle_api_error(response):
    if response.headers.get("content-type") == "application/problem+json":
        problem = await response.json()

        if problem["type"].endswith("rate-limit-exceeded"):
            await asyncio.sleep(problem["retry_after"])
            return await retry_request()

        if problem["type"].endswith("validation-error"):
            for error in problem.get("errors", []):
                display_field_error(error["field"], error["message"])

        raise APIError(problem)
```

## Quick Reference

| Status | Type Suffix | When to Use |
|--------|-------------|-------------|
| 400 | `bad-request` | Malformed request |
| 401 | `authentication-required` | Missing/invalid auth |
| 403 | `insufficient-permissions` | Not authorized |
| 404 | `resource-not-found` | Resource doesn't exist |
| 409 | `resource-conflict` | Duplicate/constraint |
| 422 | `validation-error` | Invalid field values |
| 429 | `rate-limit-exceeded` | Too many requests |
| 500 | `internal-error` | Unexpected error |
| 503 | `service-unavailable` | Temporary outage |

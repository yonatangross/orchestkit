# API Versioning Implementation Checklist

## Planning

### Strategy Selection

- [ ] Choose versioning strategy:
  - [ ] **URL Path** (`/api/v1/`) - Recommended for public APIs
  - [ ] **Header** (`X-API-Version: 1`) - For internal APIs
  - [ ] **Query Param** (`?version=1`) - Avoid if possible
  - [ ] **Content Type** (`Accept: application/vnd.api.v1+json`) - For strict REST

### Version Policy

- [ ] Define what constitutes a breaking change:
  - [ ] Removing endpoints
  - [ ] Removing/renaming fields
  - [ ] Changing field types
  - [ ] Changing authentication
  - [ ] Changing error format

- [ ] Define deprecation policy:
  - [ ] Minimum deprecation period (e.g., 6 months)
  - [ ] Communication channels for deprecation notices
  - [ ] Migration guide requirements

## Implementation

### Directory Structure

- [ ] Create versioned directory structure:
  ```
  app/api/
  ├── v1/
  │   ├── routes/
  │   └── schemas/
  └── v2/
      ├── routes/
      └── schemas/
  ```

### Router Setup

- [ ] Create version-specific routers:
  ```python
  app.include_router(v1_router, prefix="/api/v1")
  app.include_router(v2_router, prefix="/api/v2")
  ```

- [ ] Configure OpenAPI tags per version
- [ ] Set up version-specific docs endpoints

### Schema Management

- [ ] Create version-specific schemas
- [ ] Use inheritance for common fields
- [ ] Document schema changes between versions

### Service Layer

- [ ] Keep services version-agnostic
- [ ] Use adapters to convert domain → version-specific response
- [ ] Avoid version logic in service layer

## Deprecation

### Headers

- [ ] Add deprecation headers to deprecated versions:
  ```python
  response.headers["Deprecation"] = "true"
  response.headers["Sunset"] = "Sat, 31 Dec 2025 23:59:59 GMT"
  response.headers["Link"] = '</api/v2/users>; rel="successor-version"'
  ```

### Response Warnings

- [ ] Include deprecation info in response body (optional):
  ```json
  {
    "_deprecation": {
      "message": "This version is deprecated",
      "sunset_date": "2025-12-31",
      "migration_guide": "https://docs.api.com/migration"
    }
  }
  ```

### Communication

- [ ] Email notification to API consumers
- [ ] Update API documentation with deprecation notice
- [ ] Add banner to developer portal
- [ ] Track usage of deprecated versions

## Documentation

### OpenAPI/Swagger

- [ ] Document all versions in OpenAPI
- [ ] Include deprecation status in docs
- [ ] Provide version comparison
- [ ] Link to migration guides

### Changelog

- [ ] Maintain changelog per version
- [ ] Document breaking changes clearly
- [ ] Include migration instructions
- [ ] Date each change

### Migration Guides

- [ ] Create migration guide for each major version:
  - [ ] List all breaking changes
  - [ ] Provide before/after examples
  - [ ] Include code snippets
  - [ ] Explain rationale for changes

## Monitoring

### Usage Tracking

- [ ] Track requests per version
- [ ] Monitor deprecated version usage
- [ ] Alert on high deprecated version traffic
- [ ] Dashboard for version metrics

### Client Identification

- [ ] Track which clients use which versions
- [ ] Reach out to heavy deprecated version users
- [ ] Provide migration assistance

## Testing

### Version-Specific Tests

- [ ] Test each version independently
- [ ] Verify correct fields in each version
- [ ] Test deprecation headers
- [ ] Test error responses per version

### Compatibility Tests

- [ ] Ensure v1 clients work with v1 API
- [ ] Verify v2 doesn't break v1
- [ ] Test header-based version selection
- [ ] Test default version behavior

### Migration Tests

- [ ] Test that migrated clients work with new version
- [ ] Verify data compatibility
- [ ] Test edge cases during transition

## Sunset Process

### Pre-Sunset (6+ months before)

- [ ] Announce deprecation
- [ ] Add deprecation headers
- [ ] Update documentation
- [ ] Contact major API consumers

### Active Deprecation (3-6 months before)

- [ ] Increase warning frequency
- [ ] Offer migration support
- [ ] Track migration progress
- [ ] Send reminder emails

### Final Warning (1 month before)

- [ ] Final warning to remaining users
- [ ] Prepare for increased support
- [ ] Plan sunset date announcement

### Sunset

- [ ] Remove deprecated version
- [ ] Return 410 Gone for old endpoints
- [ ] Keep redirect to migration docs
- [ ] Monitor for issues

## Quick Reference

| Action | When |
|--------|------|
| Start with v1 | Always, even if no plans for v2 |
| Create v2 | Breaking changes needed |
| Deprecate v1 | 6+ months before sunset |
| Sunset v1 | After deprecation period |

## Common Mistakes

- [ ] **Not versioning from start**: Always start with `/api/v1`
- [ ] **Breaking v1 silently**: Always create new version for breaks
- [ ] **Too many versions**: Consolidate when possible
- [ ] **No deprecation period**: Give adequate migration time
- [ ] **Version in domain layer**: Keep versions in API layer only
- [ ] **Inconsistent versioning**: Use same strategy everywhere

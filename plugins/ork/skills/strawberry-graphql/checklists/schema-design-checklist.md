# GraphQL Schema Design Checklist

Best practices for designing type-safe, performant GraphQL schemas with Strawberry.

## Schema Structure

### Types

- [ ] Use `strawberry.ID` for all entity identifiers (opaque, base64-encoded)
- [ ] Mark optional fields with `| None` (Python 3.10+) or `Optional[T]`
- [ ] Use `strawberry.Private[T]` for internal fields not exposed in schema
- [ ] Create enums for fixed value sets (`@strawberry.enum`)
- [ ] Use descriptive type names matching domain language

### Input Types

- [ ] Separate input types from output types (`CreateUserInput` vs `User`)
- [ ] Make update inputs partial (all fields optional with defaults)
- [ ] Use `@strawberry.input` decorator for mutation inputs
- [ ] Include validation constraints in field descriptions
- [ ] Group related inputs (e.g., `PaginationInput`, `FilterInput`)

### Pagination

- [ ] Implement Relay-style cursor pagination for lists
- [ ] Include `PageInfo` with `hasNextPage`, `hasPreviousPage`, cursors
- [ ] Return `totalCount` for UI pagination controls
- [ ] Use `first`/`after` for forward pagination
- [ ] Use `last`/`before` for backward pagination (if needed)

### Connections Pattern

```
Connection
  |-- edges: [Edge]
  |     |-- cursor: String
  |     |-- node: T
  |-- pageInfo: PageInfo
  |-- totalCount: Int
```

- [ ] Edge wraps node with cursor
- [ ] PageInfo contains navigation metadata
- [ ] Support filtering alongside pagination

## Naming Conventions

### Types

- [ ] PascalCase for type names: `User`, `OrderItem`, `PageInfo`
- [ ] Suffix input types with `Input`: `CreateUserInput`, `UpdatePostInput`
- [ ] Suffix connection types with `Connection`: `UserConnection`
- [ ] Suffix edge types with `Edge`: `UserEdge`

### Fields

- [ ] camelCase for field names: `createdAt`, `firstName`, `isActive`
- [ ] Boolean fields start with `is`, `has`, `can`: `isActive`, `hasAccess`
- [ ] Use verbs for computed fields: `canEdit`, `shouldNotify`

### Queries

- [ ] Singular for single item: `user(id: ID!): User`
- [ ] Plural for lists: `users(...): UserConnection`
- [ ] Action verbs for computed queries: `searchUsers`, `findByEmail`

### Mutations

- [ ] Verb + noun format: `createUser`, `updatePost`, `deleteComment`
- [ ] Use present tense: `create` not `created`
- [ ] Return affected entity or result type

## Field Design

### Arguments

- [ ] Required arguments use `!` in schema (non-optional in Python)
- [ ] Optional arguments have sensible defaults
- [ ] Document allowed values in field descriptions
- [ ] Group related arguments into input types

### Descriptions

- [ ] Add descriptions to all types (shows in GraphiQL)
- [ ] Document field arguments
- [ ] Include examples in descriptions where helpful
- [ ] Note any rate limits or restrictions

### Nullability

- [ ] Default to nullable (GraphQL convention)
- [ ] Mark required fields as non-null only when guaranteed
- [ ] Handle null in resolvers gracefully
- [ ] Document nullability semantics

## Error Handling

### Query Errors

- [ ] Return `null` for not-found entities in queries
- [ ] Throw exceptions for authorization errors
- [ ] Use descriptive error messages

### Mutation Errors

- [ ] Use union types for mutation results
- [ ] Include `Success` and `Error` variants
- [ ] Return field-level validation errors
- [ ] Include error codes for client handling

```python
CreateUserResult = strawberry.union(
    "CreateUserResult",
    [CreateUserSuccess, MutationError]
)
```

### Error Structure

- [ ] `message`: Human-readable description
- [ ] `code`: Machine-readable error code (VALIDATION_ERROR, NOT_FOUND)
- [ ] `field`: Which field caused the error (for validation)

## Performance

### N+1 Prevention

- [ ] Use DataLoader for all nested resolvers
- [ ] Batch database queries by parent IDs
- [ ] Cache within request scope (DataLoader default)
- [ ] Monitor query patterns for N+1 issues

### Query Complexity

- [ ] Set max query depth limit (default: 10)
- [ ] Set max complexity limit
- [ ] Add cost directives to expensive fields
- [ ] Document expensive operations

### Pagination Limits

- [ ] Enforce max page size (e.g., `first` <= 100)
- [ ] Default to reasonable page size (e.g., 20)
- [ ] Validate pagination arguments

## Security

### Authentication

- [ ] Access current user via context (`info.context.current_user_id`)
- [ ] Protect sensitive queries/mutations with `@strawberry.field(permission_classes=[...])`
- [ ] Validate JWT/session in context getter

### Authorization

- [ ] Implement permission classes for role-based access
- [ ] Check resource ownership in resolvers
- [ ] Hide unauthorized fields (return null or throw)
- [ ] Audit sensitive operations

### Input Validation

- [ ] Validate all input fields
- [ ] Sanitize string inputs (prevent XSS)
- [ ] Limit string lengths
- [ ] Validate email formats, URLs, etc.

### Rate Limiting

- [ ] Apply rate limits to mutations
- [ ] Track by user ID or IP
- [ ] Document rate limits in schema

## Federation (Multi-Service)

### Entity Design

- [ ] Mark shared types with `@strawberry.federation.type(keys=["id"])`
- [ ] Implement `resolve_reference` for federated types
- [ ] Use `extend=True` for types defined elsewhere
- [ ] Mark external fields with `@strawberry.federation.field(external=True)`

### Service Boundaries

- [ ] Each service owns its core types
- [ ] Extend types from other services when needed
- [ ] Minimize cross-service dependencies
- [ ] Document service ownership

## Documentation

### Schema Documentation

- [ ] Add descriptions to all types
- [ ] Document deprecated fields with migration path
- [ ] Include examples in complex field descriptions
- [ ] Generate SDL for external documentation

### GraphiQL/Playground

- [ ] Enable GraphiQL in development
- [ ] Disable in production or require auth
- [ ] Include example queries in documentation

## Testing

### Unit Tests

- [ ] Test resolver logic independently
- [ ] Mock DataLoaders and services
- [ ] Test permission classes
- [ ] Test input validation

### Integration Tests

- [ ] Test full query execution
- [ ] Test mutations with database
- [ ] Test subscriptions (if applicable)
- [ ] Test error scenarios

### Schema Tests

- [ ] Validate schema is valid SDL
- [ ] Check for breaking changes in CI
- [ ] Test pagination edge cases
- [ ] Test nullability handling

## Code Organization

### File Structure

```
graphql/
  types/
    user.py
    post.py
    common.py  # PageInfo, connections
  resolvers/
    query.py
    mutation.py
    subscription.py
  loaders/
    user_loader.py
    post_loader.py
  permissions/
    auth.py
  schema.py  # Combines all into schema
```

### Imports

- [ ] Avoid circular imports (use `TYPE_CHECKING`)
- [ ] Group related types in modules
- [ ] Export public types from `__init__.py`

## Review Checklist

Before deploying schema changes:

- [ ] All new fields have descriptions
- [ ] Breaking changes are versioned or deprecated first
- [ ] DataLoaders added for new nested resolvers
- [ ] Permissions applied to sensitive fields
- [ ] Input validation implemented
- [ ] Tests cover new functionality
- [ ] Documentation updated

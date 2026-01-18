# GraphQL Production Checklist

Pre-deployment checklist for Strawberry GraphQL APIs.

## Schema Design

- [ ] All types have clear descriptions
- [ ] Input types use `@strawberry.input` decorator
- [ ] Nullable fields explicitly marked with `| None`
- [ ] IDs use `strawberry.ID` type (opaque, encoded)
- [ ] Pagination uses Relay connection pattern
- [ ] Private fields use `Private[T]` annotation

## Performance

- [ ] DataLoaders for all nested resolvers
- [ ] No N+1 queries (verify with query logging)
- [ ] Query depth limiting configured
- [ ] Query complexity limiting configured
- [ ] Response size limits set
- [ ] Timeout configured for long-running queries

## Security

- [ ] Authentication via JWT or session
- [ ] Permission classes on sensitive fields
- [ ] Rate limiting on mutations
- [ ] Input validation on all inputs
- [ ] No sensitive data in error messages
- [ ] Introspection disabled in production
- [ ] CORS configured correctly

## Error Handling

- [ ] Union types for mutation results
- [ ] Structured error codes (not just messages)
- [ ] Error logging extension configured
- [ ] No stack traces in production errors
- [ ] Validation errors include field names

## Subscriptions

- [ ] Redis PubSub for horizontal scaling
- [ ] WebSocket authentication implemented
- [ ] Connection lifecycle handled (cleanup)
- [ ] Heartbeat/keepalive configured
- [ ] Subscription authorization checked

## Federation (if applicable)

- [ ] Entity keys defined correctly
- [ ] `resolve_reference` implemented
- [ ] External fields marked correctly
- [ ] Schema composition tested
- [ ] Gateway health checks configured

## Testing

- [ ] Unit tests for resolvers
- [ ] Integration tests for queries/mutations
- [ ] DataLoader batching verified
- [ ] Permission tests for protected fields
- [ ] Error case tests

## Monitoring

- [ ] Query execution metrics
- [ ] Error rate tracking
- [ ] Resolver timing metrics
- [ ] DataLoader batch size monitoring
- [ ] Subscription connection count

## Documentation

- [ ] GraphiQL/Playground available (dev only)
- [ ] Schema exported and versioned
- [ ] Breaking changes documented
- [ ] Example queries provided

## Deployment

- [ ] Health check endpoint
- [ ] Graceful shutdown handling
- [ ] Connection pool sizing verified
- [ ] Memory limits appropriate
- [ ] Load testing completed

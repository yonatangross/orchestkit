# CQRS Adoption Checklist

A decision framework for when to adopt CQRS (Command Query Responsibility Segregation) and how to implement it incrementally.

## Pre-Adoption Assessment

### Should You Adopt CQRS?

Answer these questions to determine if CQRS is right for your project:

#### Strong Indicators FOR CQRS

- [ ] **Read/Write Ratio > 10:1** - Reads significantly outnumber writes
- [ ] **Complex Query Requirements** - Need different view representations of the same data
- [ ] **Scaling Asymmetry** - Read and write workloads need to scale independently
- [ ] **Team Size > 3** - Can dedicate resources to increased complexity
- [ ] **Event Sourcing Planned** - Already planning or using event sourcing
- [ ] **Audit Requirements** - Need complete history of all changes
- [ ] **Microservices Architecture** - Building distributed systems with eventual consistency
- [ ] **Multiple Read Stores** - Need SQL, Elasticsearch, cache, etc. for different query patterns

#### Strong Indicators AGAINST CQRS

- [ ] **Simple CRUD** - Basic create, read, update, delete operations
- [ ] **Strong Consistency Required Everywhere** - Cannot tolerate eventual consistency
- [ ] **Small Team** - Less than 3 developers
- [ ] **MVP/Prototype Stage** - Need to iterate quickly
- [ ] **Single Read Model Sufficient** - One database serves all query needs
- [ ] **Low Traffic** - Under 100 requests/second
- [ ] **Simple Domain** - No complex business rules

### Scoring

- **6+ Strong FOR indicators**: CQRS recommended
- **3-5 Strong FOR indicators**: Consider CQRS for specific bounded contexts
- **0-2 Strong FOR indicators**: Likely overkill, use simple CRUD
- **3+ Strong AGAINST indicators**: Do NOT use CQRS

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)

#### Command Infrastructure

- [ ] Define base `Command` class with metadata (command_id, timestamp, user_id)
- [ ] Create `CommandHandler` abstract base class
- [ ] Implement `CommandBus` with handler registration
- [ ] Add logging middleware for command tracing
- [ ] Add validation middleware for business rule pre-checks
- [ ] Set up command-specific exception hierarchy

#### Query Infrastructure

- [ ] Define base `Query` class
- [ ] Create `QueryHandler` abstract base class
- [ ] Implement `QueryBus` with handler registration
- [ ] Define pagination support (offset and cursor-based)
- [ ] Create `PaginatedResult` and `CursorPaginatedResult` types

#### Testing

- [ ] Unit tests for CommandBus dispatch
- [ ] Unit tests for QueryBus dispatch
- [ ] Integration test for middleware pipeline

### Phase 2: First Aggregate (Week 2-3)

#### Write Model

- [ ] Design first aggregate (e.g., Order)
- [ ] Define domain events for aggregate (OrderCreated, OrderUpdated, etc.)
- [ ] Implement command handlers for aggregate
- [ ] Add aggregate repository with save and load
- [ ] Ensure events are collected in aggregate

#### Read Model

- [ ] Design read model schema (denormalized for queries)
- [ ] Create database migration for read model tables
- [ ] Implement query handlers for common queries
- [ ] Add full-text search if needed (PostgreSQL tsvector)

#### Projections

- [ ] Create projection class for aggregate
- [ ] Implement event handlers in projection
- [ ] Ensure projection handlers are idempotent (upsert pattern)
- [ ] Add checkpoint tracking for projection recovery

### Phase 3: Production Readiness (Week 3-4)

#### Reliability

- [ ] Implement transaction middleware for commands
- [ ] Add retry middleware for transient failures
- [ ] Implement idempotency middleware with Redis/cache
- [ ] Add circuit breaker for external service calls
- [ ] Set up dead letter queue for failed events

#### Observability

- [ ] Add metrics for command execution (duration, success/failure)
- [ ] Add metrics for query execution (duration, cache hit rate)
- [ ] Add metrics for projection lag (events behind)
- [ ] Create dashboard for CQRS health
- [ ] Set up alerts for projection lag > threshold

#### Performance

- [ ] Add caching layer for frequently accessed read models
- [ ] Implement query result caching with TTL
- [ ] Optimize read model indexes
- [ ] Add database connection pooling
- [ ] Benchmark read/write paths

### Phase 4: Advanced Features (Week 4+)

#### Multiple Read Models

- [ ] Identify different query patterns needing optimization
- [ ] Create specialized read models (list view, detail view, analytics)
- [ ] Add Elasticsearch projection for search use cases
- [ ] Implement real-time projections with SSE/WebSocket

#### Event Store Integration

- [ ] Choose event store (PostgreSQL, EventStoreDB, etc.)
- [ ] Implement event serialization/deserialization
- [ ] Add event versioning strategy
- [ ] Implement event upcasting for schema evolution

#### Operational

- [ ] Document projection rebuild procedure
- [ ] Create runbook for CQRS troubleshooting
- [ ] Implement projection rebuild API endpoint
- [ ] Add projection status health check

---

## Migration Strategy (Existing System)

### Strangler Fig Pattern

Gradually migrate from monolithic CRUD to CQRS:

#### Step 1: Add Command/Query Layer (No Schema Changes)

- [ ] Create command/query classes that wrap existing service calls
- [ ] Route new endpoints through command/query bus
- [ ] Keep existing database and models

#### Step 2: Introduce Read Model (Dual Writes)

- [ ] Create read model tables alongside existing tables
- [ ] Implement projections that sync to read model
- [ ] Switch queries to use read model
- [ ] Verify data consistency between models

#### Step 3: Migrate Write Model

- [ ] Introduce domain events in write operations
- [ ] Implement event publishing after writes
- [ ] Remove direct read model updates (projection-only)
- [ ] Deprecate old tables

#### Step 4: Full CQRS

- [ ] Remove dual writes
- [ ] Implement event sourcing (optional)
- [ ] Deprecate old CRUD services
- [ ] Complete migration documentation

---

## Anti-Pattern Checklist

Verify you are NOT doing these:

- [ ] **NOT** querying the write model for reads
- [ ] **NOT** directly modifying read models (only through projections)
- [ ] **NOT** skipping idempotency in projections
- [ ] **NOT** ignoring projection lag in SLIs
- [ ] **NOT** coupling commands and queries in same handler
- [ ] **NOT** using synchronous projections for performance-critical paths
- [ ] **NOT** storing derived data in write model

---

## Success Metrics

Track these metrics to validate CQRS adoption:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Read Latency (p99) | < 50ms | Query handler duration |
| Write Latency (p99) | < 200ms | Command handler duration |
| Projection Lag | < 1s | Events in queue / processed |
| Cache Hit Rate | > 80% | Cache hits / total queries |
| Read Model Consistency | 100%* | Periodic reconciliation |

*Eventual consistency - measure time to consistency, not instant consistency

---

## Resources

- **Templates**: See `scripts/command-bus-template.py`, `scripts/query-handler-template.py`, `scripts/projection-template.py`
- **Examples**: See `examples/inventory-cqrs.py`, `examples/user-management-cqrs.py`
- **Related Skills**: `event-sourcing`, `saga-patterns`, `database-schema-designer`

---

**Last Updated**: 2026-01-18
**Version**: 1.0.0

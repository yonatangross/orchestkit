# CQRS Implementation Checklist

## Architecture Design

- [ ] Identified bounded contexts and aggregate boundaries
- [ ] Determined if CQRS is appropriate (read-heavy, different scaling needs)
- [ ] Decided on eventual consistency tolerance
- [ ] Planned for projection rebuild capability

## Command Side (Write Model)

### Commands
- [ ] Commands named as imperative verbs (`CreateOrder`, `CancelOrder`)
- [ ] Commands are immutable (frozen dataclass or Pydantic)
- [ ] Each command has unique `command_id` (UUID)
- [ ] Correlation ID included for distributed tracing
- [ ] Idempotency key field for retry safety
- [ ] User ID included for audit trail

### Command Handlers
- [ ] One handler per command type
- [ ] Handler validates business rules before changes
- [ ] Handler loads aggregate from repository
- [ ] Handler calls aggregate methods (not direct state mutation)
- [ ] Returns domain events for publishing
- [ ] Proper error handling and logging

### Command Bus
- [ ] Handler registration for all command types
- [ ] Validation middleware configured
- [ ] Logging middleware for observability
- [ ] Idempotency middleware for retries
- [ ] Event publishing after successful handling

### Aggregates
- [ ] Aggregate methods enforce business invariants
- [ ] State changes emit domain events
- [ ] Events stored as source of truth
- [ ] Optimistic concurrency with version checking

## Query Side (Read Model)

### Queries
- [ ] Queries named as questions (`GetOrderById`, `SearchOrders`)
- [ ] Pagination support (cursor-based recommended)
- [ ] Filter and sort parameters defined
- [ ] Return type clearly specified

### Query Handlers
- [ ] One handler per query type
- [ ] Direct database access to read model
- [ ] No business logic in handlers
- [ ] Proper null/not-found handling
- [ ] Efficient queries (indexed, denormalized)

### Query Bus
- [ ] Handler registration for all query types
- [ ] Caching middleware configured (if needed)
- [ ] Cache TTL per query type
- [ ] Cache invalidation strategy defined

### Read Models
- [ ] Denormalized for query efficiency
- [ ] Indexed for common query patterns
- [ ] `event_version` column for idempotent updates
- [ ] Separate tables for different query patterns

## Projections

### Design
- [ ] Each projection has unique name
- [ ] Projection handles all relevant event types
- [ ] Match statement or dispatcher for event routing
- [ ] Denormalized data fetched during projection (not query)

### Implementation
- [ ] **CRITICAL: Projections are idempotent** (safe to replay)
- [ ] Upserts used instead of inserts
- [ ] Version guard on updates (WHERE event_version < :version)
- [ ] Error handling per event (don't stop on failure)
- [ ] Checkpoint tracking after each event

### Projection Runner
- [ ] Polling or CDC-based event streaming
- [ ] Batch processing with configurable size
- [ ] Checkpoint persistence
- [ ] Rebuild capability tested
- [ ] Proper async generator cleanup (`aclosing`)

## Event Store (if Event Sourcing)

- [ ] Append-only design (no updates/deletes)
- [ ] Unique constraint on `(aggregate_id, version)`
- [ ] Global sequence number for projection ordering
- [ ] Indexes: aggregate_id, event_type, sequence_number
- [ ] Event schema versioning
- [ ] Upcaster chain for old events

## Observability

### Metrics
- [ ] Commands dispatched (count, latency)
- [ ] Queries dispatched (count, latency, cache hit rate)
- [ ] Projection lag (events behind)
- [ ] Event store size
- [ ] Errors per handler

### Logging
- [ ] Command started/completed/failed logs
- [ ] Query execution logs
- [ ] Projection processing logs
- [ ] Error logs with context

### Alerting
- [ ] Projection lag threshold
- [ ] Command failure rate
- [ ] Event store growth rate

## Testing

### Unit Tests
- [ ] Command handler tests (mock repository)
- [ ] Query handler tests (mock database)
- [ ] Projection handler tests (replay scenarios)
- [ ] Aggregate behavior tests

### Integration Tests
- [ ] Command to projection flow
- [ ] Query returns projected data
- [ ] Concurrent command handling
- [ ] Projection rebuild

### Performance Tests
- [ ] Query response times
- [ ] Projection throughput
- [ ] Event store append latency
- [ ] Cache effectiveness

## Deployment

- [ ] Database migrations for read models
- [ ] Projection initial population strategy
- [ ] Feature flags for gradual rollout
- [ ] Rollback plan defined
- [ ] Monitoring dashboards ready

## Anti-Pattern Checklist

- [ ] **NOT** querying write model for reads
- [ ] **NOT** modifying read model directly (bypass projections)
- [ ] **NOT** using INSERT without ON CONFLICT in projections
- [ ] **NOT** skipping version guards on updates
- [ ] **NOT** coupling command and query handlers
- [ ] **NOT** using synchronous projections for user requests

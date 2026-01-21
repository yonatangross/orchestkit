# Event Sourcing Checklist

A decision framework for when to adopt event sourcing and how to set up your event store correctly.

## Pre-Adoption Assessment

### Should You Use Event Sourcing?

Event sourcing stores all changes as a sequence of events, rather than just the current state. This checklist helps you decide if it's right for your use case.

#### Strong Indicators FOR Event Sourcing

- [ ] **Complete Audit Trail Required** - Regulatory or compliance requirements for full history
- [ ] **Temporal Queries Needed** - Need to answer "what was the state at time X?"
- [ ] **Event-Driven Architecture** - Already using events for system integration
- [ ] **Complex Domain with Behavior** - Rich domain model with business rules
- [ ] **Debugging Through Time** - Need to replay events to debug issues
- [ ] **Multiple Projections** - Need many different read model representations
- [ ] **CQRS Already Adopted** - Event sourcing complements CQRS naturally
- [ ] **Undo/Redo Requirements** - Users need to reverse operations

#### Strong Indicators AGAINST Event Sourcing

- [ ] **Simple CRUD Application** - Basic data entry with no audit needs
- [ ] **Relational Queries** - Heavy use of JOINs and ad-hoc SQL queries
- [ ] **Instant Consistency Required** - Cannot tolerate eventual consistency
- [ ] **Small Team** - Less than 3 developers with limited distributed systems experience
- [ ] **Schema Changes Frequent** - Domain model still evolving rapidly
- [ ] **Large State Per Aggregate** - Aggregates with 1000s of events
- [ ] **Delete Requirements** - GDPR right-to-be-forgotten without pseudonymization strategy

### Scoring

- **5+ Strong FOR indicators**: Event sourcing recommended
- **3-4 Strong FOR indicators**: Consider for specific bounded contexts
- **0-2 Strong FOR indicators**: Likely overkill
- **3+ Strong AGAINST indicators**: Do NOT use event sourcing

---

## Event Store Setup Checklist

### Option 1: PostgreSQL Event Store

Use PostgreSQL when you want simplicity and already have PostgreSQL infrastructure.

#### Schema Design

- [ ] Create events table with proper indexing:

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    sequence_number BIGSERIAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Optimistic concurrency
    version INT NOT NULL,

    UNIQUE (aggregate_id, version)
);

-- Indexes for common access patterns
CREATE INDEX idx_events_aggregate ON events(aggregate_id, version);
CREATE INDEX idx_events_sequence ON events(sequence_number);
CREATE INDEX idx_events_type ON events(aggregate_type, event_type);
CREATE INDEX idx_events_created ON events(created_at);
```

- [ ] Create outbox table for reliable event publishing:

```sql
CREATE TABLE event_outbox (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES events(id),
    published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON event_outbox(published, created_at)
WHERE published = FALSE;
```

- [ ] Create snapshots table for performance:

```sql
CREATE TABLE snapshots (
    aggregate_id UUID PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Implementation

- [ ] Implement `EventStore` class with append/load methods
- [ ] Add optimistic concurrency check on append
- [ ] Implement event serialization/deserialization
- [ ] Add retry logic for concurrent write conflicts
- [ ] Implement outbox publisher with at-least-once delivery

### Option 2: EventStoreDB

Use EventStoreDB for production-grade event sourcing with built-in projections.

#### Setup

- [ ] Deploy EventStoreDB (Docker, Kubernetes, or managed)
- [ ] Configure authentication and TLS
- [ ] Set up cluster for high availability (3+ nodes)
- [ ] Configure retention policies

#### Implementation

- [ ] Install esdbclient Python package
- [ ] Create connection wrapper with retry logic
- [ ] Implement aggregate loading with snapshot support
- [ ] Configure subscriptions for projections
- [ ] Set up persistent subscriptions for reliability

### Option 3: DynamoDB Event Store

Use DynamoDB for AWS-native, serverless event sourcing.

#### Schema Design

```
Table: events
  PK: aggregate_id (string)
  SK: version (number)

  Attributes:
    - event_type: string
    - event_data: map
    - metadata: map
    - timestamp: string (ISO8601)

GSI: events-by-sequence
  PK: partition_key (string, e.g., YYYYMMDD)
  SK: sequence_number (number)
```

- [ ] Create DynamoDB table with GSI
- [ ] Configure auto-scaling
- [ ] Set up DynamoDB Streams for projections
- [ ] Implement conditional writes for optimistic concurrency

---

## Event Design Checklist

### Event Naming

- [ ] Use past tense (OrderCreated, not CreateOrder)
- [ ] Be specific (ItemAddedToOrder, not OrderUpdated)
- [ ] Include aggregate context (Order prefix for order events)
- [ ] Avoid generic names (DataChanged is bad)

### Event Schema

- [ ] Include aggregate_id in every event
- [ ] Include timestamp for temporal queries
- [ ] Include correlation_id for distributed tracing
- [ ] Include causation_id to link related events
- [ ] Include actor_id for audit (who triggered this)
- [ ] Include version number for schema evolution

### Example Event Structure

```python
class OrderItemAdded(DomainEvent):
    """An item was added to an order."""

    # Standard metadata
    event_id: UUID
    timestamp: datetime
    aggregate_id: UUID  # The order ID
    correlation_id: UUID | None
    causation_id: UUID | None  # ID of command/event that caused this
    actor_id: UUID | None  # User who added the item

    # Event-specific data
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: Decimal

    # Schema version for evolution
    schema_version: int = 1
```

---

## Event Versioning Checklist

Handle schema changes without breaking existing events:

### Strategy 1: Upcasting (Recommended)

Transform old events to new format on read:

- [ ] Define upcaster registry
- [ ] Create upcaster for each breaking change
- [ ] Test upcasters with historical events
- [ ] Document version history

```python
class OrderItemAddedV1ToV2Upcaster:
    """Upcast v1 events to v2 format."""

    def upcast(self, event_data: dict) -> dict:
        # v1 had 'price', v2 split to 'unit_price' and 'quantity'
        if "price" in event_data:
            event_data["unit_price"] = event_data.pop("price")
            event_data["quantity"] = event_data.get("quantity", 1)
        return event_data
```

### Strategy 2: Weak Schema

Store events as untyped dicts, validate on read:

- [ ] Define event schemas separately from storage
- [ ] Validate only on projection/read
- [ ] Allow unknown fields in events
- [ ] Log validation warnings for monitoring

### Strategy 3: Copy-Transform

Migrate events to new table with new schema:

- [ ] Create migration script
- [ ] Run migration during maintenance window
- [ ] Verify data integrity
- [ ] Update application to use new table

---

## Snapshotting Checklist

Optimize aggregate loading for aggregates with many events:

### When to Snapshot

- [ ] **Event Count Threshold** - Snapshot after every N events (e.g., 100)
- [ ] **Time Threshold** - Snapshot if last snapshot > 24 hours old
- [ ] **Load Time Threshold** - Snapshot if aggregate load > 100ms

### Implementation

- [ ] Define serializable snapshot format
- [ ] Implement snapshot creation after command handling
- [ ] Load from snapshot + newer events
- [ ] Handle snapshot schema evolution
- [ ] Add background snapshot creation job

```python
class AggregateRepository:
    SNAPSHOT_THRESHOLD = 100

    async def load(self, aggregate_id: UUID) -> Aggregate:
        # Try to load from snapshot first
        snapshot = await self.snapshot_store.get(aggregate_id)

        if snapshot:
            aggregate = Aggregate.from_snapshot(snapshot.state)
            events = await self.event_store.get_events(
                aggregate_id,
                from_version=snapshot.version + 1
            )
        else:
            aggregate = Aggregate()
            events = await self.event_store.get_events(aggregate_id)

        # Apply events
        for event in events:
            aggregate.apply(event)

        # Create snapshot if needed
        if aggregate.version - (snapshot.version if snapshot else 0) > self.SNAPSHOT_THRESHOLD:
            await self.snapshot_store.save(aggregate_id, aggregate)

        return aggregate
```

---

## Production Checklist

### Reliability

- [ ] Implement outbox pattern for reliable event publishing
- [ ] Add dead letter queue for failed event processing
- [ ] Implement exactly-once projection processing
- [ ] Add projection checkpoint persistence
- [ ] Implement aggregate not found handling

### Observability

- [ ] Metric: Events appended per second
- [ ] Metric: Event store latency (p50, p95, p99)
- [ ] Metric: Projection lag (events behind)
- [ ] Metric: Snapshot hit rate
- [ ] Alert: Projection lag > 10 seconds
- [ ] Alert: Event append failures

### Performance

- [ ] Benchmark aggregate loading time
- [ ] Implement snapshot threshold tuning
- [ ] Add read replicas for projections
- [ ] Implement event batching for projections
- [ ] Add caching for frequently accessed aggregates

### Data Management

- [ ] Define event retention policy
- [ ] Implement GDPR compliance strategy (pseudonymization, crypto-shredding)
- [ ] Create backup strategy for event store
- [ ] Document disaster recovery procedure
- [ ] Test event store restore from backup

---

## GDPR Compliance Strategies

### Option 1: Crypto-Shredding

Encrypt PII with per-user key, delete key on request:

- [ ] Generate encryption key per user
- [ ] Encrypt PII fields before storing in events
- [ ] Store keys in separate key store
- [ ] Delete key = effective deletion
- [ ] Document affected events and fields

### Option 2: Pseudonymization

Replace PII with pseudonyms, store mapping separately:

- [ ] Create pseudonym mapping table
- [ ] Replace PII in events with pseudonym references
- [ ] Delete mapping on GDPR request
- [ ] Events remain valid but anonymized

### Option 3: Event Tombstoning

Mark events as deleted without physical removal:

- [ ] Add deleted flag to events
- [ ] Filter deleted events in projections
- [ ] Retain aggregate consistency
- [ ] Log deletion for audit

---

## Anti-Pattern Checklist

Verify you are NOT doing these:

- [ ] **NOT** storing derived data in events (calculate in projections)
- [ ] **NOT** using events for inter-service communication (use integration events)
- [ ] **NOT** modifying published events (events are immutable)
- [ ] **NOT** storing large blobs in events (use references)
- [ ] **NOT** relying on event order across aggregates (only within)
- [ ] **NOT** using events as the query model (use projections)

---

## Resources

- **Templates**: See `scripts/projection-template.py` for projection patterns
- **Examples**: See `examples/inventory-cqrs.py` for event-sourced aggregate
- **Related Skills**: `saga-patterns`, `outbox-pattern`, `message-queues`

---

**Last Updated**: 2026-01-18
**Version**: 1.0.0

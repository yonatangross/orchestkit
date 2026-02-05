# Event Sourcing Implementation Checklist

## Event Design

- [ ] Events named in past tense (`OrderPlaced`, not `PlaceOrder`)
- [ ] Events are immutable (Pydantic `frozen=True`)
- [ ] Each event has unique `event_id` (UUID)
- [ ] Events include `aggregate_id` and `version`
- [ ] Events have `timestamp` for temporal queries
- [ ] Events contain only facts, no computed data
- [ ] Schema version included for evolution

## Aggregate Boundaries

- [ ] Aggregates are consistency boundaries
- [ ] Each aggregate has single root entity
- [ ] Aggregate ID is stable and unique
- [ ] Cross-aggregate refs use IDs only
- [ ] Commands target single aggregate
- [ ] Business invariants enforced within aggregate

## Event Store

- [ ] Append-only (no updates, no deletes)
- [ ] Events ordered by version within aggregate
- [ ] Unique constraint on `(aggregate_id, version)`
- [ ] Optimistic concurrency with expected version
- [ ] Global ordering for projections
- [ ] Event metadata stored (correlation IDs)

## Event Versioning

- [ ] Schema version tracked in events
- [ ] Upcaster chain for old to new schemas
- [ ] Default values for new optional fields
- [ ] Breaking changes via new event types
- [ ] Version migration tested

## CQRS Separation

### Command Side
- [ ] Commands are intentions (not facts)
- [ ] Handlers load aggregate from events
- [ ] Validation before event creation
- [ ] Transactional event append

### Query Side
- [ ] Read models optimized for queries
- [ ] Projections are idempotent (replay-safe)
- [ ] Projection checkpoints tracked
- [ ] Rebuild capability tested

## Projections

- [ ] Each projection has checkpoint tracking
- [ ] Projections handle all relevant events
- [ ] Idempotent updates (upserts)
- [ ] Projection lag monitored
- [ ] Rebuild tested and documented

## Snapshots (if needed)

- [ ] Snapshot frequency defined (every N events)
- [ ] Snapshot state matches aggregate state
- [ ] Loading: snapshot + events after
- [ ] Snapshot schema versioned

## Concurrency

- [ ] Optimistic locking with version check
- [ ] Retry logic for conflicts
- [ ] Backoff between retries
- [ ] Max retry limit defined

## Testing

- [ ] Unit tests for event application
- [ ] Unit tests for aggregate commands
- [ ] Integration tests for event store
- [ ] Concurrency conflict scenarios tested
- [ ] Schema migration tested

# Aggregate Design Checklist

## Aggregate Identification

- [ ] Aggregate root identified (single entry point)
- [ ] Bounded appropriately (not too large, not too small)
- [ ] Clear ownership of child entities
- [ ] References to other aggregates by ID only
- [ ] Using UUIDv7 for time-ordered IDs

## Invariant Enforcement

- [ ] All invariants identified and documented
- [ ] Invariants enforced in constructor (`__post_init__`)
- [ ] Invariants enforced in mutation methods
- [ ] Custom exceptions for invariant violations
- [ ] No way to bypass invariants (private setters)

## State Modification

- [ ] All modifications through aggregate root methods
- [ ] No public setters on entities
- [ ] State transitions validated
- [ ] Child entities created through factory methods
- [ ] `_touch()` updates `updated_at` on changes

## Domain Events

- [ ] Events emitted for significant state changes
- [ ] Events are immutable (frozen dataclass)
- [ ] Events named in past tense (OrderPlaced)
- [ ] Events contain IDs, not full entities
- [ ] `collect_events()` clears event list after collection

## Eventual Consistency

- [ ] Cross-aggregate updates use domain events
- [ ] Event handlers are idempotent
- [ ] Compensating transactions for failures
- [ ] Saga pattern for complex workflows
- [ ] Processed event tracking for deduplication

## Sizing

- [ ] Aggregate not too large (affects performance)
- [ ] Child collections bounded (< 100 items typical)
- [ ] No unbounded collections
- [ ] Frequently updated entities separated
- [ ] Different lifecycles = different aggregates

## Repository

- [ ] Repository per aggregate root
- [ ] Repository interface in domain layer
- [ ] Implementation in infrastructure layer
- [ ] Returns domain entities, not ORM models
- [ ] Handles mapping between layers

## Concurrency

- [ ] Optimistic locking with version field
- [ ] Aggregate loaded fresh before modification
- [ ] Concurrent modification detected
- [ ] Retry strategy for conflicts

## Testing

- [ ] Invariant violations tested
- [ ] State transitions tested
- [ ] Domain events verified
- [ ] Edge cases covered
- [ ] Integration with repository tested

## Anti-Patterns Avoided

- [ ] No anemic aggregates (logic in services)
- [ ] No bi-directional references
- [ ] No direct child entity access
- [ ] No aggregate references (use IDs)
- [ ] No UUIDv4 (use UUIDv7)

## PostgreSQL 18 Integration

- [ ] `gen_random_uuid_v7()` as column default
- [ ] Proper indexes on foreign keys
- [ ] CASCADE delete for owned entities
- [ ] TIMESTAMPTZ for timestamps

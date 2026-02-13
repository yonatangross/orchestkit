# Outbox Pattern Implementation Checklist

Verification checklist for implementing the transactional outbox pattern.

## Schema Design

- [ ] Outbox table created with required columns:
  - [ ] `id` - UUID primary key
  - [ ] `aggregate_type` - Entity type (e.g., "Order", "User")
  - [ ] `aggregate_id` - Entity ID for ordering
  - [ ] `event_type` - Event name (e.g., "OrderCreated")
  - [ ] `payload` - JSONB event data
  - [ ] `created_at` - Timestamp for ordering
  - [ ] `published_at` - NULL until published
  - [ ] `retry_count` - Track failed attempts
  - [ ] `last_error` - Error message for debugging

- [ ] Indexes created for performance:
  - [ ] Partial index on unpublished messages: `WHERE published_at IS NULL`
  - [ ] Index on `aggregate_id` for entity queries
  - [ ] Index on `created_at` for ordering

- [ ] SQLAlchemy model defined with proper types
- [ ] Alembic migration created and tested

## Publisher Reliability

- [ ] Polling or CDC delivery mechanism chosen
- [ ] Row-level locking implemented: `with_for_update(skip_locked=True)`
- [ ] Batch processing with configurable batch size
- [ ] Retry logic with exponential backoff
- [ ] Max retry limit configured (default: 5)
- [ ] Dead letter handling for failed messages
- [ ] Graceful shutdown handling
- [ ] Concurrent publisher protection (single instance or coordinated)

## Atomic Operations

- [ ] Business entity and outbox message in same transaction:
  ```python
  async with session.begin():
      session.add(order)
      session.add(OutboxMessage(
          aggregate_type="Order",
          aggregate_id=order.id,
          event_type="OrderCreated",
          payload=order.to_event_payload(),
      ))
  ```
- [ ] No publishing before commit (dual-write anti-pattern)
- [ ] Rollback on any failure reverts both entity and outbox

## Message Format

- [ ] Event ID included for deduplication
- [ ] Aggregate ID included for ordering
- [ ] Event type clearly named (past tense: "OrderCreated")
- [ ] Timestamp included in payload
- [ ] Schema version for evolution (optional)
- [ ] Payload size reasonable (< 1MB, prefer < 64KB)

## Consumer Requirements

- [ ] Idempotent message handling
- [ ] Deduplication table or mechanism
- [ ] Ordering handled per aggregate
- [ ] Error handling with retry/DLQ
- [ ] Consumer group for scaling

## Monitoring Setup

### Metrics

- [ ] `outbox_pending_messages` - Gauge of unpublished count
- [ ] `outbox_publish_latency_seconds` - Histogram of delivery time
- [ ] `outbox_publish_errors_total` - Counter of failures by type
- [ ] `outbox_messages_published_total` - Counter by aggregate/event type

### Alerts

- [ ] Alert on pending messages > threshold (e.g., 1000 for 5 min)
- [ ] Alert on publish error rate > threshold
- [ ] Alert on publisher process not running
- [ ] Alert on message age > threshold (stuck messages)

### Dashboards

- [ ] Outbox queue depth over time
- [ ] Publish rate and latency
- [ ] Error rate by type
- [ ] Top aggregate types by volume

## Cleanup Policies

- [ ] Published messages cleanup strategy defined:
  - [ ] Option A: Delete immediately after publish
  - [ ] Option B: Delete after retention period (e.g., 7 days)
  - [ ] Option C: Archive to cold storage, then delete

- [ ] Cleanup job scheduled (daily recommended)
- [ ] Cleanup query efficient (uses index):
  ```sql
  DELETE FROM outbox
  WHERE published_at IS NOT NULL
    AND published_at < NOW() - INTERVAL '7 days'
  LIMIT 10000;  -- Batch to avoid long locks
  ```

- [ ] Consumer dedup table cleanup configured
- [ ] Table bloat monitoring (VACUUM analysis)

## Testing

- [ ] Unit tests for outbox message creation
- [ ] Integration tests for atomic transactions
- [ ] Publisher tests with mock broker
- [ ] Failure scenario tests (DB down, broker down)
- [ ] Idempotency tests (duplicate message handling)
- [ ] Ordering tests (same aggregate events in order)

## Documentation

- [ ] Outbox table schema documented
- [ ] Event types catalog maintained
- [ ] Publisher configuration documented
- [ ] Runbook for common issues:
  - [ ] High pending message count
  - [ ] Publisher not running
  - [ ] Consumer lag
  - [ ] Failed message investigation

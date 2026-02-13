# Saga Design Checklist

Use this checklist when designing distributed transactions with the saga pattern.

## Pre-Design Assessment

### When to Use Saga Pattern

- [ ] Operation spans multiple services/databases
- [ ] Distributed lock (2PC) is impractical or too slow
- [ ] Business process is long-running (minutes to days)
- [ ] Eventual consistency is acceptable
- [ ] Each service must maintain its own data store

### When NOT to Use Saga

- [ ] Single database transaction suffices
- [ ] Real-time consistency is required
- [ ] Simple request-response pattern
- [ ] All data is in the same service boundary

---

## Pattern Selection

### Choose Orchestration When

- [ ] Complex, ordered workflows with dependencies
- [ ] Need central visibility into saga progress
- [ ] Business logic is concentrated in one domain
- [ ] Testing isolation is important
- [ ] Timeline: 10+ steps or complex branching

### Choose Choreography When

- [ ] Simple, linear workflows
- [ ] Services are highly autonomous
- [ ] Events naturally represent domain boundaries
- [ ] Need loose coupling between services
- [ ] Timeline: < 5 steps, parallel execution possible

---

## Saga Design

### Step Definition

For each step, verify:

- [ ] **Action** is defined with clear success/failure criteria
- [ ] **Compensation** is defined (can undo the action)
- [ ] **Timeout** is configured (step-level, not just saga-level)
- [ ] **Retries** are configured with exponential backoff
- [ ] **Idempotency key** generation is deterministic

### Step Ordering

- [ ] Steps are ordered by business dependency, not technical convenience
- [ ] Compensatable steps come before pivot step (point of no return)
- [ ] Non-compensatable steps (e.g., email notification) are last
- [ ] Parallel steps are explicitly marked if using orchestration

### Data Flow

- [ ] Each step has well-defined input/output
- [ ] Context accumulates data for subsequent steps
- [ ] Compensation has access to all required data
- [ ] Sensitive data is not persisted in saga state

---

## Saga State Management

### Persistence

- [ ] Saga state is persisted after each step transition
- [ ] Optimistic locking prevents concurrent updates
- [ ] State includes: saga_id, status, current_step, data, timestamps
- [ ] State can be serialized/deserialized reliably

### Status Tracking

Saga should track these statuses:

- [ ] `PENDING` - Saga created, not started
- [ ] `RUNNING` - Executing forward steps
- [ ] `COMPLETED` - All steps succeeded
- [ ] `COMPENSATING` - Executing compensation
- [ ] `COMPENSATED` - All compensations completed
- [ ] `FAILED` - Unrecoverable failure

### Timeout Handling

- [ ] Saga-level timeout is configured
- [ ] Step-level timeouts are configured
- [ ] Timeout triggers compensation, not retry
- [ ] Recovery job handles stuck sagas

---

## Compensation Design

### Basic Requirements

- [ ] Every action has a corresponding compensation
- [ ] Compensation is idempotent (safe to call multiple times)
- [ ] Compensation handles partial data (action may have partially succeeded)
- [ ] Compensation failures are logged, not blocking

### Compensation Order

- [ ] Compensations execute in reverse order of actions
- [ ] Failed compensation does not block subsequent compensations
- [ ] Manual intervention path exists for unrecoverable compensations

### Edge Cases

- [ ] What if compensation times out?
- [ ] What if compensation fails permanently?
- [ ] What if network partition during compensation?
- [ ] Is there an alerting mechanism for failed compensations?

---

## Idempotency

### Implementation

- [ ] Idempotency key is generated deterministically
- [ ] Key includes: saga_id, step_name, and stable parameters
- [ ] Key does NOT include: timestamps, random values
- [ ] Results are cached with appropriate TTL (7+ days recommended)

### Verification

- [ ] Replay of step returns cached result, not re-execution
- [ ] Compensation checks if already compensated
- [ ] Event handlers check if already processed

---

## Observability

### Logging

- [ ] Saga start/complete/fail logged with saga_id
- [ ] Each step start/complete/fail logged
- [ ] Compensation events logged
- [ ] Correlation ID propagated across services

### Metrics

- [ ] Saga duration histogram
- [ ] Step duration histogram
- [ ] Success/failure rate by saga type
- [ ] Compensation rate by step

### Tracing

- [ ] Distributed tracing spans for each step
- [ ] saga_id included in all trace context
- [ ] Cross-service correlation maintained

---

## Error Handling

### Transient Failures

- [ ] Network errors trigger retry with backoff
- [ ] Timeouts trigger retry (up to max_retries)
- [ ] 429/503 errors respect retry-after headers

### Permanent Failures

- [ ] Validation errors skip retry, trigger compensation
- [ ] 400/401/403/404 errors skip retry, trigger compensation
- [ ] Business rule violations trigger compensation

### Recovery

- [ ] Stuck saga detection job scheduled
- [ ] Recovery resumes from current step, not beginning
- [ ] Manual intervention API exists
- [ ] Dead letter queue for unrecoverable events

---

## Testing

### Unit Tests

- [ ] Each step action tested in isolation
- [ ] Each compensation tested in isolation
- [ ] Idempotency key generation tested
- [ ] State transitions tested

### Integration Tests

- [ ] Happy path: all steps succeed
- [ ] Failure at each step triggers correct compensation
- [ ] Timeout handling works correctly
- [ ] Recovery from stuck state works

### Chaos Tests (Production Readiness)

- [ ] Random service failures during saga execution
- [ ] Network partitions during execution
- [ ] Database unavailability during state persistence
- [ ] Message queue backpressure

---

## Production Readiness

### Deployment

- [ ] Saga state table created with proper indexes
- [ ] Idempotency store (Redis) configured
- [ ] Event publisher configured (Kafka/RabbitMQ/outbox)
- [ ] Monitoring dashboards created

### Operations

- [ ] Runbook for manual saga intervention
- [ ] Alerting for failed sagas configured
- [ ] Dead letter queue monitoring
- [ ] Log aggregation with saga_id filtering

### Documentation

- [ ] Saga flow diagram documented
- [ ] Step descriptions and dependencies documented
- [ ] Compensation logic documented
- [ ] Known failure modes documented

---

## Quick Reference: Saga Types

| Type | Steps | Pattern | Example |
|------|-------|---------|---------|
| Simple | 2-3 | Choreography | Order -> Payment |
| Standard | 4-6 | Either | Order -> Inventory -> Payment -> Shipping |
| Complex | 7+ | Orchestration | Multi-vendor marketplace order |
| Long-Running | Days | Orchestration + Temporal | Travel booking with confirmations |

---

## Common Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Missing compensation | Data inconsistency | Checklist enforcement |
| Non-idempotent steps | Duplicate operations | Idempotency key design |
| In-memory state | Lost on restart | Persistent state store |
| Synchronous compensation | Cascading failures | Async with queues |
| No timeout | Saga hangs forever | Step + saga timeouts |
| No observability | Debugging nightmare | Structured logging + tracing |

---

**Last Updated**: 2026-01-18
**Version**: 1.0.0

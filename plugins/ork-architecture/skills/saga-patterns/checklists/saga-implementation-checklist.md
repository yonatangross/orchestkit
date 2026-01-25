# Saga Implementation Checklist

Production-ready checklist for implementing saga patterns.

## Pre-Implementation

- [ ] **Choose pattern**: Orchestration vs Choreography
  - Orchestration: Complex workflows, ordered steps, central visibility
  - Choreography: Simple flows, loose coupling, parallel steps

- [ ] **Define saga scope**: What operations form the saga boundary?
  - List all services involved
  - Identify transaction boundaries
  - Define success/failure criteria

- [ ] **Design compensation**: Every action needs a compensation
  - Document compensation for each step
  - Consider partial compensation scenarios
  - Plan for compensation failures

## State Management

- [ ] **Persistent storage**: Never use in-memory saga state
  - PostgreSQL with JSONB for saga context
  - Optimistic locking (version column)
  - Indexes on saga_id, status, created_at

- [ ] **Saga state schema**:
  ```sql
  CREATE TABLE saga_states (
      id UUID PRIMARY KEY,
      saga_type VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      current_step INT DEFAULT 0,
      data JSONB NOT NULL,
      step_results JSONB DEFAULT '[]',
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      timeout_at TIMESTAMPTZ,
      version INT DEFAULT 1
  );
  ```

- [ ] **State transitions**: Define valid state transitions
  - PENDING -> RUNNING
  - RUNNING -> COMPLETED | COMPENSATING | FAILED
  - COMPENSATING -> COMPENSATED | FAILED

## Idempotency

- [ ] **Idempotency keys**: Every step must be idempotent
  - Generate deterministic keys: `{saga_id}:{step_name}`
  - Store execution results with TTL (7+ days)
  - Check before execution, skip if already done

- [ ] **Compensation idempotency**: Compensations must also be idempotent
  - Use separate compensation keys: `comp:{saga_id}:{step_name}`
  - Safe to call multiple times

## Timeout Handling

- [ ] **Per-step timeouts**: Configure timeout for each step
  - Default: 60 seconds
  - Long operations: up to 5 minutes
  - Use `asyncio.wait_for()` or equivalent

- [ ] **Saga-level timeout**: Overall saga timeout
  - Calculate based on sum of step timeouts + buffer
  - Store `timeout_at` in saga state
  - Recovery service checks for expired sagas

- [ ] **Recovery service**: Scheduled job to recover stuck sagas
  - Run every 5-15 minutes
  - Find sagas in RUNNING state older than timeout
  - Resume idempotent steps, compensate non-idempotent

## Event Publishing (Choreography)

- [ ] **Saga correlation ID**: Include in all events
  - Track events across services
  - Enable distributed tracing

- [ ] **Event versioning**: Version all event schemas
  - Include `version` field in events
  - Support event upcasting for old versions

- [ ] **Dead letter handling**: Configure DLQ for failed events
  - Max retries: 3
  - Store failed events for analysis
  - Alert on DLQ threshold

## Observability

- [ ] **Structured logging**: Log all state transitions
  ```python
  logger.info(
      "saga_transition",
      saga_id=saga_id,
      from_state=from_state,
      to_state=to_state,
      step=step_name,
  )
  ```

- [ ] **Metrics**: Track saga health
  - `saga_executions_total{saga_type, status}`
  - `saga_duration_seconds{saga_type}`
  - `saga_step_duration_seconds{saga_type, step}`
  - `saga_compensations_total{saga_type}`

- [ ] **Tracing**: Distributed tracing setup
  - Pass trace context in saga events
  - Create spans for each step
  - Include saga_id in all spans

- [ ] **Alerting**: Configure alerts
  - Saga failure rate > 5%
  - Compensation failure rate > 1%
  - Stuck sagas > threshold
  - DLQ depth > threshold

## Testing

- [ ] **Unit tests**: Test individual steps
  - Action execution
  - Compensation execution
  - Idempotency behavior

- [ ] **Integration tests**: Test full saga flow
  - Happy path completion
  - Failure at each step triggers correct compensation
  - Timeout handling
  - Recovery from stuck state

- [ ] **Chaos testing**: Test failure scenarios
  - Service unavailability
  - Network partitions
  - Database failures
  - Message broker failures

## Security

- [ ] **Data encryption**: Encrypt sensitive saga data
  - PII in saga context
  - Payment information
  - Use field-level encryption

- [ ] **Access control**: Limit saga operations
  - Only authorized services can start sagas
  - Audit trail for manual interventions

## Documentation

- [ ] **Saga flow diagram**: Visual representation
  - States and transitions
  - Compensation paths
  - Timeout points

- [ ] **Runbook**: Operational procedures
  - How to manually compensate
  - How to retry failed steps
  - How to investigate stuck sagas

## Go-Live Checklist

- [ ] Saga state table created with indexes
- [ ] Idempotency store configured (Redis/DB)
- [ ] Recovery service deployed and scheduled
- [ ] Metrics and dashboards configured
- [ ] Alerts configured and tested
- [ ] Runbook reviewed by operations team
- [ ] Load testing completed
- [ ] Chaos testing completed
- [ ] Rollback plan documented

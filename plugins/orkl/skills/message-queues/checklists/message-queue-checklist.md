# Message Queue Implementation Checklist

Verification checklist for production-ready message queue deployments.

## Message Durability

### Queue Configuration
- [ ] Queues declared as `durable=True`
- [ ] Messages published with `delivery_mode=PERSISTENT`
- [ ] Queue `auto_delete=False` for persistent queues
- [ ] Appropriate `x-message-ttl` set (prevent unbounded growth)
- [ ] `x-max-length` configured with overflow policy

### Persistence
- [ ] RabbitMQ: Disk nodes configured (not RAM-only)
- [ ] RabbitMQ: Mirrored queues for HA (or quorum queues)
- [ ] Redis: AOF persistence enabled (`appendonly yes`)
- [ ] Redis: Appropriate `appendfsync` setting (`everysec` or `always`)
- [ ] Backup strategy for queue data

---

## Consumer Error Handling

### Acknowledgment
- [ ] Manual acknowledgment enabled (not auto-ack)
- [ ] `requeue=False` on permanent failures (prevents infinite loops)
- [ ] Proper exception handling around message processing
- [ ] Context manager used for automatic ack on success

### Error Classification
- [ ] Transient errors trigger retry (network, timeout)
- [ ] Permanent errors route to DLQ (validation, business logic)
- [ ] Unknown errors logged with full context
- [ ] Error metrics emitted for monitoring

### Graceful Shutdown
- [ ] SIGTERM handler stops accepting new messages
- [ ] In-flight messages complete before shutdown
- [ ] Unacked messages redelivered to other consumers
- [ ] Connection closed cleanly

---

## Retry Strategies

### Configuration
- [ ] Retry count limit defined (typically 3-5)
- [ ] Exponential backoff implemented
- [ ] Jitter added to prevent thundering herd
- [ ] Max delay capped (e.g., 30 seconds)

### Retry Tracking
- [ ] Retry count stored in message headers
- [ ] Original timestamp preserved
- [ ] Error history attached to message
- [ ] Correlation ID maintained across retries

### Dead Letter Handling
- [ ] DLX configured for exhausted retries
- [ ] DLQ consumer processes failed messages
- [ ] Alerting on DLQ growth
- [ ] DLQ retention policy defined

---

## Monitoring Setup

### Metrics
- [ ] Queue depth (messages waiting)
- [ ] Consumer count and utilization
- [ ] Message publish/consume rates
- [ ] Acknowledgment latency
- [ ] Retry rate by queue
- [ ] DLQ message count

### Alerts
- [ ] Queue depth threshold (e.g., >1000 messages)
- [ ] Consumer down alert
- [ ] High retry rate (>5% of messages)
- [ ] DLQ growth rate
- [ ] Connection failures

### Logging
- [ ] Structured logging with correlation IDs
- [ ] Message lifecycle events (published, consumed, acked, rejected)
- [ ] Error details with stack traces
- [ ] Performance timing (processing duration)

---

## Security

### Authentication
- [ ] Credentials not hardcoded (use environment variables)
- [ ] Separate credentials per service
- [ ] TLS enabled for connections
- [ ] Virtual hosts for tenant isolation (RabbitMQ)

### Authorization
- [ ] Minimal permissions per service (read/write separation)
- [ ] No management access from application code
- [ ] Audit logging for admin operations

---

## Performance

### Producer
- [ ] Connection pooling configured
- [ ] Batch publishing where appropriate
- [ ] Async publishing for non-blocking operation
- [ ] Publisher confirms enabled for critical messages

### Consumer
- [ ] Prefetch count tuned (start with 10, adjust based on load)
- [ ] Concurrent consumers for parallel processing
- [ ] Async handlers (no blocking I/O)
- [ ] Batch processing where applicable

### Capacity
- [ ] Load testing completed
- [ ] Auto-scaling configured for consumers
- [ ] Resource limits set (memory, disk)
- [ ] Horizontal scaling plan documented

---

## Testing

### Unit Tests
- [ ] Message serialization/deserialization
- [ ] Error handling logic
- [ ] Retry logic with mocked failures
- [ ] Idempotency handling

### Integration Tests
- [ ] End-to-end message flow
- [ ] Consumer failure and recovery
- [ ] DLQ routing
- [ ] Cluster failover (if applicable)

### Chaos Testing
- [ ] Consumer crashes during processing
- [ ] Network partition between producer/broker
- [ ] Broker restart during operation
- [ ] Disk full scenario

---

## Pre-Production Checklist

Before going live:

- [ ] All durability checks passed
- [ ] Error handling verified with failure injection
- [ ] Retry strategy tested with realistic failures
- [ ] Monitoring dashboards created
- [ ] Alerts configured and tested
- [ ] Runbook documented for common issues
- [ ] Load test completed at 2x expected volume
- [ ] Rollback procedure documented

---
name: event-driven
description: Event-driven architecture patterns for event sourcing, CQRS, saga orchestration, transactional outbox, and message queue topologies. Use when building event stores, command/query separation, distributed transactions, reliable messaging, or Kafka/RabbitMQ/Redis Streams patterns.
tags: [event-sourcing, cqrs, saga, outbox, message-queue, kafka, rabbitmq, redis-streams]
context: fork
agent: event-driven-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
---

# Event-Driven Architecture

Comprehensive event-driven patterns. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Event Sourcing](#event-sourcing) | 3 | HIGH | Event stores, append-only logs, projections, snapshots |
| [CQRS](#cqrs) | 3 | HIGH | Command/query separation, read models, materialized views |
| [Saga Patterns](#saga-patterns) | 3 | HIGH | Distributed transactions, orchestration vs choreography, compensation |
| [Outbox Pattern](#outbox-pattern) | 2 | HIGH | Reliable publishing, CDC, Debezium, dual-write prevention |
| [Message Queues](#message-queues) | 3 | MEDIUM | Kafka, RabbitMQ, Redis Streams, topic design, DLQ |

**Total: 14 rules across 5 categories**

## Quick Start

```python
# Event-sourced aggregate with optimistic concurrency
class Account:
    def __init__(self):
        self._changes, self._version, self.balance = [], 0, 0.0

    def deposit(self, amount: float):
        self._raise_event(MoneyDeposited(aggregate_id=self.id, amount=amount, version=self._version + 1))

    def _apply(self, event):
        match event:
            case MoneyDeposited(): self.balance += event.amount
            case MoneyWithdrawn(): self.balance -= event.amount
```

```python
# CQRS command dispatch with event publishing
async def dispatch(self, command: Command) -> list[DomainEvent]:
    handler = self._handlers.get(type(command))
    events = await handler.handle(command)
    for event in events:
        await self.event_publisher.publish(event)
    return events
```

## Event Sourcing

Store application state as immutable events rather than current state snapshots.

| Rule | File | Key Pattern |
|------|------|-------------|
| Event Store | `rules/sourcing-event-store.md` | Append-only store, optimistic concurrency, versioning |
| Aggregate Pattern | `rules/sourcing-aggregates.md` | Event-sourced aggregates, apply/raise, history loading |
| Projections & Snapshots | `rules/sourcing-projections.md` | Read model projections, snapshot strategies, upcasting |

## CQRS

Separate read and write concerns for optimized data access.

| Rule | File | Key Pattern |
|------|------|-------------|
| Command Side | `rules/cqrs-commands.md` | Command bus, handlers, write model aggregates |
| Read Models | `rules/cqrs-read-models.md` | Query handlers, denormalized views, projections |
| API Integration | `rules/cqrs-api-integration.md` | FastAPI endpoints, command/query dispatch, consistency |

## Saga Patterns

Maintain consistency across microservices without distributed locks.

| Rule | File | Key Pattern |
|------|------|-------------|
| Orchestration | `rules/saga-orchestration.md` | Central orchestrator, step execution, compensation |
| Choreography | `rules/saga-choreography.md` | Event-driven flows, distributed handlers |
| Recovery & Idempotency | `rules/saga-recovery.md` | Timeout handling, retry, idempotent steps |

## Outbox Pattern

Ensure atomic state changes and event publishing via transactional outbox.

| Rule | File | Key Pattern |
|------|------|-------------|
| Outbox & Polling | `rules/outbox-polling.md` | Outbox table, polling publisher, SKIP LOCKED |
| CDC & Idempotency | `rules/outbox-cdc.md` | Debezium CDC, idempotent consumer, Dapr integration |

## Message Queues

Asynchronous communication patterns for distributed systems.

| Rule | File | Key Pattern |
|------|------|-------------|
| Kafka Streaming | `rules/queues-kafka.md` | aiokafka producer/consumer, partitions, exactly-once |
| RabbitMQ Messaging | `rules/queues-rabbitmq.md` | aio-pika, exchanges, routing, DLQ retry |
| Redis Streams & Postgres | `rules/queues-redis-postgres.md` | Consumer groups, XREAD, Postgres LISTEN/NOTIFY |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Event naming | Past tense (`OrderPlaced`, not `PlaceOrder`) |
| Concurrency | Optimistic locking with version check |
| Saga pattern | Orchestration for complex flows, Choreography for simple |
| Outbox delivery | Polling for simplicity, CDC (Debezium) for > 10K msg/s |
| Message broker | Kafka for streaming, RabbitMQ for routing, Redis for simplicity |
| Idempotency | Required for all saga steps and message consumers |
| Consistency | Eventual consistency between write and read models |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: event store, saga orchestrator, outbox publisher, queue consumer |
| [checklists/](checklists/) | Pre-flight checklists for event sourcing, CQRS, sagas, outbox |
| [references/](references/) | Deep dives: orchestration, choreography, CDC, Kafka, RabbitMQ patterns |
| [examples/](examples/) | Complete examples: order saga, CQRS inventory, message queue integration |

## Related Skills

- `database-schema-designer` - Event store and read model schema design
- `sqlalchemy-2-async` - Async database session patterns
- `testing-patterns` - Comprehensive testing including integration testing
- `observability-monitoring` - Queue metrics and alerting
- `background-jobs` - Celery/ARQ task processing
- `streaming-api-patterns` - SSE/WebSocket real-time

---
title: Event-Driven Architecture Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Event Sourcing (sourcing) — HIGH — 3 rules

Store application state as immutable events rather than current state snapshots.

- `sourcing-event-store.md` — Append-only event store, optimistic concurrency, event versioning
- `sourcing-aggregates.md` — Event-sourced aggregates, apply/raise pattern, history loading
- `sourcing-projections.md` — Read model projections, snapshot strategies, schema upcasting

## 2. CQRS (cqrs) — HIGH — 3 rules

Separate read and write concerns for optimized data access.

- `cqrs-commands.md` — Command bus, command handlers, write model aggregates
- `cqrs-read-models.md` — Query handlers, denormalized views, event projections
- `cqrs-api-integration.md` — FastAPI endpoints, command/query dispatch, eventual consistency

## 3. Saga Patterns (saga) — HIGH — 3 rules

Maintain consistency across microservices without distributed locks.

- `saga-orchestration.md` — Central orchestrator, step execution, compensation logic
- `saga-choreography.md` — Event-driven choreography, distributed handlers, event routing
- `saga-recovery.md` — Timeout handling, retry with backoff, idempotent saga steps

## 4. Outbox Pattern (outbox) — HIGH — 2 rules

Ensure atomic state changes and event publishing via transactional outbox.

- `outbox-polling.md` — Outbox table schema, polling publisher, FOR UPDATE SKIP LOCKED
- `outbox-cdc.md` — Debezium CDC, idempotent consumer, Dapr outbox integration

## 5. Message Queues (queues) — MEDIUM — 3 rules

Asynchronous communication patterns for distributed systems.

- `queues-kafka.md` — aiokafka producer/consumer, partitions, consumer groups, exactly-once
- `queues-rabbitmq.md` — aio-pika exchanges, routing keys, DLQ retry patterns
- `queues-redis-postgres.md` — Redis Streams consumer groups, Postgres LISTEN/NOTIFY queue

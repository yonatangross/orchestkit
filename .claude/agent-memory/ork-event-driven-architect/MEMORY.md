# Event-Driven Architect Memory

## Fintech Payment Platform Patterns (Feb 2026)

### Choreography vs Orchestration Decision
- Pure choreography = no central orchestrator; services react to domain events
- Choreography excels at loose coupling and independent deployability
- Key risk: distributed debugging is harder without central saga log
- Use correlation IDs (trace-id propagated via Kafka headers) to reconstruct flows

### Kafka Configuration for Exactly-Once in Fintech
- `enable.idempotence=true` + `acks=all` + `transactional.id` per producer instance
- `isolation.level=read_committed` on consumers for exactly-once read semantics
- Partition by aggregate_id (payment_id) to preserve ordering within a payment
- PCI DSS zones: API Gateway -> PCI Zone -> Non-PCI Zone via separate Kafka clusters or ACL

### Outbox Pattern (Critical for Reliability)
- Write to outbox table in SAME transaction as business data (PostgreSQL)
- Separate outbox relay process polls with `SELECT ... FOR UPDATE SKIP LOCKED`
- Debezium CDC is the production-grade approach (avoids polling latency)
- Mark events with `published_at` timestamp, never delete from outbox (audit)

### CQRS Read Models for Payments
- Write model: PostgreSQL event store (append-only, partitioned by payment_id)
- Read model: PostgreSQL materialized views for payment status queries
- Elasticsearch for audit/compliance search (full-text, date-range queries)
- Redis for real-time payment status cache (TTL 300s, invalidate on state change)

### Fraud Detection Choreography Pattern
- FraudCheckRequested event triggers ML service (consumes from `payments.initiated`)
- ML service publishes FraudCheckCompleted (approved/rejected) to `fraud.decisions`
- Payment service consumes fraud decision and transitions state accordingly
- MongoDB stores ML feature vectors and fraud rules (flexible schema for models)

### Dead Letter Queue Config (Fintech)
- Max retries: 3 with exponential backoff (1s, 4s, 16s)
- DLQ retention: 30 days (PCI DSS audit requirement)
- Alert on DLQ depth > 0 (every DLQ message is a potential compliance issue)

### Idempotency (Non-Negotiable for Payments)
- Idempotency key = SHA256(client_id + payment_request_hash)
- Store in Redis (5min TTL for in-flight) + PostgreSQL (7 days for compliance)
- Return cached response on duplicate without reprocessing

## Skill References Used
- distributed-systems/rules/event-sourcing.md
- distributed-systems/rules/event-messaging.md

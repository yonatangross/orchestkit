# CDC with Debezium

Change Data Capture (CDC) with Debezium for high-throughput outbox publishing.

## When to Use CDC vs Polling

| Aspect | Polling | CDC (Debezium) |
|--------|---------|----------------|
| Throughput | ~10K msg/s | 100K+ msg/s |
| Latency | 1-5 seconds | Sub-second |
| Complexity | Simple | Requires Kafka Connect |
| Infrastructure | Just database | Kafka + Connect cluster |
| Debugging | Easy | More complex |

**Use CDC when:**
- Need sub-second latency
- Processing > 10K events/second
- Already running Kafka
- Building event sourcing system

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  App writes │ ──> │   Outbox    │ ──> │  Debezium   │
│  to outbox  │     │   Table     │     │  Connector  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Consumers  │ <── │   Kafka     │ <── │  Event      │
│             │     │   Topics    │     │  Router     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Setup

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    command:
      - "postgres"
      - "-c"
      - "wal_level=logical"  # Required for Debezium

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092

  debezium:
    image: debezium/connect:2.5
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: debezium-connect
      CONFIG_STORAGE_TOPIC: connect-configs
      OFFSET_STORAGE_TOPIC: connect-offsets
      STATUS_STORAGE_TOPIC: connect-status
    ports:
      - "8083:8083"
```

### Connector Configuration

```bash
# Register the outbox connector
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connector-config.json
```

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "secret",
    "database.dbname": "app",
    "database.server.name": "app",
    "plugin.name": "pgoutput",
    "publication.name": "outbox_publication",
    "table.include.list": "public.outbox",
    "tombstones.on.delete": "false",

    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.fields.additional.placement": "type:header:eventType",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.table.field.event.timestamp": "created_at",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.replacement": "${routedByValue}-events"
  }
}
```

### PostgreSQL Setup

```sql
-- Create publication for logical replication
CREATE PUBLICATION outbox_publication FOR TABLE outbox;

-- Create replication slot
SELECT pg_create_logical_replication_slot('debezium', 'pgoutput');

-- Grant permissions to debezium user
GRANT USAGE ON SCHEMA public TO debezium;
GRANT SELECT ON outbox TO debezium;
GRANT USAGE ON SEQUENCE outbox_id_seq TO debezium;
```

## Outbox Table for Debezium

```sql
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,  -- Event type
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debezium reads and deletes, so add index for cleanup
CREATE INDEX idx_outbox_created ON outbox(created_at);
```

## Event Router Configuration

The `EventRouter` transform routes events to topics based on `aggregate_type`:

| aggregate_type | Topic |
|----------------|-------|
| Order | `order-events` |
| Customer | `customer-events` |
| Payment | `payment-events` |

## Monitoring

```bash
# Check connector status
curl http://localhost:8083/connectors/outbox-connector/status

# Check tasks
curl http://localhost:8083/connectors/outbox-connector/tasks

# Restart failed task
curl -X POST http://localhost:8083/connectors/outbox-connector/tasks/0/restart
```

## Cleanup Strategy

With CDC, rows can be deleted after capture:

```sql
-- Delete old captured rows (run periodically)
DELETE FROM outbox
WHERE created_at < NOW() - INTERVAL '1 hour';
```

Or use a background job to clean up.

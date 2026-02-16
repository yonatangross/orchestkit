---
title: "Versioning: Changelog & Audit Trails"
category: versioning
impact: HIGH
impactDescription: Schema version tracking provides full traceability and audit compliance. Missing version history makes rollbacks dangerous and debugging impossible.
tags: [versioning, changelog, audit-trail, cdc, temporal-tables, semantic-versioning]
---

# Versioning Changelog & Audit Trails

## Schema Version Table

```sql
CREATE TABLE schema_version (
    version_id SERIAL PRIMARY KEY,
    version_number VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(100),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    CONSTRAINT uq_version_number UNIQUE (version_number)
);
```

## Semantic Versioning for Databases

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (drop tables, rename columns)
MINOR: Backward-compatible additions (new tables, nullable columns)
PATCH: Bug fixes, index changes, data migrations
```

## Row-Level Versioning

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL,
    updated_by VARCHAR(100)
);

CREATE INDEX idx_products_current ON products (id) WHERE is_current = TRUE;
CREATE INDEX idx_products_temporal ON products (id, valid_from, valid_to);
```

## Change Data Capture (CDC)

```sql
CREATE TABLE change_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by VARCHAR(100),
    transaction_id BIGINT DEFAULT txid_current()
);

CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (table_name, operation, record_id, new_data, changed_by)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, to_jsonb(NEW), current_user);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO change_log (table_name, operation, record_id, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW), current_user);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (table_name, operation, record_id, old_data, changed_by)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, to_jsonb(OLD), current_user);
    END IF;
    RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
```

## Audit Pattern Decision Matrix

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Row-level versioning | Simple history needs | Low |
| Temporal tables | Point-in-time queries | Medium |
| CDC (change_log) | Full audit compliance | High |

## Object Versioning

```sql
-- Versioned views
CREATE VIEW orders_summary_v1 AS SELECT order_id, customer_id, total FROM orders;
CREATE VIEW orders_summary_v2 AS SELECT order_id, customer_id, total, shipping_cost FROM orders;
CREATE VIEW orders_summary AS SELECT * FROM orders_summary_v2;  -- Current alias
```

**Incorrect — Mutable audit log:**
```sql
-- Allows modification/deletion of history
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action TEXT,
  changed_at TIMESTAMP
);
-- Missing: Triggers, permissions to prevent changes
```

**Correct — Immutable audit trail:**
```sql
-- Append-only with JSONB for full history
CREATE TABLE change_log (
  id BIGSERIAL PRIMARY KEY,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);
REVOKE DELETE, UPDATE ON change_log FROM app_user;
```

## Best Practices

| Practice | Reason |
|----------|--------|
| Version everything | Full traceability |
| Immutable history | Audit compliance |
| Checksum verification | Detect unauthorized changes |
| Semantic versioning | Clear impact communication |

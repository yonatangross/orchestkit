# Database Audit Trail Patterns

## Row-Level Versioning

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,

    -- Versioning columns
    version INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit columns
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by VARCHAR(100)
);

-- Index for current records
CREATE INDEX idx_products_current ON products (id) WHERE is_current = TRUE;

-- Index for temporal queries
CREATE INDEX idx_products_temporal ON products (id, valid_from, valid_to);
```

## Temporal Tables (PostgreSQL 15+)

```sql
-- Enable temporal tables extension
CREATE EXTENSION IF NOT EXISTS temporal_tables;

-- Create temporal table
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    sys_period TSTZRANGE NOT NULL DEFAULT tstzrange(NOW(), NULL)
);

-- History table
CREATE TABLE products_history (LIKE products);

-- Trigger for automatic versioning
CREATE TRIGGER versioning_trigger
BEFORE INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION versioning(
    'sys_period', 'products_history', true
);

-- Query at a point in time
SELECT * FROM products
WHERE sys_period @> '2026-01-15 10:00:00+00'::timestamptz;
```

## Change Data Capture (CDC)

```sql
-- CDC table for tracking all changes
CREATE TABLE change_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by VARCHAR(100),
    transaction_id BIGINT DEFAULT txid_current()
);

-- Generic trigger function
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (table_name, operation, record_id, new_data, changed_by)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO change_log (table_name, operation, record_id, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (table_name, operation, record_id, old_data, changed_by)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, to_jsonb(OLD), current_user);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER products_audit
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION log_changes();
```

## Decision Matrix

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Row-level versioning | Simple history needs | Low |
| Temporal tables | Point-in-time queries | Medium |
| CDC | Full audit compliance | High |

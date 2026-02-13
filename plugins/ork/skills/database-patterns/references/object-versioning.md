# Database Object Versioning

## Stored Procedure Versioning

```sql
-- Version tracking for stored procedures
CREATE TABLE procedure_versions (
    id SERIAL PRIMARY KEY,
    procedure_name VARCHAR(200) NOT NULL,
    version VARCHAR(20) NOT NULL,
    definition TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    is_current BOOLEAN DEFAULT TRUE,

    CONSTRAINT uq_procedure_version UNIQUE (procedure_name, version)
);

-- Before updating a procedure, archive it
INSERT INTO procedure_versions (procedure_name, version, definition, created_by)
SELECT
    'calculate_order_total',
    '1.0.0',
    pg_get_functiondef(oid),
    current_user
FROM pg_proc
WHERE proname = 'calculate_order_total';
```

## View Versioning

```sql
-- Versioned views with _v1, _v2 naming
CREATE VIEW orders_summary_v1 AS
SELECT order_id, customer_id, total
FROM orders;

CREATE VIEW orders_summary_v2 AS
SELECT order_id, customer_id, total, shipping_cost, tax
FROM orders;

-- Current version alias
CREATE VIEW orders_summary AS
SELECT * FROM orders_summary_v2;
```

## Reference Data Versioning

```python
"""Reference data migration with versioning."""
from alembic import op
from sqlalchemy.sql import table, column
import sqlalchemy as sa

revision = 'ref001'

status_codes = table(
    'status_codes',
    column('code', sa.String),
    column('name', sa.String),
    column('description', sa.String),
    column('version', sa.Integer),
    column('is_active', sa.Boolean)
)

def upgrade():
    # Deactivate old version
    op.execute(
        status_codes.update()
        .where(status_codes.c.version == 1)
        .values(is_active=False)
    )

    # Insert new version
    op.bulk_insert(status_codes, [
        {'code': 'PENDING', 'name': 'Pending', 'version': 2, 'is_active': True},
        {'code': 'PROCESSING', 'name': 'Processing', 'version': 2, 'is_active': True},
        {'code': 'COMPLETED', 'name': 'Completed', 'version': 2, 'is_active': True},
        {'code': 'FAILED', 'name': 'Failed', 'version': 2, 'is_active': True},
    ])

def downgrade():
    op.execute(status_codes.delete().where(status_codes.c.version == 2))
    op.execute(status_codes.update().where(status_codes.c.version == 1).values(is_active=True))
```

## Versioning Strategy

| Object Type | Strategy | Notes |
|-------------|----------|-------|
| Procedures | Version table | Archive before update |
| Views | _v1, _v2 naming | Alias for current |
| Reference data | Version column | Soft delete old |

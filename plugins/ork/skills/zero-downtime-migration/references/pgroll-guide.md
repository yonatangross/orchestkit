# pgroll Guide

pgroll automates the expand-contract pattern for PostgreSQL zero-downtime migrations.

## Installation

```bash
# macOS
brew install xataio/pgroll/pgroll

# Go install
go install github.com/xataio/pgroll@latest

# Docker
docker pull xataio/pgroll
```

## Initialize

```bash
# Initialize pgroll in your database
pgroll init --postgres-url "postgres://user:pass@localhost:5432/mydb"

# This creates:
# - pgroll schema with migration tracking tables
# - Required functions and triggers
```

## Migration Files

Create JSON migration files in a `migrations/` directory:

```json
{
  "name": "001_create_users",
  "operations": [
    {
      "create_table": {
        "name": "users",
        "columns": [
          {"name": "id", "type": "uuid", "pk": true, "default": "gen_random_uuid()"},
          {"name": "email", "type": "varchar(255)", "unique": true},
          {"name": "created_at", "type": "timestamptz", "default": "now()"}
        ]
      }
    }
  ]
}
```

## Running Migrations

```bash
# Start migration (creates versioned schema view)
pgroll start migrations/001_create_users.json

# During migration:
# - Old app uses: SET search_path TO public
# - New app uses: SET search_path TO public_001_create_users

# After verification, complete migration
pgroll complete

# If issues, rollback
pgroll rollback
```

## Common Operations

### Add Column

```json
{
  "name": "002_add_phone",
  "operations": [
    {
      "add_column": {
        "table": "users",
        "column": {
          "name": "phone",
          "type": "varchar(20)",
          "nullable": true
        }
      }
    }
  ]
}
```

### Add Column with Backfill

```json
{
  "name": "003_add_full_name",
  "operations": [
    {
      "add_column": {
        "table": "users",
        "column": {
          "name": "full_name",
          "type": "varchar(200)",
          "nullable": false,
          "default": "''"
        },
        "up": "CONCAT(first_name, ' ', last_name)",
        "down": "first_name"
      }
    }
  ]
}
```

### Rename Column

```json
{
  "name": "004_rename_email",
  "operations": [
    {
      "rename_column": {
        "table": "users",
        "from": "email",
        "to": "email_address"
      }
    }
  ]
}
```

### Add Index

```json
{
  "name": "005_add_index",
  "operations": [
    {
      "create_index": {
        "table": "users",
        "name": "idx_users_email",
        "columns": ["email"],
        "method": "btree"
      }
    }
  ]
}
```

### Change Column Type

```json
{
  "name": "006_widen_phone",
  "operations": [
    {
      "alter_column": {
        "table": "users",
        "column": "phone",
        "type": "varchar(50)",
        "up": "phone",
        "down": "LEFT(phone, 20)"
      }
    }
  ]
}
```

## How It Works

1. **Start**: Creates new schema version with triggers for dual-writes
2. **Migration Active**: Both old and new schema versions work simultaneously
3. **Complete**: Drops old schema, keeps new as default
4. **Rollback**: Drops new schema, reverts to old

```
┌─────────────────────────────────────────────────────────────┐
│                    pgroll Migration Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  pgroll start            pgroll complete                     │
│       │                       │                              │
│       ▼                       ▼                              │
│  ┌─────────┐            ┌─────────┐            ┌─────────┐  │
│  │ public  │  ────────> │ public  │  ────────> │ public  │  │
│  │ (old)   │            │ + new   │            │ (new)   │  │
│  └─────────┘            └─────────┘            └─────────┘  │
│                              │                              │
│                         Dual-write                          │
│                         via triggers                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Test locally first**: Run against local database copy
2. **Small migrations**: One logical change per migration
3. **Monitor during active**: Check for errors, performance
4. **Set timeouts**: Don't leave migrations active indefinitely
5. **Backup before start**: In case of unexpected issues

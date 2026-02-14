# Database Migration Paths

Common migration scenarios, tools, and risk assessment.

## Migration Risk Matrix

| Migration | Difficulty | Risk | Downtime | Typical Duration |
|-----------|-----------|------|----------|-----------------|
| SQLite to PostgreSQL | Low | Low | Minutes | 1-2 days dev work |
| MongoDB to PostgreSQL | Medium-High | Medium | Hours (with planning) | 1-4 weeks |
| MySQL to PostgreSQL | Medium | Low-Medium | Hours | 1-2 weeks |
| PostgreSQL to PostgreSQL (version upgrade) | Low | Low | Minutes (pg_upgrade) | Hours |
| Single PostgreSQL to read replicas | Low | Low | Near-zero | 1-2 days |
| Redis cache swap (e.g., to Valkey) | Low | Low | Minutes | 1 day |

## SQLite to PostgreSQL

The most common migration path for growing projects.

**When**: App outgrows single-user/embedded model and needs concurrent writes.

**Steps**:
1. Install PostgreSQL and create target database
2. Use `pgloader` (recommended) for automated schema + data migration
3. Update connection string and ORM configuration
4. Replace SQLite-specific syntax (e.g., `AUTOINCREMENT` to `SERIAL`)
5. Add connection pooling (PgBouncer for production)
6. Test concurrent write scenarios

**Tools**: `pgloader` (handles schema conversion automatically), `sqlite3 .dump` + manual SQL cleanup.

**Common gotchas**:
- SQLite `INTEGER PRIMARY KEY` is auto-increment; PostgreSQL needs `SERIAL` or `GENERATED ALWAYS AS IDENTITY`
- SQLite has loose typing; PostgreSQL enforces column types strictly
- Date/time handling differs — SQLite stores as text, PostgreSQL has native types

## MongoDB to PostgreSQL

The most impactful migration. Plan carefully.

**When**: Team realizes relational queries, JOINs, or ACID transactions are needed.

**Strategy**:

1. **Schema mapping**: Map each collection to a table. For truly variable documents, use a typed columns + JSONB hybrid:
   ```sql
   CREATE TABLE products (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       name TEXT NOT NULL,
       category TEXT NOT NULL,
       price NUMERIC(10,2) NOT NULL,
       metadata JSONB  -- Variable fields go here
   );
   ```

2. **Data extraction**: `mongoexport --jsonArray` per collection, transform with scripts, load with `COPY`

3. **Query rewriting**: Convert aggregation pipelines to SQL
   - `$match` becomes `WHERE`
   - `$group` becomes `GROUP BY`
   - `$lookup` becomes `JOIN`
   - `$unwind` becomes `LATERAL JOIN` or `jsonb_array_elements`

4. **Dual-write period**: Write to both databases during transition, read from PostgreSQL, compare results

5. **Cutover**: Switch reads to PostgreSQL, decommission MongoDB

**Tools**: `mongoexport`, custom ETL scripts (Python recommended), `pgloader` (limited MongoDB support).

**Risk mitigations**:
- Run dual-write for at least 1 week in production
- Compare query results between both databases automatically
- Keep MongoDB running (read-only) for 30 days post-migration as rollback

## MySQL to PostgreSQL

**When**: Need advanced features (JSONB, CTEs, window functions, extensions) or better standards compliance.

**Steps**:
1. Use `pgloader` for automated migration (handles most type conversions)
2. Review and fix: `ENUM` types, `UNSIGNED` integers, `AUTO_INCREMENT` to `SERIAL`
3. Replace MySQL-specific functions (`IFNULL` to `COALESCE`, `LIMIT x,y` to `LIMIT y OFFSET x`)
4. Update stored procedures (PL/pgSQL syntax differs from MySQL procedures)

**Tools**: `pgloader` (best option), AWS DMS (for RDS-to-RDS), `mysqldump` + manual conversion.

## Adding Read Replicas (PostgreSQL)

**When**: Read-heavy workload saturates primary, measured (not assumed).

**Steps**:
1. Set up streaming replication (`primary_conninfo` in `recovery.conf` / `postgresql.auto.conf`)
2. Configure application for read/write splitting (write to primary, read from replica)
3. Handle replication lag in application logic (eventual consistency for reads)

**Tools**: Built-in streaming replication, Patroni (HA), PgBouncer (connection routing).

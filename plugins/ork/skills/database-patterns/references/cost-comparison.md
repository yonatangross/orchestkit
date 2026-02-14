# Database Cost Comparison

Hosting and operational cost analysis to inform database selection decisions.

## Managed Hosting Costs (Approximate Monthly)

| Provider | PostgreSQL | MongoDB | Redis |
|----------|-----------|---------|-------|
| **Free tier** | Supabase, Neon, Render | Atlas M0 (512 MB) | Upstash (10K cmds/day) |
| **Hobby ($5-25)** | Supabase Pro ($25), Railway ($5+), Render ($7+) | Atlas M10 ($57+) | Upstash Pay-as-go, Redis Cloud ($5+) |
| **Production ($50-200)** | Supabase Pro, RDS db.t3.medium (~$65), Cloud SQL (~$50) | Atlas M30 ($230+) | ElastiCache t3.small (~$25), Memorystore (~$35) |
| **Scale ($200-1000)** | RDS db.r6g.large (~$200), Aurora (~$250) | Atlas M50 ($500+) | ElastiCache r6g.large (~$150) |

Key takeaway: **MongoDB managed hosting costs 2-3x more than PostgreSQL** at equivalent tiers. MongoDB Atlas pricing reflects the vendor lock-in premium.

## License Considerations

| Database | License | Impact |
|----------|---------|--------|
| PostgreSQL | PostgreSQL License | Fully permissive. Host anywhere, modify freely. |
| MongoDB | SSPL | Cannot offer MongoDB as a managed service. Limits cloud provider hosting options. |
| Redis | RSALv2 + SSPLv1 (since 2024) | Source-available but not OSS. Alternatives: Valkey (Linux Foundation fork), KeyDB, DragonflyDB. |
| SQLite | Public Domain | Zero restrictions. Embedded in everything. |

## Operational Complexity

| Factor | PostgreSQL | MongoDB | Redis | SQLite |
|--------|-----------|---------|-------|--------|
| Backup/restore | pg_dump, pg_basebackup, WAL archiving | mongodump, oplog | RDB snapshots, AOF | File copy |
| Monitoring | pg_stat_statements, pgBadger | Atlas monitoring, mongotop | redis-cli INFO, RedisInsight | N/A |
| Scaling reads | Read replicas (simple) | Replica sets (moderate) | Redis Cluster (moderate) | N/A |
| Scaling writes | Partitioning, Citus (moderate) | Sharding (complex) | Redis Cluster (moderate) | N/A |
| Team expertise needed | Moderate (widely known) | Moderate (less common) | Low (simple API) | Minimal |
| Connection pooling | PgBouncer (essential at scale) | Built-in driver pooling | Built-in | N/A |

## Total Cost of Ownership Factors

Beyond hosting, consider:

1. **Developer time**: PostgreSQL has more tutorials, Stack Overflow answers, and ORM support than any alternative
2. **Hiring**: PostgreSQL/SQL skills are universal; MongoDB-specific expertise is niche
3. **Migration cost**: Starting with PostgreSQL avoids expensive future migrations
4. **Extension ecosystem**: PostGIS, pgvector, TimescaleDB, pg_cron are free — equivalent MongoDB features require paid Atlas tiers
5. **Vendor lock-in**: MongoDB Atlas features (Atlas Search, Charts, App Services) don't transfer to self-hosted

## Budget Decision Tree

```
Budget = $0?
  YES --> SQLite (embedded) or Supabase/Neon free tier (managed Postgres)
  NO  -->

Budget < $50/mo?
  YES --> Managed PostgreSQL (Supabase, Railway, Render)
  NO  -->

Budget < $500/mo?
  YES --> PostgreSQL (managed) + Redis (Upstash or small ElastiCache)
  NO  -->

Budget $500+/mo?
  YES --> PostgreSQL (RDS/Aurora/Cloud SQL) + Redis + purpose-built stores as needed
```

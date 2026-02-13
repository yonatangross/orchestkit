---
title: Database Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Alembic Migrations (alembic) — CRITICAL — 3 rules

Migration management with Alembic for SQLAlchemy 2.0 async applications.

- `alembic-autogenerate.md` — Auto-generate from models, async env.py, review SQL, apply/rollback
- `alembic-data-migration.md` — Batch backfill, two-phase NOT NULL, zero-downtime index, CONCURRENTLY
- `alembic-branching.md` — Feature branches, merge migrations, conflict resolution, multi-database

## 2. Schema Design (schema) — HIGH — 3 rules

SQL and NoSQL schema design with normalization, indexing, and constraint patterns.

- `schema-normalization.md` — 1NF-3NF, denormalization triggers, JSON vs normalized tables
- `schema-indexing.md` — B-tree, GIN, HNSW, partial/covering indexes, composite column order
- `schema-nosql.md` — Embed vs reference, document sizing, sharding, schema validation

## 3. Versioning (versioning) — HIGH — 3 rules

Database version control and change management across environments.

- `versioning-changelog.md` — Schema version table, semantic versioning, audit trails, CDC
- `versioning-rollback.md` — Rollback testing, destructive rollback docs, data integrity verification
- `versioning-drift.md` — Environment sync, checksum verification, advisory locks, migration ordering

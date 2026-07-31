---
title: Database Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Alembic Migrations (alembic) — CRITICAL — 2 rules

Migration management with Alembic for SQLAlchemy 2.0 async applications.
Autogenerate setup is upstream (see the "Upstream coverage" table in SKILL.md);
our one deviation from the async env.py template is in `references/ork-delta.md`.

- `alembic-data-migration.md` — Batch backfill, two-phase NOT NULL, zero-downtime index, CONCURRENTLY
- `alembic-branching.md` — Feature branches, merge migrations, conflict resolution, multi-database

## 2. Schema Design (schema) — HIGH — 3 rules

SQL and NoSQL schema design with normalization, indexing, and constraint patterns.

- `schema-normalization.md` — 1NF-3NF, denormalization triggers, JSON vs normalized tables
- `schema-indexing.md` — B-tree, GIN, HNSW, partial/covering indexes, composite column order
- `schema-nosql.md` — Embed vs reference, document sizing, sharding, schema validation

## 3. Versioning (versioning) — HIGH — 2 rules

Database version control and change management across environments. Rollback
testing moved to `references/migration-testing.md`; the lossy-downgrade docstring
convention is in `references/ork-delta.md`.

- `versioning-changelog.md` — Schema version table, semantic versioning, audit trails, CDC
- `versioning-drift.md` — Environment sync, checksum verification, advisory locks, migration ordering

## 4. Zero-Downtime Migration (migration) — CRITICAL — 2 rules

Safe database schema changes without downtime using expand-contract pattern and pgroll automation.

| Rule | Impact | File |
|------|--------|------|
| Zero-Downtime Migration Patterns | CRITICAL | `migration-zero-downtime.md` |
| Migration Rollback and Monitoring | HIGH | `migration-rollback.md` |

## 5. Database Selection (selection) — HIGH — 1 rule

Decision frameworks for choosing the right database technology.

- `db-selection.md` — PostgreSQL-first default, tier matrix, data model matrix, anti-patterns (MongoDB hype, premature sharding)

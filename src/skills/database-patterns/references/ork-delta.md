# OrchestKit delta: database-patterns

What this skill knows that upstream docs do not. Everything else (normal forms,
Alembic command syntax, PostgreSQL index types, generic migration checklists) is
vendor documentation and was removed; see the "Upstream coverage" table in
`SKILL.md` for where each removed topic now lives.

## Guard the async Alembic env.py with in_greenlet() before calling asyncio.run()

Why: this skill shipped a bare `asyncio.run(run_async_migrations())` in its
`env.py` template until PR #2143 (commit e4854df83) replaced it with an
`in_greenlet()` branch that calls `await_only()` instead. Driving `alembic
upgrade` from inside an already-running loop (a FastAPI lifespan hook is the
common case) raises "loop already running" with the bare form. Import both names
from `sqlalchemy.util.concurrency`.

Upstream: https://alembic.sqlalchemy.org/en/latest/cookbook.html

## Read PG18 WITHOUT OVERLAPS as a uniqueness constraint, never as row history

Why: this skill's audit-trail guidance was headed "Temporal Tables (PostgreSQL
15+)" and conflated two different features until PR #2143 (commit e4854df83)
split them. PG18 native `PRIMARY KEY ... WITHOUT OVERLAPS` and `FOREIGN KEY ...
PERIOD` give temporal uniqueness and referential integrity only. They do not
capture system-versioned history, which still needs the `temporal_tables`
extension. The native constraints are GiST backed, so a range column sharing a
primary key with scalar columns also needs `CREATE EXTENSION btree_gist`.

Upstream: https://www.postgresql.org/docs/18/sql-createtable.html

## Never present a concrete database schema as OrchestKit's own

Why: the retired `orchestkit-database-schema.md` example documented `analyses`,
`artifacts`, `analysis_chunks` and `agent_findings` tables as "the OrchestKit
schema" and sourced two columns to "Issue #244 (Handle Pattern)" and "Issue
#220 (PII)". In this repo `gh issue view 244` returns "feat(ci): cross-platform
CI with Node 20/22/24 matrix" and `gh issue view 220` returns "feat(#212): CC
2.1.19 full modernization", and the tree contains no `alembic.ini` and no
`env.py`. OrchestKit is a Claude Code plugin with no database, so that schema and
its issue trail came from a different project. Write examples as generic, or cite
a file path that exists.

Upstream: https://github.com/pgvector/pgvector (first-party home of the pgvector
and HNSW patterns that file was actually teaching)

## Spell out data loss in the migration docstring when downgrade cannot restore it

Why: house documentation convention, distilled from the retired
`versioning-rollback.md` rule; no traced incident. A `downgrade()` that drops a
table the upgrade split data into is not reversible, and the only place a
reviewer reliably reads before running `alembic downgrade` is the revision
docstring. `SKILL.md` already forbids an empty `downgrade()`; this rule covers the
case where a correct `downgrade()` still destroys data. Rollback and data
integrity test harnesses live in `${CLAUDE_SKILL_DIR}/references/migration-testing.md`.

Upstream: https://alembic.sqlalchemy.org/en/latest/tutorial.html

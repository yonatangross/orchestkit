---
title: Record architecture decisions in structured ADRs with status lifecycle
impact: HIGH
impactDescription: "Without ADRs, teams forget why decisions were made and repeat costly debates"
tags: [adr, architecture, decisions, traceability]
---

## Architecture Decision Records

ADRs capture the context, decision, and consequences of significant architectural choices. They prevent "why did we do this?" conversations months later.

**Incorrect -- informal decision buried in a Slack message or meeting note:**
```markdown
## Meeting Notes 2026-02-15

We talked about the database and decided to go with PostgreSQL because
it seemed like a good fit. John mentioned MongoDB but we didn't think
it would work. Moving on.
```

**Correct -- structured ADR with full context:**
```markdown
# ADR-003: Use PostgreSQL for Primary Data Store

## Status

Accepted (2026-02-15)

## Context

The application requires ACID transactions for financial data, complex
joins across 12+ entity types, and full-text search. The team has
production experience with PostgreSQL but not MongoDB. Expected data
volume is 50M rows in year one with 200 concurrent connections.

## Decision

Use PostgreSQL 16 as the primary data store with the following configuration:
- Connection pooling via PgBouncer (max 200 connections)
- Read replicas for reporting queries
- pg_trgm extension for full-text search

We rejected MongoDB because:
- Financial data requires ACID transactions across collections
- Complex joins would require denormalization and data duplication
- Team has no production MongoDB experience

## Consequences

### Positive
- Strong ACID guarantees for financial transactions
- Rich query capabilities (CTEs, window functions, JSON)
- Team expertise reduces ramp-up time
- Mature ecosystem (monitoring, backup, replication)

### Negative
- Horizontal scaling requires careful partitioning strategy
- Schema migrations need coordination across services
- Connection pooling adds operational complexity

## References

- [PostgreSQL 16 Release Notes](https://www.postgresql.org/docs/16/release-16.html)
- Slack thread: #arch-decisions 2026-02-10
- Benchmark results: docs/benchmarks/db-comparison.md
```

**Key rules:**
- File naming: `docs/adr/ADR-NNN-kebab-case-title.md` with sequential numbering
- Status lifecycle: Proposed > Accepted > Deprecated > Superseded by ADR-X
- Context must include constraints, requirements, and team capabilities
- Decision must state what was chosen AND what was rejected with reasons
- Consequences must list both positive and negative outcomes
- Never delete ADRs -- mark superseded and link to the replacement
- Keep ADRs immutable after acceptance (append amendments, don't edit)

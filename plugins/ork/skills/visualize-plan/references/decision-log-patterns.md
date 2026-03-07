# Decision Log Patterns

ADR-lite format for documenting non-obvious choices in a plan.

## When to Document a Decision

Document when ANY of these apply:
- Multiple valid approaches exist and one was chosen over others
- The choice has a meaningful tradeoff (something is gained AND lost)
- Future developers would ask "why was it done this way?"
- The decision constrains future options

Do NOT document:
- Obvious choices ("we need a table for invoices")
- Implementation details ("use for loop vs map")
- Forced choices (only one option exists)

## Standard Decision Entry

```
#1: Use graph-only memory instead of dual-write
    Context:      Current system writes to 3 tiers (graph + .jsonl + mem0 cloud).
                  Only graph tier is used by 98% of queries.
    Decision:     Remove .jsonl and mem0 cloud tiers. Write only to graph + CC native.
    Alternatives: [a] Keep mem0 as optional   -> still 14K lines of code to maintain
                  [b] Abstract behind interface -> over-engineering for 2% usage
    Tradeoff:     + 14K lines removed, 39 Python scripts gone, zero external deps
                  - Lose cloud semantic search (affects cross-session pattern matching)
    Confidence:   HIGH (usage data confirms <2% mem0 queries)
```

## Compact Decision Entry

For plans with many small decisions:

```
DECISIONS

#1  Graph-only memory (not dual-write)
    + 14K lines removed  - lose cloud search  | Confidence: HIGH

#2  Delete queue processor (not simplify)
    + no background jobs  - no retry on write failure  | Confidence: HIGH

#3  Keep decision-flow-tracker (not delete)
    + behavioral intelligence preserved  - 200 lines to maintain  | Confidence: MEDIUM
```

## Decision with Alternatives Matrix

When comparing 3+ options:

```
DECISION: Memory write strategy

+=================+===========+==========+========+==========+
| Option          | Lines     | Ext Deps | Speed  | Coverage |
+=================+===========+==========+========+==========+
| Graph-only  [X] | -14,100   | 0        | Fast   | 98%      |
| Dual-write      | -0        | 1 (mem0) | Medium | 100%     |
| Abstract layer  | +500      | 0        | Medium | 100%     |
+-----------------+-----------+----------+--------+----------+

[X] = Selected option
Rationale: 14K line reduction outweighs 2% coverage gap.
           Cloud search can be re-added later if needed (additive change).
```

## Decision Chain (dependent decisions)

When one decision forces subsequent decisions:

```
DECISION CHAIN

#1  Remove mem0 cloud tier
    |
    +-> #2  Delete 39 Python scripts (no longer needed)
    |
    +-> #3  Delete queue processor (only existed for mem0 retry)
    |
    +-> #4  Simplify memory-writer.ts (remove 3-tier fallback)
    |
    +-> #5  Remove MEM0_API_KEY from CI/CD (no longer used)

Root decision: #1
Cascade: 4 follow-on decisions, all lower risk than root
```

## Reversible vs Irreversible Decisions

Flag decisions by how hard they are to undo:

```
DECISION LOG

#1  [REVERSIBLE]   Use PostgreSQL for billing data
    Can migrate to another DB later. Schema is the contract, not the engine.

#2  [REVERSIBLE]   REST over GraphQL for billing API
    Can add GraphQL layer later without changing REST endpoints.

#3  [IRREVERSIBLE] Store amounts in cents (integer) not dollars (float)
    All downstream systems will depend on integer representation.
    Changing later requires data migration across all consumers.
```

# Memory Rules Index

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [entity-extraction-patterns](entity-extraction-patterns.md) | HIGH | Entity types, relation types, graph query semantics |
| [deduplication-strategy](deduplication-strategy.md) | HIGH | Edit-over-Write pattern, anchor-based insertion, verification |
| [duplicate-entity-detection](duplicate-entity-detection.md) | HIGH | Remember verb: search for an existing entity (80%+ name match, same type) before creating; merge instead of duplicate |
| [entity-relationship-validation](entity-relationship-validation.md) | HIGH | Remember verb: validate entity types and relation types against the allowed schema before writing |
| [observation-quality-gate](observation-quality-gate.md) | MEDIUM | Remember verb: every observation carries a concrete metric, version or condition; reject vague labels |

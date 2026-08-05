---
title: "RAG retrieval: the OrchestKit delta"
tags: [rag, retrieval, search, eval, delta]
---

# OrchestKit delta: RAG retrieval

Embedding-model choice, chunking algorithms, vector-index tuning, reranker APIs
and the query-rewriting literature are vendor and upstream territory. See the
"Upstream coverage (do not restate)" table in `SKILL.md` for where each lives.
This file carries only what OrchestKit adds, contradicts, or has to warn about.

`SKILL.md` referenced this file three times before it existed, so a reader
following the instruction got nothing. Created 2026-08-05 while fixing that
class of dangling reference repo-wide.

## Retrieval latency budget: p95 under 500ms end to end

Source: `checklists/rag-quality.md:57`, the only retrieval budget this skill has
ever actually asserted. It covers the whole path a user waits on — embed the
query, search, rerank, assemble context — not one stage in isolation. A pipeline
that clears 500ms per stage and blows it in aggregate has failed this budget.

Measure at p95, not mean. Retrieval latency is dominated by tail behaviour
(cold index shards, reranker queueing), and a mean hides exactly the requests
users complain about.

## Quality floors are NOT SET, and that is deliberate

`SKILL.md` promises "the pass-rate, precision, recall, MRR, and per-stage
latency floors a retrieval change has to clear". **Those numbers do not exist.**
They were never measured, and they are not written down anywhere in this skill.

They are left unset rather than filled in with plausible-looking values, because
a threshold nobody measured is worse than an absent one: it gets cited in review
as though it means something, and it fails or passes changes for no defensible
reason. `test-cases.json` carries 30 cases and is the right substrate for
establishing real floors — a baseline run over those cases would produce
defensible numbers, and this section should be replaced with them.

Until then, do not quote a precision, recall, or MRR floor for this skill. There
isn't one.

## Corpus-specific tuning does not transfer

Fusion weights, rerank depth and hybrid alpha are properties of a corpus, not of
the technique. A weighting that lifts recall on prose documentation regularly
hurts it on code or tabular data, so values copied between projects are noise
rather than a starting point. Re-derive them per corpus against that corpus's
own eval set.

## Related

- `test-cases.json` — 30 cases across the skill's categories
- `checklists/rag-quality.md` — the review checklist, and the source of the
  500ms budget above

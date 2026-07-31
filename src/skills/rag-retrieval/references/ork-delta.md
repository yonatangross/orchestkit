# RAG Retrieval: house delta

Thresholds we measured, ordering constraints we hit, and budgets we assert in tests.
Everything else is vendor documentation, linked from the "Upstream coverage (do not
restate)" table in `SKILL.md`. None of the retired files carried an issue or PR
reference, so no entry below is pinned to a traced incident; each names the file it was
distilled from.

## Apply metadata boosting after RRF fusion, never before

Why: boost factors multiply onto the RRF score of an already-fused result set and the list is then re-sorted, using section-title match 1.5x, section-path match 1.15x, and code block on a technical query 1.2x; boosting per-method scores before fusion destroys the property RRF depends on (it fuses by rank, not by score) and lets a lone strong keyword hit outrank a document both methods agreed on, and this exact order is what produced the +6% MRR credited to boosting in `rules/pgvector-metadata.md` (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles

## Stop raising the RRF fetch multiplier past 3x

Why: measured pass rate on the reference corpus went 87.2% at 1x, 89.5% at 2x, 91.1% at 3x, 91.3% at 4x, so the fourth multiple bought 0.2 points for a third more rows scanned per method, which is why 3x is the house default hard-coded in `rules/core-hybrid-search.md` and `rules/pgvector-hybrid-search.md`; raise it only with a golden-set number that beats this curve (distilled from the retired examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion

## Gate every retrieval change on the golden-set thresholds

Why: the house bar before a retrieval change ships is pass rate at least 90% on the golden query set, precision@10 at least 0.70, recall@10 at least 0.85, and MRR at least 0.65, floors set just under the reference pipeline's observed 91.6% pass rate and 0.777 overall MRR (0.695 on the hard slice) so that a real regression trips them instead of a noisy run (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: ork skill `golden-dataset`

## Assert search latency per stage, not just end to end

Why: the integration test asserts vector search under 100ms, keyword search under 50ms, and fused hybrid under 150ms separately, against an observed 415-chunk baseline of P50 15ms / P95 32ms / P99 62ms, because a single total-latency assertion stays green while one stage silently doubles, which is precisely the shape of an index that quietly stopped being used (distilled from the retired checklists/search-implementation-checklist.md and examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://www.postgresql.org/docs/current/using-explain.html

## Budget the embedding call before tuning the index

Why: in the reference measurement the query embedding was P50 8ms of a 15ms end-to-end search against 2ms for vector search and 3ms for keyword search, and it was the throughput ceiling at roughly 120 requests per second, so cache and batch embeddings first because index tuning below that ceiling moves the total by single-digit percent (distilled from the retired examples/examples/orchestkit-retrieval.md; no traced incident).
Upstream: https://docs.voyageai.com/docs/embeddings

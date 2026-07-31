# Performance Skill: OrchestKit Delta

Ork-specific floors, scars, and house decisions for `src/skills/performance`.
Vendor mechanics (CWV tuning, image pipelines, profiling tool walkthroughs,
vLLM internals) are deliberately not restated here. See the section
"Upstream coverage (do not restate)" in SKILL.md for the first-party source
that owns each removed topic.

## Hold Core Web Vitals to the 2026 stricter thresholds, not the current official ones
Why: House decision carried in this skill since v2.x: budgets target LCP <= 2.0s, INP <= 150ms, CLS <= 0.08 (versus the official 2.5s / 200ms / 0.1) so performance budgets set today survive the tightening without re-litigating every page. The targets are test-enforced: `test-cases.json` (cases `cwv-lcp`, `cwv-inp`) asserts answers cite the 2026 numbers, and `tests/skills/functional/test-rule-traceability.sh` traces those expectations into the rule files, so silently reverting to the official thresholds fails traceability.
Upstream: skill web-perf / cloudflare:web-perf (Chrome DevTools MCP); official thresholds at https://web.dev/vitals/

## Start performance audits from the recorded OrchestKit wins, not a generic checklist
Why: The audit flow (baseline, profile, cache, measure savings) was distilled from OrchestKit's production optimization pass, recorded with before/after evidence in `examples/orchestkit-performance-wins.md`: LLM spend cut from $35k/yr to $2-5k/yr via a 3-level cache (L1 Claude prompt cache, L2 Redis semantic cache at 0.92 similarity, L3 real LLM call), and vector search cut from 85ms to 5ms (17x) via HNSW indexes. Re-deriving audit phases from vendor docs loses the measured hit rates and cost math that justify each step; start from the wins file and its companion `references/database-optimization.md` and `scripts/caching-patterns.ts`.
Upstream: https://developer.chrome.com/docs/lighthouse/ and https://developer.chrome.com/docs/devtools/performance/ (frontend side); https://www.postgresql.org/docs/current/performance-tips.html (database side)

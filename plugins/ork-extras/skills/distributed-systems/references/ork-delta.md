# Distributed Systems: OrchestKit Delta

House rules and scars kept after the 2026-07-31 wrap-plus-delta thinning of this skill.
Vendor pattern tutorials were removed; SKILL.md section "Upstream coverage (do not restate)"
maps every removed topic to its first-party source. Maintained for src/skills/distributed-systems.

## Never hardcode model names or pricing tables in resilience prose

Why: The deleted references/llm-resilience.md shipped a PRICING dict with a duplicated "claude-sonnet-5" key and December 2025 per-token prices that rotted silently for months; .claude/rules/skill-authoring.md ("Version and API Claims Must Be Machine-Checkable") exists because of exactly this failure class.
Upstream: https://docs.claude.com/en/docs/about-claude/pricing (current model ids and pricing)

## Do not document integrations OrchestKit does not ship

Why: The deleted examples/orchestkit-workflow-resilience.md (507 lines) described a backend/app analysis pipeline with supervisor agents, bulkhead registries, and Langfuse wiring that has never existed in this repo (the failure class named by the 2026-06 theater-vs-reality audit); removed 2026-07-31.
Upstream: src/skills/CONTRIBUTING-SKILLS.md (house authoring standard; no vendor surface owns this rule)

## Single-source bulkhead tier sizing in rules/resilience-bulkhead.md

Why: The deleted references/bulkhead-pattern.md and the deleted pipeline example carried a second tier table (Standard tier: 3 concurrent, 5 queue) contradicting the surviving rule's table (Standard tier: 8 workers, 12 queue); the two sources of truth had already drifted when found on 2026-07-31. Change tier numbers only in the rule file.
Upstream: https://learn.microsoft.com/azure/architecture/patterns/bulkhead for the pattern itself

## Keep LLM fallback chains quality-first with a semantic-cache floor

Why: House default from the February 2026 v2.0.0 consolidation of four resilience skills into distributed-systems: primary frontier model, then a mini-class fallback, then semantic cache at 0.85 similarity, then a degraded default response (never a bare error). After the thinning this configuration is recorded only here; the file that carried it (references/llm-resilience.md) was upstream restatement around it.
Upstream: https://vercel.com/docs/ai-gateway (provider failover and model routing); provider limits at https://docs.claude.com/en/api/rate-limits

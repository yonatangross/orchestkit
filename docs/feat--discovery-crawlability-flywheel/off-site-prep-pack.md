# Off-site flywheel — owner prep pack (Discovery layer)

The Discovery layer (8/20) is capped by the `yonyon` apex-domain brand collision
(established, FINAL — no rebrand). On-site recovers *withheld* points (shipped in
this PR); the only lever that moves the structural cap is off-site citation
volume under the **"OrchestKit"** name. Those moves are **owner-gated or
outward-facing** — listed here ready to execute. Nothing below is auto-run by an
agent; each mutates a third-party surface and needs you.

> SERP reality (verified 2026-06-12): on the bare keyword **"OrchestKit"** we own
> the entire top-10 — *no DJ collision on the brand name itself*. The gap is
> **category** invisibility: zero appearances in "best Claude Code plugins"
> roundups and zero on high-DA editorial surfaces (awesome-lists, Reddit, HN,
> Dev.to). Fix = get "OrchestKit" cited in those surfaces.

## 1. GitHub repo topics — 30 seconds, lowest effort, do first

Current: `agents ai-development claude-code claude-plugin langgraph llm rag react typescript fastapi mcp security testing`

Add the category-anchor topics whose GitHub topic pages awesome-list bots crawl:

```bash
gh repo edit yonatangross/orchestkit --add-topic claude-code-plugin \
  --add-topic agent-orchestration --add-topic developer-tools \
  --add-topic ai-agents --add-topic anthropic
```

(GitHub cap is 20 topics; you're at 13, room for these 5.)

## 2. awesome-claude-code (hesreallyhim, ~46k★) — HIGHEST single-citation ROI

**⚠️ TIMING: the list is mid-reorganization** ("the old ToC is no longer fit for
purpose; a new system is being prepared"). Submitting against the old structure
now will likely be rejected/conflict. **Action: watch the repo; PR once the new
ToC lands.** Draft entry to drop into the correct section when it does:

```markdown
### [OrchestKit](https://github.com/yonatangross/orchestkit)
A free MIT plugin for Claude Code — 111 skills, 37 agents, and 200+ lifecycle
hooks with built-in security patterns and quality gates. Install:
`claude plugin install orchestkit/ork`.
```

## 3. ComposioHQ/awesome-claude-plugins — second-highest, no reorg blocker

Fork → add OrchestKit under the toolkits/orchestration section → PR. Same entry
text as §2. Composio's blog ranks #6 for "best Claude Code plugins" and pulls
from this list, so inclusion compounds.

## 4. Wikidata Q140128295 — entity is HEALTHY, only freshness gaps

Already has: P31 (software + application software), P856 (official site), P1324
(repo), P277 (TypeScript), P275 (MIT). Low-value polish only — orank's Wikidata
check already resolves the entity; the cap is that orank keys "yonyon", not that
the item is weak. If you touch it, log in and:

- Update **P348 (software version)**: 8.6.5 → current (8.41.x).
- Add **P31 → Q1172352 (plug-in)** for a more specific type.
- Optionally add **P18 (logo)** if you upload the OrchestKit mark to Commons.

Skip P178 (developer) unless a "Yonatan Gross" person item exists.

## 5. Owner-account content (slow-burn citations under "OrchestKit")

All require an authentic account (not a throwaway) — agent-drafted, owner-posted:

- **Show HN**: "Show HN: OrchestKit — 111 skills + 37 agents + 200+ hooks for
  Claude Code (MIT)". Lead with one concrete demo (a security hook blocking a
  dangerous command mid-agent-session), not a feature list.
- **Dev.to** (`claude-code`, `ai-agents`, `developer-tools` tags): "How I built
  200+ lifecycle hooks that block dangerous Claude Code commands before they
  run." Indexes in hours; ranks for zero-competition "Claude Code hooks" SERP.
  Cross-post to Hashnode/Medium with canonical → Dev.to.
- **r/ClaudeAI / r/ClaudeCode**: a single real workflow with output (e.g.
  `/ork:verify` catching 3 things solo-Claude missed). Show, don't market.

## 6. Already done — do NOT redo

MCP Registry (`io.github.yonatangross/orchestkit`), Smithery, mcp.so, skills.sh
(723 installs), Wikidata entity exists. GPT Store DEFERRED (OpenAI account gone).
Glama claim pending owner.

## Sequencing (max early signal, min effort)

1. **§1 topics** (today, 30s) → 2. **§3 Composio PR** (today, no blocker) →
3. **watch §2 awesome-claude-code** for the reorg, PR when ready →
4. **§5 Dev.to + Show HN** to start the slow citation clock.

Honest expectation: §1–§4 tighten entity reconciliation; the Discovery *number*
only climbs after crawl+index cycles (6–12 weeks) and stays capped below 20
without a domain move. Target 8 → ~13–15, not 20.

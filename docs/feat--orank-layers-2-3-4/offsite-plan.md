# OrchestKit — Off-Site Agent-Readiness Plan (orank Discovery 14/41)

_Synthesized 2026-06-08 from 3 Tavily research agents (GEO citation playbook · rebrand/domain · category share-of-voice). orank 78/B, #114 of 11796._

## The one-picture synthesis

On-site is effectively done (78/B; Identity/Auth/Agent-Integ/UX all 90%+). **Discovery 14/41 is the entire remaining gap, and it is off-site.** Three independent research threads converge on the same root cause and sequence:

1. **The `yonyon` apex-domain collision is the structural ceiling.** APEX brand-extraction is documented behavior (Wikidata P856, LLM entity resolution, brand-discovery patents). "yonyon" resolves to the DJ ~100% of the time. orank itself now says "rebrand away from yonyon." → **Decision gates everything.**
2. **The citation flywheel is the only thing that moves Discovery** — Reddit (~40% of LLM citations, 2–7 day index), awesome-lists, Dev.to, Show HN, in that ROI order. Comparison pages get cited 3× feature pages.
3. **Composio owns the "curator" position** (awesome-lists + a ranking blog post); OrchestKit is in ZERO lists. That's the fastest, cheapest gap to close — and it's repo-pointed, so domain-independent.

## TIER 0 — THE DECISION (gates flywheel sequencing)

**Rebrand `orchestkit.yonyon.ai` → `orchestkit.dev`?** Research recommendation: **YES, now** (75% confidence).
- Now is the optimal window: 78/B + low link-equity = can't lose traffic you don't have. Waiting 2yr = ~500-day recovery project.
- `.dev` > `.ai` for a dev tool ($15 vs $130, Google-owned, dev-credible).
- Risk is execution-only: perfect 301 map + re-establish Wikidata P856 on the new domain.
- **Why it gates:** every Reddit/HN/Dev.to/awesome-list link you seed should point at the FINAL domain. Seed under yonyon.ai then move = diluted/wasted citations. So decide before the flywheel.
- Cross-repo: domain/DNS live in Yonatan-HQ/platform Terraform (orchestkit.tf), not this repo.

## TIER 1 — NO-REGRET, AGENT-DOABLE NOW (domain-independent or carries via 301)

| # | Action | orank gap it hits | ork skill/agent | Owner |
|---|--------|-------------------|-----------------|-------|
| 1 | PR OrchestKit into 5 awesome-claude-code lists (repo-pointed, not domain) | Discovery: registries/share-of-voice | `git-operations` + draft | I prep PR · you/maintainer merge |
| 2 | Add `SoftwareApplication` + `FAQPage` JSON-LD; expand schema breadth | Discovery: semantic-index · Identity: schema breadth (−1) | `frontend-ui` / direct MDX | 🟢 me |
| 3 | `/compare/` pages: vs Superpowers, vs Composio, + "Claude Code plugins compared" hub | Discovery: category share-of-voice (−6), dev-resource discoverability (−6) | `competitive-analysis` (battlecard) → `write-prd` → pages | 🟢 me (draft) · you review |
| 4 | Use-case pages: security/quality-gates, full-stack, team-standards | share-of-voice + multi-turn UX (−1) | `write-prd` → pages | 🟢 me |
| 5 | "Claude Code hooks production patterns" definitive guide (cite our 211) | share-of-voice, training-corpus | `write-prd` / direct | 🟢 me draft · you publish |
| 6 | llms.txt curation pass (curated index, not dump) + `/api/llms.txt.md` twin | Identity: markdown-twin (−1) | direct | 🟢 me |
| 7 | robots.txt: block CCBot/ByteSpider + Content-Signal tiers (bonus pt) | Identity: robots AI-policy (−1) | direct | 🟢 me |
| 8 | getting-started/configuration content (multi-turn T3 gap) | UX: multi-turn (−1) | `write-prd` / direct | 🟢 me |
| 9 | MCP Apps MIME fix: `text/html;profile=mcp-app` + `color-scheme` meta | UX: MCP Apps UI (−2) | direct (lib/mcp-ui.ts) | 🟢 me |
| 10 | Honest Agent-Integ: rate-limit headers, Idempotency-Key in OpenAPI, versioning/Sunset, cursor pagination note | Agent-Integ (several −1/−2) | `api-design` | 🟢 me |

## TIER 2 — OWNER-GATED FLYWHEEL (sequence AFTER Tier 0 decision)

| # | Action | Timing | ork asset | Owner |
|---|--------|--------|-----------|-------|
| A | Registries: mcp-publisher + Smithery + mcp.so + skills.sh official | now (pre-flighted GREEN, #2286) | — | 🟣 you (logins) |
| B | Reddit seeding r/ClaudeAI + r/LocalLLaMA (genuine answers, no vendor flair) | week 1, 2–7 day index | drafts #2287 (refresh w/ GEO mechanics) | 🟣 you (your identity) |
| C | Show HN (live demo + benchmark numbers, "why we built this") | week 2, timed to release | `demo-producer` for demo | 🟣 you submit · I draft+demo |
| D | Dev.to deep-dive (architecture: hook system + agent scoping), canonical→site | week 3 | `demo-producer` / draft | I draft · you/platform publish |
| E | Example repo `orchestkit-examples` (10+ real use cases) | week 2–3 | `implement` | 🟢 me scaffold · you star/own |

## Anti-patterns (from research — do NOT)
- Self-promo Reddit posts / sock accounts → permanent bans (Reddit banned GEO-spam subreddits in 2026).
- Reciprocal awesome-list rings → flagged like suppressed listicle rings.
- AI-generated thin content → filtered from training sets, Perplexity deranks.
- Show HN twice in 30 days → shadowban.
- llms.txt as a flat sitemap dump → zero signal.
- Fabricating OAuth/WebBotAuth/payments to chase Auth pts → we have no auth; declined.

## Measurement
Track LLM share-of-voice with prompt-tests against the 12 target queries across ChatGPT/Perplexity/Claude (could automate via `/ork:bare-eval` or a `/loop`). Re-scan orank after each Tier-1 ship + after registries land.

## Honest ceiling
On-site alone ≈ A-minus. Discovery only breaks open with (a) the rebrand removing the collision AND (b) the citation flywheel — both required, both started here. The rebrand is the higher-leverage, lower-effort-than-it-looks move at this stage.

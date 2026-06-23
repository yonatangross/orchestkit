# Handoff — Sub-Agent & Skill Activation Fix

**Branch:** `feat/activation-audit` (local; not pushed) · **Goal:** raise specialized-agent
activation (real telemetry: only **14%** of agent spawns hit the 37-agent catalog vs **74%**
generic Explore/general-purpose; 17/37 agents dormant).

> Status: **AUDIT + RESEARCH + EXPERIMENT DONE. Implementation NOT started — do it next session.**

---

## TL;DR decision (evidence-based)

- ❌ **Do NOT rewrite agent descriptions** to add "use proactively when…". An isolated
  A/B (this session) showed **Δ0 across 18 prompts** (10 clear + 8 indirect): terse
  *and* rewritten descriptions both routed **18/18** to the correct specialist, including
  all dormant agents on keyword-free phrasing. The rewrite also **blows the byte budget**
  (250b/agent OK, but the 6000b aggregate cap → 8237b, +560 tok/session). The WIP rewrite
  was **reverted** (`git reset --hard d8acb7dba`).
- ✅ **The real, byte-free fix** (what the data points to): the model routes correctly
  *when it consults the catalog* — the 74/14 problem is it **never reaches for the catalog**
  during normal work. Fix that, not the descriptions.

---

## Evidence (already gathered — don't redo)

**Audit (3 parallel agents):** agents fire ≈ **1:1 with how often a high-traffic skill names
them via `subagent_type=`**. `backend-system-architect` (37 skill refs) fires; every
"never-fires" agent is referenced ≤1×. Root causes:
1. Routing-index keyword extractor is broken: `scripts/generate-indexes.js:95-141` only
   matches "Activates for/Use for/Use when" (1 of 37 agents) → 36 fall to a capitalized-word
   grabber → garbage keywords in `plugins/ork/CLAUDE.md:15-61`.
2. That routing index is **advisory prose** (`plugins/ork/CLAUDE.md:3-5`), not an enforced
   CC mechanism — the model is free to ignore it (and does).
3. Skills hardcode generic agents: **15× `subagent_type="Explore"` + 4× `"general-purpose"`**;
   `src/skills/prd-to-goal` + `src/skills/visualize-plan` are generic-only.
4. Description *quality* is NOT the differentiator (audit found it; A/B confirmed it).
5. The one real routing hook, `src/hooks/src/pretool/task/task-agent-advisor.ts`, is
   **advisory-only** (`outputAllowWithContext` at :136,158,174,183; self-documents the
   problem at :69-72); `subagent-validator.ts:416` only observes, never blocks.

**Research (Tavily):** Anthropic docs *recommend* "use proactively"/"MUST BE USED" but there
is **no public empirical proof** it improves selection. The analyst independently proposed
our exact A/B. Large catalogs (30-50) cause inconsistent auto-selection + token cost;
prefer **explicit invocation** for determinism + **prune** redundant agents.

**Experiment (reusable harness: `agent-routing-experiment.mjs`):** isolated A/B,
original-terse vs "use-proactively" descriptions, full 37-agent catalog, measure which agent
the router picks. **15/15 both variants, Δ0.** ⇒ descriptions aren't the lever.

---

## NEXT STEPS — the actual fix (do these next session)

Ship as a milestone + issues + bundled `ci/` PR (src-first, `npm run build`, counts synced).

- **Phase 0 — Unify telemetry (so the fix is measurable).** Today: 4 streams, 2 dead, 1 empty.
  - FRESH: `.claude/logs/subagent-spawns.jsonl` (writers `spawn-intent-logger.ts:71` +
    `subagent-validator.ts:349`).
  - DEAD: `agent-usage.jsonl` (writer `subagent-stop/unified-dispatcher.ts:287` is unbound in
    `hooks.json:1187`); `skill-usage.jsonl` (writer removed in #959); `skill-analytics.jsonl`
    (no writer). `skill-channels.jsonl` (`lib/skill-channels.ts:34`) is **empty in-project**.
  - Build one `.claude/logs/activations.jsonl` + `recordActivation()` in `lib/activations.ts`,
    discriminated-union schema `{kind:agent|skill, channel:main|subagent|auto, …}`,
    schema-lock it (`lib/telemetry-schemas.ts:426-439`), fan-in from existing hooks + add a
    scan for auto-activated skills. Decommission orphans (drop from
    `KNOWN_EVENT_FILES`, `telemetry-http-sink.ts:87-99`).

- **Phase 2 — Re-wire skills to specialists (BIGGEST lever, byte-free).** Swap the 15×
  `Explore` + 4× `general-purpose` hardcodes for specialists where one fits. Give each of the
  **6 mis-triggered** agents a real `subagent_type=` spawn from a high-traffic skill:
  `monitoring-engineer`←`devops-deployment`; `git-operations-engineer`←`commit`/`create-pr`;
  `security-layer-auditor`→`review-pr` security pass; plus `component-curator`,
  `design-system-architect`, `event-driven-architect`. Usage tracks naming ~1:1.

- **Phase 4 — Make the advisor enforce + nudge (byte-free at idle).** Upgrade
  `task-agent-advisor` from `outputAllowWithContext` to `permissionDecision:"ask"` when
  `matchSpecialistDomain()` is confident on a generic spawn. Add a UserPromptSubmit hook that
  surfaces the right specialist BEFORE the model picks a tool (the advisor only fires after a
  Task spawn).

- **Phase 3 (optional) — Routing index.** The A/B shows it isn't needed for selection. Either
  delete it as a selection oracle, or fix the extractor with a `routingKeywords:` frontmatter
  field. Lean to simplify.

- **Lifecycle.** `npm run audit:lifecycle` does NOT exist — extend
  `scripts/list-invocable-agents.mjs` into a dormancy/reference-count report. Consider
  consolidating near-dupes: `security-layer-auditor`→`security-auditor`,
  `component-curator`→`component-search`.

---

## Repo state (end of this session)

- `feat/activation-audit` @ `d8acb7dba` (local): the **audit playground**
  (`docs/feat--activation-audit/activation-audit.html`, 6 tabs incl. Fix-preview) + this
  handoff + the reusable harness. WIP description rewrite **reverted**.
- `main`: all hygiene + doctor work merged — #2604 (pyproject counts), #2606 (retire
  update-counts + `--check` CI gate), #2609 (delete dead recent-decisions.md), #2610 + #2623
  (doctor MEMORY.md budget check, complete). #2623 lands in the **next** release (>8.57.0).

## Constraints / gotchas hit this session
- Agent descriptions: **≤250b each** AND **≤6000b aggregate** (`tests/performance/test-token-overhead.sh:80`, hard fail) — they're injected every session.
- `claude -p --bare` is **auth-broken** in this env ("Not logged in") — the harness uses plain `claude -p` from a neutral CWD instead (the A/B delta stays valid: constant context cancels).
- Heavy workflow fan-out (52 agents) **triggered server rate-limiting**; the API also threw transient **529 Overloaded**. Batch small / add retry+backoff (harness already does).

## Re-run the experiment
```
node docs/feat--activation-audit/agent-routing-experiment.mjs 10   # clear prompts
# edit the TESTS array for indirect/ambiguous prompts; uses claude -p from /tmp, retry-hardened
```

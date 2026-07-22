# OrchestKit: CC 2.1.215-218 adoption + orchestration-model correction

Audit date: 2026-07-23. Branch: `fix/3088-audit-gate-all-trees`. Repo version 8.84.4.
Method: four parallel sub-agents swept one surface each (agents, skills, hooks, CC changelog).
Every decision-bearing claim was then re-verified locally by the lead before entering the plan.
Two findings were refuted on verification and moved to discards.

## Ground truth

| Fact | Value |
|---|---|
| Claude Code actually running | 2.1.218 |
| ork `latest_known` | 2.1.214 (4 releases untriaged) |
| ork support floor / latest | 2.1.206 (strict pin, expires 2026-09-20) |
| Skills | 114 (`src/skills/*/SKILL.md`) |
| Real agents | 36 (`src/agents/*.md` is 37 files; README.md is not an agent) |
| Hook registrations | 217 across three surfaces: 150 hooks.json + 45 agent frontmatter + 22 skill frontmatter |

Counts were corrected three times during the sweep. `bin/validate-counts.sh` passes and the
manifests agree with disk; the earlier wrong numbers were the lead's naive `ls`, not manifest drift.

## The core thesis

Three of the four highest-severity gaps share one root cause: ork encodes an orchestration model
that Claude Code no longer implements.

| ork's implicit model | CC 2.1.217/218's actual model |
|---|---|
| `context: fork` means cheap context isolation, still inline | fork means background by default; opt out with `background: false` |
| agents delegate freely; 13 `Agent(ork:*)` grants | nested spawning is OFF by default; needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` |
| spawn the full fan-out every time | `/effort` is the budget dial; only 4 of 114 skills read it |

These are not three bugs. They are one stale mental model of how the runtime schedules work.

### The four corrective rules

1. **Declare execution intent explicitly.** Every fork skill states `background: true` or `false`.
   Interactive skills get `false`; report-producers get `true`.
2. **Spawn depth is a budget, not a capability.** Either a skill sets the depth env var and owns the
   cost, or the lead fans out flat. Stop granting `Agent(ork:*)` as decoration.
3. **Effort tiers the fan-out, not the prose.** Heavy skills read `CLAUDE_EFFORT` and scale agent
   count. `cover` already does this correctly.
4. **Background implies a merge contract.** No agent may both mutate and run backgrounded in an
   isolated worktree unless the spawning skill merges the branch back.

## Confirmed findings

### CC 2.1.218 changed fork-skill scheduling

Verbatim changelog: "Changed skills with `context: fork` to run in the background by default; opt out
per skill with `background: false`."

78 of 114 skills carry frontmatter `context: fork`. Zero declare `background:`. Split by frontmatter
parse: 39 are `disable-model-invocation: true` (slash-only) and 39 remain model-invocable. The 39
model-invocable ones are the true risk set, including `assess`, `cover`, `expect`, `explore`,
`fix-issue`, `review-pr`, `verify`, `design-ship`.

Honest limit on this finding: `/ork:brainstorm` carries `context: fork` and was observed running
**inline** during this session on 2.1.218. So this is a confirmed configuration gap with an
unconfirmed runtime symptom, not an observed breakage of all 78.

### CC 2.1.217 turned nested subagent spawning off by default

"Changed subagents to no longer spawn nested subagents by default; set
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to allow deeper nesting." The same release added a
concurrency cap of 20 subagents.

ork has 13 `Agent(ork:*)` grants across 11 agents and zero references to either env var anywhere in
`src/` or `manifests/`. chain-patterns Pattern 9 documents nested delegation up to three levels; that
pattern now silently degrades to a no-op.

The first triage agent compressed this entire release to "multiple internal bug fixes" and missed
both bullets. The lead re-fetched the changelog directly and caught it.

### Hook performance: one hook is 87% of all hook time

Measured from 202,229 records in a 207MB `hook-timing.jsonl`, zero parse failures, independently
reproduced by the lead.

| Hook | Calls | Mean | p95 | Max | Total |
|---|---|---|---|---|---|
| `stop/security-scan-aggregator` | 765 | 19,149ms | 50,122ms | 159,640ms | 14,649s |
| `posttool/commit-nudge` | 12,278 | 114ms | 410ms | 2,028ms | 1,402s |
| `lifecycle/webhook-forwarder` | 20,705 | 25ms | 112ms | 2,282ms | 511s |

`hooks.json` declares `timeout: 10` seconds for the aggregator. Its p95 is a 5x overrun and its max a
16x overrun, paid on the Stop event at the end of every session.

### Two deny rules that can never fire

`src/settings/ork.settings.json:40-41` deny `Bash(find:*-delete*)` and `Bash(find:*-fprint*)`. Claude
Code matches against the literal command string and no real invocation begins with `find:`. So
`find . -name '*.tmp' -delete` is **not** blocked. Two more at lines 50-51 are exact-literal-only.
These are silent no-ops presenting as protection.

### A shipped instruction users cannot follow

`src/hooks/src/lifecycle/analytics-consent-check.ts:109` and `:124` tell users to run
`/ork:feedback opt-in`. The `feedback` skill is `user-invocable: false` **and**
`disable-model-invocation: true`, so that command does not exist.

### Missing guardrails, which is why the above survived

- `tests/agents/` has 15 validators and none checks a declared tool name against a known vocabulary.
  That is why `MultiEdit` — absent from both the live and deferred tool surfaces — is still granted by
  5 agents and codified as real in three infrastructure files.
- The hook-id invariant test scans `SKILL.md` only and only `skill/`-prefixed ids. Agent-frontmatter
  hook ids (13 of them) are unguarded.
- The 500-line `SKILL.md` limit has no enforcing test; three skills drifted past it.

### Token cost

433 mentions of CC versions below the 2.1.206 floor across 63 of 114 skill bodies; 1,566 including
`references/`. Every such gate is unconditionally true at the floor. Concentrated in the hottest
skills: `setup` 31, `implement` 29, `configure` 29, `brainstorm` 27, `help` 21.

## Refuted on verification

- **"review-pr and explore define zero agent spawns."** False. The sweep stopped at `references/` and
  missed `rules/`. review-pr has 21 `subagent_type` hits, explore has 22.
- **"security-auditor instructs a spawn it cannot perform."** Downgraded. Lines 85-92 show the four
  things being spawned are `npm audit`, `pip-audit` and a secrets grep — parallel Bash calls, not
  agents.

## Came back genuinely clean

Dead `Team*` tool usage; empty `tools: []`; dangling skill references; stale or nonexistent model IDs;
fable pins; broken `subagent_type` names; dead-dispatch in both directions; orphan handler files;
hyphenated matchers; manifest and docs count drift; `${user_config.*}` exposure from the 2.1.207
breaking change; path-scoped permission rules from the 2.1.210/214 tightening; agent names containing
`:` (rejected in 2.1.218 — all 36 ork agents use bare names).

## Deliberately not doing

Wiring all 16 never-spawned agents into hot skills is utilisation theatre. Dormancy is only a defect
if the work exists and is going to a worse agent instead. Only two are in scope: the refutation
reference already names `accessibility-specialist` and `frontend-performance-engineer` as refuters, so
the intent exists and only the spawn is missing.

## Plan shape

Four waves, 16 items, each with a "done when" evidence command. Wave 0 is runtime correctness at
2.1.218. Wave 1 adds the guardrails that would have caught wave 0. Wave 2 corrects the orchestration
model. Wave 3 reclaims tokens and clears drift. W3.1 must land before W1.3, because stripping the
dead version prose is what brings the three oversized skills back under the 500-line limit.

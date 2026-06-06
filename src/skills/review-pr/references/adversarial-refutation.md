# Adversarial Refutation — review-pr bindings

Thin adapter. Loads the shared engine, then binds it to review-pr's finding + verdict model.

**Load the engine first:** `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/adversarial-refutation.md")`
— the blindness contract, independent-score-first, citation-verify, quorum, cross-file
UPHELD-default, deterministic-exemption, no-auto-flip, spawn-ceiling, ledger schema, and
isolated-spawn rules. This file only supplies what's review-pr-specific.

## Bindings

| Engine concept | review-pr binding |
|----------------|-------------------|
| "finding" | a Phase 3 conventional comment classified `issue` (especially a **request-changes blocker**) or a decision-bearing `suggestion`, from the 6-agent JSON |
| rubric | `code-review-playbook` + the producing agent's domain rubric (security→OWASP, perf→Core Web Vitals, tests→coverage-gap) |
| refuter agent | the **same** `subagent_type` that produced the finding (code-quality-reviewer / security-auditor / test-generator / backend-system-architect / frontend-performance-engineer / accessibility-specialist), spawned blind |
| code artifact | the `CHANGED_FILES` diff slice for the cited `file:line` (Phase 1 scope) — the refuter re-reads the diff itself, never the producer's quoted snippet |
| ledger | `refutation-ledger.json` in the review job dir (`$CLAUDE_JOB_DIR`) |
| revised output | a `refuted` + `original_severity` field on each finding object + a "Refuted?" note in the Phase 5 report; the Phase 6 verdict honors **no-auto-flip** (§7) |

## Scope filter (which findings get a refuter)

A finding qualifies only if decision-bearing — ANY of:
- it is a **request-changes blocker** (the verdict flips on it)
- **CRITICAL or HIGH** severity (security / correctness / data-loss)
- it is the **sole** blocker standing between the PR and `approve`
- a finding `/ork:implement` or the author will act on immediately (concrete code change demanded)

Skip: `praise`, `nitpick`, and low/style `suggestion` comments; mid-severity advisory notes
that cannot change the merge verdict. Dedup duplicate findings to root-cause BEFORE counting
(engine §8). Bounds spawns to ~2-6 per review.

## Effort gate (review-pr-specific)

- `low` / `medium` → **skip Phase 4.5 entirely**
- `high` → up-to-6 **single** refuters, **advisory only** — an `OVERTURNED`-with-verified-citation
  is surfaced for the user (engine §7 no-auto-flip; a single refuter never demotes a blocker on
  its own)
- `xhigh` → **quorum** per engine §4: 3-refuter majority for a request-changes blocker, 2 for a
  HIGH finding; a kill that would remove a blocker still requires explicit user confirmation
  before the verdict changes (§7)

## Verdict guardrail (review-pr-specific)

Refutation MAY demote a finding's display bucket and drop its confidence, but it may **NOT**
by itself flip the human-facing verdict from `request-changes` → `approve` (engine §7). Keep
the producer-basis verdict AND a labeled "post-refutation" view; surface every killed
CRITICAL/HIGH prominently. Ground truth (failing CI/tests/lint, npm-audit/CVSS matches) is
exempt — never refuted (engine §6); only a *reachability claim* layered on a CVE is refutable.

## Isolation note

Even when Phase 3 ran in Agent Teams mode, Phase 4.5 refuters are ALWAYS standalone
`Agent(...)` Task spawns with **no `team_name`** — fed only the serialized claim + diff slice.
Joining the mesh would leak producer reasoning via `SendMessage` history (engine §9).

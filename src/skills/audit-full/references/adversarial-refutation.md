# Adversarial Refutation — audit-full bindings

Thin adapter. Loads the shared engine, then binds it to audit-full's severity-ranked findings.

**Load the engine first:** `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/adversarial-refutation.md")`
— the blindness contract, independent-score-first, citation-verify, quorum, cross-file
UPHELD-default, deterministic-exemption, no-auto-flip, spawn-ceiling, ledger schema, and
isolated-spawn rules. This file only supplies what's audit-full-specific.

## Bindings

| Engine concept | audit-full binding |
|----------------|--------------------|
| "finding" | a severity-ranked finding from STEP 3 (Security / Architecture / Dependency), tagged CRITICAL/HIGH/MEDIUM/LOW |
| rubric | the relevant STEP-3 guide (`security-audit-guide.md` / `architecture-review-guide.md` / `dependency-audit-guide.md`) + `assets/severity-matrix.md` |
| refuter agent | a blind `Agent(...)` chosen by finding domain — `security-auditor` (security), `backend-system-architect` (architecture), `code-quality-reviewer` (dependency/other). **audit-full's producer is single-context Opus, so these refuters are its ONLY sub-agent spawns** |
| code artifact | the cited `file:line` slice — the refuter re-reads it from the codebase itself (it does NOT get the whole-codebase context the producer had, so cross-file findings follow engine §5 UPHELD-default) |
| ledger | `refutation-ledger.json` in the audit job dir (`$CLAUDE_JOB_DIR`) |
| revised output | a "Refuted?" column on the STEP 4 finding table + `refuted` / `original_severity` fields; severity changes honor **no-auto-flip** (§7) |

## Scope filter (which findings get a refuter)

A finding qualifies only if decision-bearing — ANY of:
- **CRITICAL** or **HIGH** severity (these drive the report's headline + remediation timeline)
- a finding that asserts **exploitability/reachability** (a claim, not a tool match)

Skip: MEDIUM/LOW informational findings, and **deterministic ground truth** — a CVE/CVSS match
from a dependency scan, a failing build/test, a type error (engine §6). Only a *reachability
claim* layered on top of a CVE ("this CVE is exploitable because input reaches it") is
refutable, and only that claim. Dedup to root-cause BEFORE counting; respect the global spawn
ceiling (default 24, engine §8) — rank by `severity × distance-from-decision-boundary` and
flag any un-refuted overflow "manual review required".

## Cross-file caution (audit-full-specific)

audit-full's edge is whole-codebase cross-file reasoning (taint flows, auth-boundary gaps
spanning modules). A refuter only gets the cited slice, so per engine §5 a "could not
reproduce the traced flow" result is **UPHELD, never REFUTED** — the card MUST carry the
producer's full traced file set so the refuter knows what it's missing. A narrow-context
refuter must never kill a true cross-file finding it simply couldn't see.

## Effort gate (audit-full-specific)

audit-full is already a heavy single-context pass; keep refutation bounded:
- `low` / `medium` → **skip STEP 3.5 entirely**
- `high` → up-to-ceiling **single** refuters on CRITICAL/HIGH, **advisory only** (surfaced, not
  auto-applied; a single refuter never demotes a CRITICAL on its own — §7)
- `xhigh` → **quorum** (§4): 3-refuter majority for CRITICAL, 2 for HIGH; a kill that would drop
  a CRITICAL from the report requires explicit user confirmation (§7)

## Isolation note

Refuters are ALWAYS standalone `Agent(...)` Task spawns with **no `team_name`**, fed only the
serialized claim (category + `file:line`, NO producer severity/prose). audit-full has no mesh
to leak into, but the rule holds: delivery is prompt/`additionalContext`-only (engine §9).

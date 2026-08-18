---
title: "Evidence Replay Gate"
impact: HIGH
impactDescription: "Producer findings in evaluative pipelines are inadmissible until the orchestrator has deterministically replayed their cited evidence, so hallucinated citations never reach a verdict, score, or report"
tags: [verification, evidence, correctness, anti-hallucination]
---

# Evidence Replay Gate

Shared protocol for evaluative pipelines (`verify`, `assess`, `review-pr`): a PRODUCER
finding is inadmissible until the orchestrator has replayed its evidence. A finding that
cites nothing checkable, or whose citation fails replay, must never be averaged into a
score, counted toward a verdict, or printed in a report as if it were verified.

## 1. Evidence contract

Every producer finding MUST carry exactly one machine-checkable evidence shape:

- **Static**: `{file, line, quote}` where `quote` is a verbatim slice of the cited line(s).
- **Dynamic**: `{command, expected_output}` where `command` is deterministic and side-effect
  free (read-only git, grep, test run, type-check) and `expected_output` is the exact
  substring or summary line the producer observed.

A finding with neither shape is not evidence-bearing (see section 4).

## 2. Deterministic replay before admission

Before the finding enters ANY verdict, score, or report, the orchestrator replays it:

- Static: re-open the cited `file:line` and string-match the quote against the actual
  content (exact substring match after whitespace normalization, nothing fuzzier).
- Dynamic: re-run the cited command and diff its output against `expected_output`.

Replay is mechanical. No judgment, no LLM re-interpretation, no "close enough".

## 3. Mismatch handling: reject, one retry, never drop

On replay mismatch the finding is **REJECTED back to the producer** together with the
replay result (what was actually at that line, or what the command actually printed).
The producer gets exactly **one retry** to re-cite or withdraw. A finding that fails
replay is never silently dropped (the rejection and retry outcome are recorded) and
never accepted as-is (a wrong citation admitted "because the claim sounds right" is the
exact failure this gate exists to stop).

## 4. Non-replayable findings route to refutation

Pure judgment calls (maintainability opinions, design-taste findings, severity
assessments with no citable artifact) have no replayable evidence. They do NOT pass this
gate by exemption; they route to the adversarial-refutation quorum instead
(`shared/rules/adversarial-refutation.md`), where a blind refuter, not a replay, is the
admission check.

## 5. Relation to adversarial-refutation

This rule extends the engine's section 3 citation-verification gate, which covers refuter
verdicts, to **first-pass producer findings**: the same "re-open the cited file:line"
discipline now applies before a finding ever meets a refuter. The engine's section 6
deterministic exemption applies unchanged: ground truth such as failing build/test/lint
output is never refuted, only replayed.

## 6. Honest caveat: fidelity, not validity

Replay validates **CITATION FIDELITY**, not evidence validity. A flawed test replayed
faithfully still passes the gate; this is the SWE-bench Verified deprecation class
(Feb 2026: 59.4% of the hardest tasks had flawed tests rejecting correct solutions).
So decision-bearing findings should pair replay with the cross-model quorum lane
(adversarial-refutation section 11), which attacks the claim itself rather than the
citation.

## Evidence shapes

```json
{ "id": "F-12", "claim": "retry loop swallows the original exception",
  "evidence": { "file": "src/client/retry.ts", "line": 88,
    "quote": "catch (e) { return retry(fn, n - 1); }" } }
```

```json
{ "id": "F-13", "claim": "type-check fails on the changed module",
  "evidence": { "command": "npm run typecheck",
    "expected_output": "src/client/retry.ts(88,11): error TS2554" } }
```

## Incorrect / correct

```json
// ❌ Incorrect — not replayable: no quote, no command; admitted on trust
{ "id": "F-14", "claim": "config parser ignores the timeout field",
  "evidence": "saw it while reading src/config.ts" }
```

```json
// ✅ Correct — replayable; orchestrator re-opens config.ts:41 and string-matches
{ "id": "F-14", "claim": "config parser ignores the timeout field",
  "evidence": { "file": "src/config.ts", "line": 41,
    "quote": "const { host, port } = raw; // timeout never destructured" } }
```

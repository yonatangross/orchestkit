# Assertion Grader Pattern

Fresh-context audit of a `/goal` assertion set after the loop times out, stalls, or succeeds suspiciously fast. The grader judges the **assertions**, not the work: were they too weak (the agent could satisfy them without real success), too strict (unsatisfiable as written), or was the task genuinely blocked? A verifier sub-agent outperforms self-critique because grading happens in an independent context window (Lance Martin, 2026-06-09) — applied here to the `until` clause itself.

## When to Fire

| Trigger | Signal | Why grade the assertions |
|---|---|---|
| Timeout | `abort-if turns > N` or token cap hit | Assertions may be unsatisfiable — tokens are burning on an impossible bound |
| Stall | `no_progress_for_K_turns` tripped | Loop plateaued; assertions may not discriminate real progress |
| Suspicious quick success | All assertions green in 1–2 turns on a non-trivial spec | Assertions probably too weak — the letter was satisfied, not the intent |

Do NOT fire on a clean, plausible success or a user-initiated abort.

## Grader Prompt Template

Spawn bare (`CLAUDE_CODE_FORK_SUBAGENT=1 claude -p --bare "..."`) or as an `Agent(...)` with no shared state. The grader receives four inputs and returns one structured verdict:

```text
You are auditing the ASSERTION SET of a /goal loop — not the work itself.

INPUTS
1. /goal line:        {exact /goal until ... and abort-if ... lines}
2. Rubric (optional): {contents of .claude/rubric.json, ork-rubric/1.0, if emitted}
3. Run summary:       {last N turns, mechanical: actions taken, assertion results per turn}
4. Repo evidence:     {git diff --stat, re-run assertion command output, ls of expected paths}

QUESTIONS
- Too weak?   Could an agent make every assertion pass without delivering the spec's intent?
- Too strict? Is any assertion unsatisfiable as written (wrong path, impossible bound, pre-broken suite)?
- Blocked?    Does the evidence show an external blocker (missing access, contradictory spec, broken env)?

OUTPUT (JSON only)
{
  "verdict": "tighten" | "loosen" | "abort",
  "reasoning": "<2-3 sentences citing specific evidence>",
  "revised_goal_line": "<full /goal until ... line, or null when verdict=abort>",
  "blocker": "<what is blocked; only when verdict=abort>"
}
```

| Verdict | Diagnosis | Caller action |
|---|---|---|
| `tighten` | Assertions too weak | Re-run `/goal` with the stricter revised line |
| `loosen` | Assertions unsatisfiable | Re-run `/goal` with the achievable revised line |
| `abort` | Genuinely blocked | Stop; surface `blocker` to the user |

## Independence Requirements

- **Fresh context.** The grader must not share the producer loop's context window — bare-eval (`claude -p --bare` with `CLAUDE_CODE_FORK_SUBAGENT=1`) or a fresh `Agent` spawn with no conversation state.
- **No producer prose.** Never paste the looping agent's own claims or success summaries into the grader prompt — only the `/goal` line, the rubric, a mechanical turn summary, and raw evidence. The producer's narrative is exactly the bias the grader exists to bypass.
- **Evidence over narrative.** Regenerate repo-state evidence at grading time (re-run the assertion commands), do not quote results from the loop transcript.
- **Rubric as user signal.** If `.claude/rubric.json` exists, the user edited (or accepted) it before the run — treat its weights and `min_pass` thresholds as the user's intent, senior to the literal assertion text.

## Budget Cap

One grader call per timeout/stall event. The grader itself never loops:

- Grader verdict → at most ONE `/goal` re-run with the revised line.
- If the re-run also times out, escalate to the user — never grade again automatically.
- Hard ceiling: 2 grader calls per `/goal` task lifetime (initial + post-revision), then mandatory human review.
- The grader stays cheap: it reads evidence and judges. It never edits files, never runs the fix itself.

## Worked Example

Producer line that timed out after 15 turns:

```
/goal until file_exists('src/x.ts') AND tests_pass AND lint_clean
/goal abort-if turns > 15 OR tokens > 100000 OR no_progress_for_3_turns
```

Evidence regenerated at grading time: `src/x.ts` exists (created turn 3); `npm test` fails with 2 failures in `tests/y.spec.ts` that also fail on a clean checkout of `main`; `npm run lint` exits 0.

Grader output:

```json
{
  "verdict": "loosen",
  "reasoning": "tests_pass is unsatisfiable as written: tests/y.spec.ts fails on a clean main checkout, so the loop can never turn the full suite green regardless of the work done. The deliverable-scoped tests (tests/x.spec.ts) pass. Scope the assertion to the tests the task owns.",
  "revised_goal_line": "/goal until file_exists('src/x.ts') AND npm test -- tests/x.spec.ts passes AND lint_clean",
  "blocker": null
}
```

Counter-case (same line, different evidence): `src/x.ts` exists but contains only `export {}`, and `tests_pass` is green because no test imports it. Verdict is `tighten` — the revised line adds substance checks so an empty stub can no longer satisfy the set:

```
/goal until grep -q "export function transform" src/x.ts AND npm test -- tests/x.spec.ts passes AND lint_clean
```

---
description: "Decomposes a PRD, issue, or spec into a copy-pasteable `/goal until ... abort-if ...` line. Use when running /goal against a spec, to reduce acceptance criteria to AND-joined boolean assertions."
allowed-tools: [Read, Write, Bash, Grep]
---

# Auto-generated from skills/prd-to-goal/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# /ork:prd-to-goal — PRD → /goal Decomposition

Converts a PRD / issue / spec into a single copy-pasteable `/goal` line. The hard part of `/goal` is not running it — it is writing an `until` clause that is *convergent* (terminates), *falsifiable* (testable boolean), and *observable* (the agent can actually check it without subjective judgement). This skill makes that decomposition reproducible.

## 1. When to use

**Use it when:**
- You have a written PRD, GitHub issue, or spec and want to run `/goal` against it.
- Past `/goal` runs drifted, looped, or burned tokens because the `until` clause was vague (`until tests pass`, `until done`, `until design is good`).
- You need to justify the abort budget — turns, tokens, no-progress threshold.

**Skip it when:**
- One-shot bug fix where the failing test *is* the acceptance criterion. Just run `/goal until pnpm test -- auth.spec.ts passes`.
- No written PRD exists. Run `/ork:write-prd` first — vibes do not decompose.
- The work is destructive or irreversible (DB migrations, mass file deletes). `/goal` retries; you do not want retries on `DROP TABLE`.

## 2. Inputs the skill accepts

| Input | How |
|---|---|
| Pasted PRD text | Provide as the argument, or paste into the chat after invoking. |
| GitHub issue | `gh issue view <N> --json title,body,labels` — the skill reads `body`. |
| Spec file | Path to a Markdown / text file; the skill `Read`s it. |
| ADR / design doc | Same as spec file. |

## 3. The decomposition algorithm

1. **Extract acceptance criteria.** Pull every `MUST`, `SHOULD`, `Definition of Done`, `Acceptance Criteria`, and checkbox-style line. If the doc has none, stop and tell the user to run `/ork:write-prd` first — there is nothing to converge on.
2. **Map each criterion to an observable boolean.** Each criterion must reduce to a single shell-checkable assertion. Examples of observable state:
   - `test -f path/to/file` (file exists)
   - `pnpm test -- pattern passes` (test command exits 0)
   - `gh pr view <N> --json state | jq -r .state == "MERGED"`
   - `wc -l < src/auth.ts` returns a number within bound
   - `pnpm lint` exits 0
   - `curl -sf $URL` returns 2xx
3. **Reject non-observable criteria.** Drop or rewrite criteria that depend on subjective judgement (`code is clean`, `design feels right`, `users are happy`). Either find a proxy (`lint exits 0`, `Lighthouse score > 90`, `NPS survey ID exists`) or surface the criterion back to the user as out of scope for `/goal`.
4. **Compose the `until` clause.** AND-join the observable assertions in priority order — the cheapest, most likely-to-fail check first so the loop short-circuits early. Three to five assertions is the sweet spot; more than seven usually means the PRD is two PRDs.
5. **Compose the `abort-if` clause.** Pick a turn cap, token cap, and no-progress detector. Sensible defaults:
   - Turns: `15` for a single feature, `30` for a refactor, `5` for a bug fix.
   - Tokens: `100000` (1 USD-ish on Sonnet) for a feature, `30000` for a bug fix.
   - No-progress: `3` turns with no file changes and no new test passing.

## 4. Output template

The skill emits exactly two lines, ready to paste:

```
/goal until <assertion_1> AND <assertion_2> AND <assertion_3>
/goal abort-if turns > <N> OR tokens > <T> OR no_progress_for_<K>_turns
```

No commentary, no markdown wrapper — the user copies the block straight into Claude Code.

### Optional: rubric emission (`.claude/rubric.json`)

When the user wants graded feedback beyond pass/fail booleans, the skill MAY also emit `.claude/rubric.json` conforming to `ork-rubric/1.0` (schema: `${CLAUDE_PLUGIN_ROOT}/skills/shared/rubric.schema.json`), mapping each acceptance criterion to one dimension:

```json
{
  "rubric": "ork-rubric/1.0",
  "skill": "prd-to-goal",
  "dimensions": [
    { "name": "regression_test_added", "weight": 0.4, "min_pass": 8, "min_blocker": 3 },
    { "name": "auth_suite_green",      "weight": 0.4, "min_pass": 10, "min_blocker": 5 },
    { "name": "lint_clean",            "weight": 0.2, "min_pass": 10, "min_blocker": 0 }
  ]
}
```

Scores are 0–10 (`min_pass` = soft floor, `min_blocker` = hard blocker regardless of composite); dimension weights MUST sum to 1.0 — see the schema for the full contract.

The file is deliberately **user-editable before the `/goal` run** — that is the point. Adjusting weights and `min_pass` thresholds is how the user injects judgement into the loop without rewriting assertions (rubric-as-environment-feedback, Lance Martin 2026-06-09). The post-timeout grader (§8) treats the rubric, if present, as the user's intent — senior to the literal assertion text.

## 5. Worked examples

### Example A — Bug fix PRD

Input (issue body):

```
Title: Login fails on emails containing "+"
Acceptance Criteria:
- New regression test in tests/auth/test_login.py covers email with "+"
- The new test passes
- All existing auth tests still pass
```

Output:

```
/goal until test -f tests/auth/test_login.py AND pnpm test -- tests/auth/test_login.py passes AND pnpm test -- tests/auth passes
/goal abort-if turns > 5 OR tokens > 30000 OR no_progress_for_3_turns
```

Rationale: file existence is the cheapest check; the targeted test is the regression gate; the broad auth suite catches collateral damage.

### Example B — Feature PRD

Input (PRD excerpt):

```
Feature: User Avatar Endpoint
MUST:
- New route GET /users/:id/avatar registered
- Returns 200 with { url: string, updatedAt: ISO8601 } for known user
- Returns 404 for unknown user
- Integration test covers both cases
- OpenAPI spec updated
```

Output:

```
/goal until grep -q "users/:id/avatar" src/routes/users.ts AND pnpm test -- tests/integration/users.avatar.spec.ts passes AND grep -q "/users/{id}/avatar" openapi.yaml AND pnpm lint passes
/goal abort-if turns > 15 OR tokens > 100000 OR no_progress_for_3_turns
```

Rationale: route `grep` catches a handler that was stubbed but never wired; the integration spec encodes both 200 and 404; OpenAPI grep enforces the docs MUST; lint guards against half-typed code shipping.

### Example C — Refactor PRD

Input (PRD excerpt):

```
Refactor: split monolithic src/auth.ts (1842 LOC) into per-strategy files
Definition of Done:
- src/auth.ts under 200 LOC
- New files in src/auth/strategies/*.ts cover oauth, jwt, password
- All auth tests still pass
- Lint clean
- No new files outside src/auth/
```

Output:

```
/goal until [ $(wc -l < src/auth.ts) -lt 200 ] AND test -f src/auth/strategies/oauth.ts AND test -f src/auth/strategies/jwt.ts AND test -f src/auth/strategies/password.ts AND pnpm test -- tests/auth passes AND pnpm lint passes
/goal abort-if turns > 30 OR tokens > 150000 OR no_progress_for_3_turns
```

Rationale: the LOC bound is the convergent signal — without it, `/goal` can keep "improving" forever. File-existence checks pin the structural decomposition; tests + lint guard correctness. Higher budget because refactors run longer than bug fixes.

## 6. Recipe Library — pre-built loops

Where §3–5 *generate* a custom `/goal` line from a spec, the recipe library *ships* ready-made ones for the recurring autonomous loops. Each is a loop shape wrapped around an ork worker skill, following the same convergent / falsifiable / budgeted rules as a generated line.

| Recipe | Use when | Worker |
|---|---|---|
| 🧪 Coverage climb | raise coverage to a target, meaningfully | `/ork:cover` |
| 🔴 Production error sweep | clear a backlog of actionable errors | `/ork:fix-issue` |
| 📚 Docs-drift sweep | docs / reference drifted from code | `/ork:audit-full` |
| ⚡ Page-load budget | a page exceeds its latency budget | `/ork:performance` |
| 🧹 Repository cleanup | stale memory / state accumulated | `/ork:dream` |
| ✅ Quality streak | don't trust a single green (flaky suite) | `/ork:verify` |
| 🎫 Ticket → PR-ready | drive an issue to a CI-green PR | `/ork:fix-issue` → `/ork:create-pr` |
| 🧼 Type/lint zero | clear a type/lint backlog without suppressions | fixer agent |

Full recipes — the exact `/goal until … abort-if …` lines, convergent signal, and per-recipe guardrail: `references/recipe-library.md`. That file is the in-repo source intended for an `ork-loops` pack on skills.sh (not yet built; the channel Forward Future's Loop Library uses), so the loop *recipes* can travel while ork supplies the *machinery* each pass runs on.

## 7. Anti-patterns

| Bad | Why it fails | Good |
|---|---|---|
| `/goal until tests pass` | Which tests? Existing or new? On which command? The agent can pick whatever subset is already green and claim done. | `/goal until pnpm test -- tests/auth/test_login.py passes AND pnpm test -- tests/auth passes` |
| `/goal until the code looks clean` | Not falsifiable. The agent cannot check "looks clean" — it will either declare victory immediately or never. | `/goal until pnpm lint passes AND [ $(wc -l < src/auth.ts) -lt 200 ]` |
| `/goal until done` | Unbounded. There is no terminating condition; combined with a generous `abort-if turns > 50` this is how runs eat 500K tokens overnight. | Pick 3–5 observable assertions. If you cannot, the PRD is not ready — go to `/ork:write-prd`. |

## 8. Post-timeout assertion grader

If the `/goal` loop hits `abort-if` (turn/token cap or no-progress stall), do NOT retry the same line and do NOT let the looping agent critique its own assertions. Spawn a FRESH-context grader that audits the assertion set itself:

```python
# Bare-eval pattern — independent context window, zero shared state:
Bash("CLAUDE_CODE_FORK_SUBAGENT=1 claude -p --bare \"$(cat /tmp/grader-prompt.txt)\"")
# or: Agent(subagent_type="general-purpose", prompt=grader_prompt)  # fresh spawn, no producer prose
```

The grader receives the `/goal` line, `.claude/rubric.json` (if emitted), a compressed summary of the last N turns, and freshly regenerated repo-state evidence. It returns one verdict:

| Verdict | Diagnosis | Action |
|---|---|---|
| `tighten` | Assertions too weak — agent could satisfy them without real success | Re-run with the stricter revised line |
| `loosen` | Assertions unsatisfiable as written (wrong path, impossible bound, pre-broken suite) | Re-run with the achievable revised line |
| `abort` | Task genuinely blocked (missing access, contradictory spec, broken env) | Stop; surface the blocker to the user |

Grading must happen in an independent context window — never self-critique (verifier sub-agents outperform self-critique because the grader does not share the producer's context; Lance Martin, 2026-06-09). Budget: one grader call per timeout, and the grader never loops itself.

Full pattern (prompt template, independence rules, worked example): `${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/assertion-grader.md`.

## 9. Related skills

- `ork:write-prd` — if the input has no acceptance criteria, run this first.
- `ork:brainstorm` — useful when the PRD itself is contested and you want options before writing the goal.
- `ork:audit-full` — after `/goal` exits, run audit-full to confirm the assertions actually held end-to-end (the loop trusts the boolean; audit re-checks the intent).

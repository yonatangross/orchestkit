# Holdout-Promotion Gate (Champion / Challenger)

Promote a skill/agent edit ONLY if a **challenger** beats the **champion** on a **fresh, sealed holdout** eval set by a configurable margin. Every decision — promoted or rejected, with both scores — is persisted for audit. This is the objective gate the `evolve` subcommand was missing: an `AskUserQuestion` "Apply?" is not evidence the new version is better.

This is the native mechanism behind the recorded goal *auto-evaluate all skills + subagents to standard*: a skill graduates by **winning a holdout bake-off**, not by a human eyeballing a diff.

```
 CHAMPION (current SKILL.md)        CHALLENGER (candidate edit)
        |                                   |
        +------------------+----------------+
                           v
            SEALED HOLDOUT EVAL SET  (N cases, hash-locked)
                           |  bare-eval forked graders (isolated context)
                           v
        champion_score            challenger_score
                           |
                           v
         challenger - champion >= margin ?
                +----------+----------+
              YES                    NO
          PROMOTE                 REJECT
   (snapshot + apply)       (discard challenger; ledger: rejected;
   (ledger: promoted)        SKILL.md byte-identical)
```

## Vocabulary

| Term | Meaning |
|---|---|
| **champion** | The version currently on disk (`SKILL.md` HEAD). The incumbent. |
| **challenger** | The candidate edit `evolve` produced, applied to a scratch copy. |
| **holdout** | A sealed eval set the challenger was NOT derived from. Frozen by content hash so it can't be silently tuned to. |
| **margin** | Minimum `challenger - champion` to promote. Default `0.5` on the 0–10 rubric. Per-skill configurable. |
| **bake-off** | One champion-vs-challenger run over the full holdout, both graded by identical forked graders. |

## The sealed holdout set

Lives beside the skill (paths are flat — `src/skills/<skill>/`, resolve at runtime via `${CLAUDE_SKILL_DIR}/evals/`):

```
src/skills/<skill>/evals/holdout.jsonl      # sealed cases (append-only)
src/skills/<skill>/evals/holdout.lock.json  # {hash, n, frozen_at, rubric, min_pass, margin}
```

One eval case per line in `holdout.jsonl`:

```json
{"id":"h-001","prompt":"...task the skill must handle...","must":["assertions present in output"],"difficulty":"medium"}
```

`holdout.lock.json` pins it:

```json
{
  "schema": "ork-holdout/1.0",
  "skill": "assess",
  "hash": "sha256:1f3a...",
  "n": 12,
  "frozen_at": "2026-06-20T00:00:00Z",
  "rubric": "src/skills/assess/rubric.json",
  "min_pass": 7.0,
  "margin": 0.5
}
```

> **`rubric` points at the per-skill `rubric.json`** (the file with the actual `weight` / `min_pass` / `min_blocker` *values*) — NOT `shared/rubric.schema.json`, which only defines structure and carries no thresholds to enforce against.

**Sealing rules (the anti-tuning contract):**

1. The challenger generator (`evolve` / `evolution-engine.sh`) MUST NOT read `evals/holdout.jsonl`. Its input allowlist is `.claude/feedback/edit-patterns.jsonl` + `evolution-registry.json` only — the train signal, never the holdout.
2. A bake-off recomputes `LC_ALL=C sha256(sort)` of the cases and aborts if it differs from `holdout.lock.json.hash`. (`LC_ALL=C` so the sort — and therefore the hash — is locale-independent across machines/CI.) A mid-flight edit invalidates the run, fail-closed.
3. Growing the holdout is a **separate, reviewed commit** that re-freezes `holdout.lock.json` AND resets stored scores for that skill (old scores were graded against a different set; they are not comparable). No special CI label in v1 — a re-freeze is just a normal reviewed diff.

Build the holdout with `golden-dataset` curation rules (difficulty balance, ≥2 domain tags, canonical inputs). The holdout is a golden-dataset slice that is **never** shown to the challenger generator.

## Grading: bare-eval, forked, isolated

Both versions are graded by the SAME grader over the SAME holdout via `bare-eval`:

```bash
# illustrative — from src/skills/bare-eval; forked graders for cross-case determinism
export CLAUDE_CODE_FORK_SUBAGENT=1      # fresh context per case (CC 2.1.121)
claude -p "$grade_prompt" --bare --print --max-turns 1 \
  --json-schema "$skill_rubric_json" --output-format json
```

> **Dependency / cost (declare it):** `--bare` **requires `ANTHROPIC_API_KEY`** (OAuth/keychain is disabled in bare mode) and **bills tokens directly** (not subscription). A bake-off is `2 * N` grader calls. So this runs **on-demand (`promote`) or in CI only — never in a background hook** ($0 idle, matching the no-paid-background-LLM rule).

- Identical grader + identical `ork-rubric/1.0` rubric + identical holdout → the only variable is the SKILL.md version. That isolation is the whole point.
- Forked subagents stop case N's state leaking into case N+1, so champion and challenger see byte-identical conditions.
- Score = weighted composite over the rubric dimensions, averaged over N cases. A challenger below `min_blocker` on ANY dimension is auto-rejected regardless of margin (a one-axis regression can't be bought with gains elsewhere).

## Decision rule

```
promote IFF:
  challenger_composite - champion_composite >= margin
  AND challenger_composite >= holdout.min_pass
  AND no challenger dimension < its min_blocker
  AND holdout hash matches lock
ELSE reject
```

Ties (delta < margin) reject — **the incumbent wins ties.** New work must clear the bar, not merely match it; this biases toward stability and stops score-noise from churning versions.

### Precedence: LOCK `min_pass` vs RUBRIC `min_blocker`

Two `min_pass`-flavored thresholds exist. They are **not** in conflict — they govern different axes, so both apply and neither overrides the other:

| Source | Governs | Effect |
|---|---|---|
| **LOCK** `holdout.lock.json.min_pass` (`ork-holdout/1.0`) | the **composite** (whole-bake-off eligibility) | challenger's weighted composite must be `>= min_pass` to be promotable — the bake-off's pass bar |
| **RUBRIC** per-dimension `min_blocker` (`ork-rubric/1.0`) | each **single dimension** | any one dimension below its `min_blocker` is a hard blocker, regardless of composite |
| **RUBRIC** `composite.min_pass` (`ork-rubric/1.0`) | the rubric's **own** composite floor | the skill's standalone grading gate (e.g. assess's 5.5 implement gate); the bake-off uses the stricter LOCK value as its composite bar |

So the LOCK's `min_pass` is the authoritative **composite** gate for promotion (it's holdout-specific and can be set stricter than the rubric's general-purpose floor — `7.0` vs `5.5` for `assess`), while `min_blocker` is the per-dimension floor that a high composite can never buy back. The rubric's own `composite.min_pass` is the skill's day-to-day grading gate and is **not** consulted by the Decision Rule. (The schema's `min_blocker <= min_pass` invariant is per-dimension and unrelated to the LOCK composite.)

## The promotion ledger

Every bake-off appends one immutable record (both outcomes) to `src/skills/<skill>/evals/promotion-ledger.jsonl` (`ork-promotion/1.0`):

```json
{
  "schema": "ork-promotion/1.0",
  "skill": "assess",
  "ts": "2026-06-20T14:03:11Z",
  "holdout_hash": "sha256:1f3a...",
  "holdout_n": 12,
  "margin": 0.5,
  "champion_version": "2.3.0",
  "challenger_source": "edit-pattern:add-pagination-assert (conf 0.82, 14 samples)",
  "champion_score": 7.4,
  "challenger_score": 8.1,
  "delta": 0.7,
  "per_dimension": { "correctness": {"champion": 7.0, "challenger": 8.2} },
  "decision": "promoted",
  "reason": "delta 0.7 >= margin 0.5; min_pass 7.0 met; no dimension under blocker",
  "promoted_to_version": "2.4.0",
  "grader_model": "claude-opus-4-8[1m]",
  "fork_subagent": true
}
```

On `rejected`, `promoted_to_version` is `null` and `reason` names the failing clause. `grep '"decision":"rejected"'` shows every change tried and refused, with numbers — that is the auditability deliverable.

## Run loop — `/ork:skill-evolution promote <skill-id>`

```
1. LOAD    champion = SKILL.md HEAD; suggestion = top pending from evolution-registry.json
2. SEAL    recompute LC_ALL=C sha256(sort holdout.jsonl); abort if != holdout.lock.json.hash
3. BUILD   write challenger to a scratch copy; apply the suggestion.
           generator never reads holdout.jsonl (allowlist enforced)
4. GRADE   per case, forked bare-eval grader scores champion AND challenger → composites
5. DECIDE  apply the Decision Rule
6. RECORD  append one promotion-ledger.jsonl record (ALWAYS, both outcomes)
7. ACT     promoted -> snapshot champion into versions/<v>/, copy challenger over SKILL.md,
           bump frontmatter version, update versions/manifest.json successRate.
           rejected -> rm scratch; nothing on disk changes.
8. REPORT  print delta table + decision + the ledger line
```

## `/goal` and CI wiring

**As a `/goal` boolean** (promotion is falsifiable, so it composes via `ork:prd-to-goal`):

```
/goal until jq -e '.[-1].decision=="promoted"' src/skills/assess/evals/promotion-ledger.jsonl abort-if no_progress_for_3_turns
# run /ork:skill-evolution promote assess each turn; abort if SKILL.md never changes (challenger never won)
```

**As a CI gate (wired — `assess` is the first instance)** — `run-skill-eval.sh --holdout-promote <skill>` runs the bake-off headless and exits non-zero on `rejected`, so a PR editing a skill can't merge unless its challenger beat the champion; the sealed-hash check runs first (`holdout hash mismatch`, exit 3, on an un-re-frozen edit). Today only `assess` is seeded (`src/skills/assess/evals/` — a *starter* holdout whose expected labels still need human review before real promotions are trusted); other skills fail closed (exit 2, "holdout eval set not found") until seeded. Run it on-demand or in CI; `--dry-run` validates the seal + rubric with zero grader spend.

**Agents too:** the same loop applies to `src/agents/<name>.md` — holdout cases are tasks, the grader scores the agent's transcript. `bare-eval` honors agent `tools:`/`permissionMode` under `--print` (CC 2.1.119), so the agent is graded with its real tool surface.

## Anti-gaming guardrail

**The one way it gets gamed:** the challenger generator peeks at the holdout and tunes the edit to those exact cases (train-on-test), or an operator quietly edits `holdout.jsonl` to drop the cases the challenger fails.

**The checks that block it:**

1. **Hash seal** (step 2 + CI), computed `LC_ALL=C` so it's deterministic. Any holdout change without a reviewed re-freeze → `holdout hash mismatch`, fail-closed, no promotion.
2. **Generator isolation** — `evolution-engine.sh`'s input allowlist must exclude `evals/holdout.jsonl`. Enforced by `tests/unit/test-evolution-engine.sh` (two assertions: the engine source statically references no holdout path, and a planted holdout canary token never leaks into a generated challenger) — the engine script is the real surface, not a generic markdown grep.
3. **Tie-loses + per-dimension blocker** — even a higher composite can't promote if it tanks any dimension below `min_blocker`, so you can't trade a correctness regression for a verbosity win to clear the margin.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Re-use the train set as holdout | Train-on-test; every challenger "wins" | Hold cases out; freeze with `holdout.lock.json` |
| Promote on a tie (delta 0) | Score noise churns versions endlessly | Incumbent wins ties; require `>= margin` |
| Different grader/holdout per side | The version isn't the only variable; result is meaningless | Same grader, rubric, sealed set, forked context |
| Average composite hides a one-axis regression | Ship a more-correct-but-insecure version | Per-dimension `min_blocker` auto-rejects |
| Edit `holdout.jsonl` to drop failing cases | Silent goal-shifting; numbers stop being comparable | Hash seal + reviewed re-freeze + score reset |
| Run the bake-off in a background hook | Bills `ANTHROPIC_API_KEY` per session per dev | On-demand `promote` / CI only; $0 idle |
| Skip the ledger on rejection | Lose the audit trail of what was refused | Append a record for BOTH outcomes, always |
| Bump version without a winning bake-off | The "to standard" claim is unproven | `promoted_to_version` is set only by the Decision Rule |

## Acceptance (self-check)

- `LC_ALL=C` hash of `holdout.jsonl` equals `holdout.lock.json.hash` before any bake-off; a tampered holdout aborts with no ledger append.
- A challenger scoring `< champion + margin` → ledger `decision:"rejected"` AND `git diff --quiet src/skills/<skill>/SKILL.md` (unchanged).
- A winning challenger → `decision:"promoted"`, a new `versions/<v>/` snapshot, a bumped frontmatter `version`.
- Every bake-off appends exactly one `promotion-ledger.jsonl` line (both outcomes).

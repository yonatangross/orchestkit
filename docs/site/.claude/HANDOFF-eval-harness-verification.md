# Handoff: verify the 2026-07-20 eval-harness work

Baseline at handoff: `origin/main` = **e821cbf4b**, version **8.83.1** (8.83.2 queued in PR #3050).

Everything below shipped and is green in CI. The point of this document is that
**two claims were never verified end to end**, and a third was verified in a way
that could rot. Verify, do not assume. If a check below fails, that is a real
finding, not a flake.

---

## 1. What landed

| PR | merge commit | what |
|---|---|---|
| #3044 | `f644290a8` | 4 ADW gaps: heal-loop executor, coverage-gate return edge, worktree docs, model routing |
| #3045 | `1eb838bfe` | cmux declarative layout + playground |
| #3047 | `105cd6246` | dead generation renders INCONCLUSIVE, not FAIL (both lanes) |
| #3049 | `e821cbf4b` | effective-recall denominator + `tests/evals` wired into CI |

Issue **#3032 CLOSED** by #3049.

---

## 2. THE TWO UNPROVEN CLAIMS (do these first)

### 2a. The outage guard has never handled a real dead generation

Verified by logic only: the 3x3 exit matrix and the invariant that a real
failure in either lane exits 1. **Never observed against an actual dead
generation in CI**, because `Skill Eval` only fires when `src/skills/**`
changes and both fix PRs touched only `tests/evals/scripts/**`. That is the
same trigger/target misalignment as open issue **#2967**.

**How to settle it (free):** on the next PR that touches any `src/skills/` file,
read the Skill Eval log.

```bash
gh run view <run-id> --log | grep -c "Dead .* generation"
gh run view <run-id> --log | grep -E "INCONCLUSIVE|Trigger:|Quality:|Overall:"
```

Expected:
- dead count > 0 and the row reads `INCONCLUSIVE` -> guard confirmed working
- dead count > 0 and the row reads `FAIL (0%)` or `FAIL (%)` -> **the fix regressed**
- dead count 0 -> inconclusive test; wait for a run that actually hits one

### 2b. implement's trigger recall was never confirmed fixed

The description was rewritten (promoting `triggers.keywords` and
`triggers.examples` into the `description:` field, which is the only field the
eval catalog reads, see `run-trigger-eval.sh:148-160`). Every CI run that could
have measured the result was poisoned by dead generations, so the fix is
**unmeasured**, not proven.

Note the recall number will now be LOWER than the old pre-#3049 figures for the
same run quality, because the denominator changed. Do not read that as a
regression. Old `68.3` and new `54.0` describe the same run.

**Free pre-check (no model calls), should stay green:**

```bash
bash tests/skills/triggering/test-trigger-keywords.sh   # expect implement 14/14
```

---

## 3. Verify the shipped fixes are still present

All of these are greps against `origin/main`. Non-zero counts expected.

```bash
grep -c "pos_total"          tests/evals/scripts/run-trigger-eval.sh   # 6
grep -c "dead_prompts"       tests/evals/scripts/run-trigger-eval.sh   # 5
grep -c "INCONCLUSIVE"       tests/evals/scripts/run-skill-eval.sh     # 3
grep -c "inconclusive"       tests/evals/scripts/run-quality-eval.sh   # 7
grep -c "filesFromIstanbul"  src/hooks/src/skill/coverage-threshold-gate.ts  # 3
grep -c "state_known"        src/skills/cover/workflows/heal-loop.mjs  # 2
grep -c "run-tests.sh tests/evals" .github/workflows/ci.yml            # 1  <- the dead-gate fix

# ci-sentinel verdict extraction. Do NOT check this by line number: it moved
# 267 -> 272 when the explanatory comment was added, and it will move again.
grep -n 'verdict_md=' .github/workflows/ci-sentinel.yml
# expected: jq -r '.result // .content // ""'
#   .result FIRST is the fix. `.content` survives only as a defensive fallback
#   for future envelope drift, so "grep finds .content" is NOT a regression.
#   The regression signature is `.content` appearing BEFORE `.result`.
```

Run the guards that now actually gate:

```bash
export CLAUDE_PROJECT_DIR="$PWD"
bash scripts/ci/run-tests.sh tests/evals --verbose   # expect 5 passed, 0 failed
bash tests/evals/test-effective-recall.sh            # expect 14 assertions, exit 0
```

`test-effective-recall.sh` deliberately keeps the OLD formula next to the new
one and asserts both real observed CI figures (`100.0` for ci-sentinel, `68.3`
for implement). If those two stop reproducing, the model of the bug is wrong,
not just the numbers.

---

## 4. The ci-sentinel end-to-end proof still owed

`ci-sentinel` ran daily for months and posted nothing: `jq '.content'` where
`claude -p --output-format json` emits `.result`. Fixed in #3044, but the fix
has **never been observed producing a real PR comment**.

```bash
# after the next daily cron fires (17 8 * * * UTC)
gh run list --workflow=ci-sentinel.yml --limit 3
# the artifact is the proof, not the exit code:
ls .sentinel/ledger.jsonl 2>/dev/null || echo "still no ledger -> still broken"
```

A `.sentinel/` directory has **never existed** in this repo's history. Its first
appearance is the confirmation.

---

## 5. Known remaining debt (documented, deliberately not fixed)

| item | why deferred |
|---|---|
| 76 of 119 eval specs have ZERO trigger cases -> vacuous PASS | changes verdicts corpus-wide, needs its own ratchet |
| `cover` quality eval exhausts `--max-turns 10`, aborts every run | needs a per-spec `max_turns`; raising it globally taxes every skill |
| tier counts `7/10/6/13` hardcoded in `auto/SKILL.md` + `routing-rules.md` | outside `count-sync`, silently rots when an agent is added |
| biome does not cover `src/skills/**/*.mjs` | `heal-loop.mjs` (319 lines) is linted by nothing |
| `healed: true` is agent-attested, not script-verified | Workflow runtime forbids `fs`/`process`; architectural |
| `implement/SKILL.md` is 517 lines vs the 500 rule | pre-existing; CI cap is 520 |

Related open issues: **#2967**, **#3000**, **#2971**.

---

## 6. Traps that cost time today

- `gh pr merge` can **exit 1 while the merge succeeds** (the failing step is the
  local branch-delete when `main` is held by another worktree). Verify with
  `gh pr view <n> --json state`, never the exit code.
- The worktree-merge-verifier warns "N unmerged commits" after a **squash**
  merge. False positive: squashing means the commits are not ancestors, though
  the content is. Check file contents on `origin/main`.
- `git checkout --` after a merge reverts to HEAD, which already contains the
  change, so a non-vacuity re-check silently proves nothing. Diff against
  `git show origin/main:<file>` instead.
- `((counter++))` under `set -e` exits non-zero on the first increment from 0
  and kills the script. Use `x=$((x + 1))`.
- The PR playground gate needs BOTH `docs/<branch-slug>/*.html` AND the literal
  word "playground" in the PR body.
- Branch names must be prefixed (`feat/`, `fix/`) or the pre-push version gate
  fires.
- Do not verify anything in these scripts **by line number**. Writing this
  handoff, the ci-sentinel check pointed at line 267 and the line had already
  moved to 272. Grep for the assignment, not the address.
- Beware `$(` inside a double-quoted grep pattern: the shell eats it and the
  grep silently matches nothing, which reads exactly like "the fix is missing".
  That happened while self-testing this document. Single-quote the pattern.

---

## 7. Self-test status of THIS document

Every command in section 3 was executed against `origin/main` = `e821cbf4b`
before this file was written. All seven grep counts matched, `tests/evals`
reported 5 passed / 0 failed, `test-effective-recall.sh` exited 0, and
`test-trigger-keywords.sh` reported `implement 14/14`.

The single exception was the ci-sentinel line-number check, which was wrong and
has been replaced above. If any other command here fails, suspect the document
before suspecting the code, then verify the code anyway.

# Loop Recipe Library — pre-built `/goal` loops

Pre-written, battle-tested `/goal until … abort-if …` recipes for the recurring autonomous loops. Where `prd-to-goal` *generates* a custom goal line from a spec, this library *ships* ready-made lines for jobs you run over and over.

Each recipe is a **loop shape** (when to stop) wrapped around an **ork skill** (the work each pass does). They follow the same rules as a generated line: AND-joined observable assertions in the `until`, a real `abort-if` budget, and a convergent signal so the loop terminates.

> **Distribution (planned):** this library is the in-repo source intended for an `ork-loops` pack on skills.sh — the same channel Forward Future's Loop Library uses (`npx skills add`). The pack itself is not built yet; today the recipes live here. Interop, not competition: we ship the loop *recipes*; ork supplies the *machinery* (rubric gates, 211 safety hooks, parallel agents) each pass runs on.

## How to use a recipe

1. **Replace the `<TOKENS>`.** Recipes are templates — swap `<TEST_CMD>`, `<COVERAGE_CMD>`, etc. for your project's commands (e.g. `npm test`, `pnpm test`, `pytest`). The `<…>` tokens are the only things you edit.
2. **Keep the `abort-if` budget.** It is the safety rail, not boilerplate. Tighten it; never delete it.
3. **Name the worker.** Each recipe lists the ork skill that should run each pass — invoke it as the loop's worker (`/goal … then run /ork:cover each turn`).
4. **Mind the guardrails.** Every recipe lists the one way the loop gets gamed and how the assertions prevent it.

## Recipe → theme → worker map

| Recipe | Loop-Library theme | ork worker skill |
|---|---|---|
| 🧪 Coverage climb | 100% Test Coverage | `/ork:cover` |
| 🔴 Production error sweep | Production Error Sweep | `/ork:fix-issue` |
| 📚 Docs-drift sweep | Docs Sweep | `/ork:audit-full` |
| ⚡ Page-load budget | Sub-50ms Page-Load | `/ork:performance` |
| 🧹 Repository cleanup | Repository Cleanup | `/ork:dream` |
| ✅ Quality streak | Quality Streak | `/ork:verify` |
| 🎫 Ticket → PR-ready | Ticket-to-PR-Ready | `/ork:fix-issue` → `/ork:create-pr` |
| 🧼 Type/lint zero | (static-analysis baseline) | fixer agent |

---

## 🧪 Coverage climb

**Use when:** coverage is below your bar and you want it raised *meaningfully* (not gamed).
**Backs each pass:** `/ork:cover` · **Convergent signal:** coverage % climbs toward target; no-progress aborts the asymptote.

```
/goal until <COVERAGE_CMD> reports >= 90 AND <TEST_CMD> passes
/goal abort-if turns > 20 OR tokens > 200000 OR no_progress_for_3_turns
```

**Guardrail:** coverage alone is gameable (assert-free tests bump the number). Keep the full suite green in the AND so tests stay meaningful. Pair with the **streak gate (#2540)** so a flaky green at 90% doesn't end the loop on a fluke.

## 🔴 Production error sweep

**Use when:** an error tracker / log has a backlog of *actionable, reproducible* errors.
**Backs each pass:** `/ork:fix-issue` · **Convergent signal:** open actionable-error count shrinks toward 0.

```
/goal until [ $(<ERROR_COUNT_CMD>) -eq 0 ] AND <TEST_CMD> passes
/goal abort-if turns > 25 OR tokens > 250000 OR no_progress_for_3_turns
```

**Guardrail:** scope `<ERROR_COUNT_CMD>` to *actionable + reproducible* errors only — filter third-party noise, or the loop chases unfixable errors forever. Never point this at destructive remediation; `/goal` retries, and you don't want retries on data deletion.

## 📚 Docs-drift sweep

**Use when:** generated reference, links, or examples drift from the code.
**Backs each pass:** `/ork:audit-full` (docs lens) or your docs checker · **Convergent signal:** drift checks → all pass.

```
/goal until <DOCS_DRIFT_CMD> passes AND <LINK_CHECK_CMD> passes
/goal abort-if turns > 15 OR tokens > 120000 OR no_progress_for_3_turns
```

**Guardrail:** `<DOCS_DRIFT_CMD>` must be deterministic (e.g. "regenerated reference == committed reference"), never an LLM "are the docs good?" judgement — subjective checks never converge.

## ⚡ Page-load budget

**Use when:** a page exceeds your latency budget (LCP / load time).
**Backs each pass:** `/ork:performance` · **Convergent signal:** metric descends toward budget; the no-progress detector is essential (perf has diminishing returns).

```
/goal until [ $(<LCP_MS_CMD>) -le 2000 ] AND <TEST_CMD> passes
/goal abort-if turns > 12 OR tokens > 150000 OR no_progress_for_2_turns
```

**Guardrail:** keep `no_progress_for_2_turns` tight — perf loops plateau, and you want to stop *at* the plateau, not grind tokens past it. Always AND the test suite so an "optimization" that breaks behavior can't satisfy the budget.

## 🧹 Repository cleanup

**Use when:** memory files, stale branches, or dead state have accumulated.
**Backs each pass:** `/ork:dream` · **Convergent signal:** the dry-run reports nothing to prune (naturally terminating — each pass strictly reduces the stale set).

```
/goal until <DREAM_DRYRUN_CMD> reports 0 stale AND 0 duplicate AND 0 contradiction
/goal abort-if turns > 8 OR tokens > 60000 OR no_progress_for_2_turns
```

**Guardrail:** run dream in **dry-run** inside the `until`-check; let the pass apply the changes. The safest loop here — it converges fast because the stale set only shrinks.

## ✅ Quality streak

**Use when:** you don't trust a single green (flaky suite, race conditions).
**Backs each pass:** `/ork:verify` · **Convergent signal:** a consecutive-pass counter reaches N.

```
rm -f .claude/chain/verify-streak.json   # reset: a stale met:true would exit the loop with 0 fresh runs
/goal until jq -e '.met==true' .claude/chain/verify-streak.json   # run /ork:verify --streak=3 each turn
/goal abort-if turns > 15 OR tokens > 150000 OR no_progress_for_4_turns
```

**Worker:** `/ork:verify --streak=3` — the native streak gate (#2540, now shipped) re-runs the real suite each turn, increments on READY, and zeroes on any red.
**Guardrail:** `/goal` reads the `until`-clause at the *top* of each turn, before that turn's verify — so a `met:true` left by a *previous* completed streak (same scope) would exit immediately with zero fresh runs. The `rm` first line resets the ledger so the loop starts cold. Full race write-up: `verify/references/streak-gate.md` ("Stale-ledger guard").

## 🎫 Ticket → PR-ready

**Use when:** you want an issue taken from open to a CI-green, reviewer-ready PR.
**Backs each pass:** `/ork:fix-issue` → `/ork:create-pr` · **Convergent signal:** PR exists, CI green, links the issue.

```
/goal until gh pr list --head <BRANCH> --json number | jq -e 'length>0' AND gh pr checks <BRANCH> --json state | jq -e 'all(.state=="SUCCESS")'
/goal abort-if turns > 20 OR tokens > 200000 OR no_progress_for_3_turns
```

**Guardrail:** do **not** put "merged" in the `until`-clause — merging is a human gate (and ork never auto-closes issues; CI closes them on merge via `Closes #N`). Stop at reviewer-ready.

## 🧼 Type/lint zero

**Use when:** a codebase or migration has a backlog of type/lint errors.
**Backs each pass:** the relevant fixer agent · **Convergent signal:** error counts → 0.

```
/goal until <TYPECHECK_CMD> passes AND <LINT_CMD> passes AND [ $(grep -rc "@ts-ignore\|eslint-disable" src | paste -sd+ - | bc) -le <SUPPRESS_BASELINE> ]
/goal abort-if turns > 20 OR tokens > 200000 OR no_progress_for_3_turns
```

**Guardrail:** the suppression-count clause is load-bearing. Without it the loop "wins" by silencing (`@ts-ignore`, `eslint-disable`) instead of fixing — set `<SUPPRESS_BASELINE>` to the current count so it can only go down.

---

## Authoring your own recipe

A recipe is shippable when all four hold (same bar as a `prd-to-goal` line):

- **Convergent** — there is a monotone signal (count → 0, metric → budget, % → target) that the loop drives in one direction. No monotone signal ⇒ no termination.
- **Falsifiable** — every `until` assertion is a shell-checkable boolean, not a judgement.
- **Guarded** — you can name the one way the loop gets gamed, and an assertion that blocks it.
- **Budgeted** — `abort-if` caps turns, tokens, and no-progress. A recipe without a budget is a token fire.

If you can't satisfy all four, the job isn't a loop yet — decompose it with `/ork:prd-to-goal` first.

# Deterministic catalog gates

Four gates added 2026-07-21 (merged as `a1490b022`). All are **$0**: no LLM calls, no network, no quota, no 1Password prompt. Together they took deterministic coverage from **31 of 114 skills to 114 of 114**.

They exist because the paid eval path could not cover them. Background skills activate by description matching, and **skill activation is not observable** in `claude -p` output: the `system/init` event lists AVAILABLE skills, but nothing reports which was SELECTED. For most of the corpus a static gate is the only coverage that can exist.

---

## Why they are ratchets

Three of the four carry a committed baseline and fail only when a count **increases**. Pre-existing findings therefore do not redden every PR, and the number can only be driven down. Same contract as `scripts/eval/route-check.mjs`.

`--update-baseline` regenerates, and should only be run when a finding is genuinely resolved.

| gate | file | baseline | today |
|---|---|---|---|
| skill coverage | `tests/skills/triggering/test-skill-coverage.sh` | `skill-coverage-baseline.json` | 7 collisions, 15 unreachable, 0 contradictions |
| model recency | `tests/skills/structure/test-model-recency.sh` | `model-recency-baseline.json` | 37 across 23 files |
| targets floor | `tests/skills/structure/test-targets-floor-agreement.mjs` | none, **hard gate at 0** | 25 libraries, 3 shared, 0 conflicts |
| budget governor | `tests/evals/scripts/lib/budget-governor.sh` | n/a, runtime guard | 15/15 self-test |

All are named `test-*.sh` / `test-*.mjs` so `scripts/ci/run-tests.sh` discovers them, which `ci.yml` already runs for `tests/skills`. **Naming is what makes them live rather than dead** — a prior `.mjs` gate in this repo sat unrun because the runner globbed only `test-*.sh`.

---

## 1. Skill coverage

Three checks over all 114 skills:

- **description collisions** — two skills competing for the same prompts. An n-gram must carry a token appearing in ≤5 descriptions, and structural words (`use`, `when`, `this`, `skill`, `looking`) are excluded by name. Rarity alone was not enough: `"use this skill when"` survived because the literal word "skill" is rare in descriptions. That filter took the count from 9 to 7 and removed both false positives.
- **reachability** — no slash command, no model invocation, and no agent `skills:` entry.
- **trigger contradictions** — one prompt claimed `should_trigger: true` by two skills.

> ⚠️ **The contradictions check encodes the wrong model.** 2026 routing research treats routing as set-valued multi-label: one prompt legitimately needs several skills. It reports 0 today, so it is harmless, but drop or invert it before it fires on a corpus improvement. See `GAPS.md`.

## 2. Model recency

`test-model-id-vocab.sh` validates model tokens against `fullIds ∪ historicalIds`. That checks whether an ID is **known**, never whether it is **current**, so a superseded model passes forever.

`models.vocab.json` already carried the answer: `aliases` is documented as *"shortName → current latest full ID per channel"*. **No test read it** — a grep for `aliases` across `tests/` returned one comment.

This gate consumes `aliases` and reports tokens in `fullIds` that are not their channel's current target. Superseded IDs are legitimate in migration ladders, historical changelogs, monitoring patterns and multi-model pricing tables, so only recommendation-shaped references count, history paths are skipped, and an inline `model-recency-ok:` marker opts a line out.

## 3. Targets floor agreement

Fails when two skills declare different floors for one library in `targets:` frontmatter. LangGraph once carried four floors across four files and nothing detected it: `check-labs-versions.mjs` compares a pin against real **upstream**, `test-upstream-version-drift.mjs` compares a skill's prose against its **own** pin, and neither compares two skills to each other.

**It deliberately ignores prose.** A first attempt scanned for `"Lib N.N"` and reported four divergent libraries; every one was legitimate (a link to Playwright 1.58 release notes, `"type-aware rules (Biome 2.0+)"`, `"halfvec (pgvector 0.7+)"`, `"MessageGraph is deprecated in LangGraph v1.0.0"`). A lexical scan cannot separate *"requires >= X"* from *"feature Y landed in X"*. That version was deleted rather than baselined into noise.

## 4. Budget governor

Not a test. A runtime guard sourced by `run-skill-eval.sh` and `run-quality-eval.sh`.

- `record_cap_exhausted()` persists the observation when a generation is classified HTTP 429, parsing the reset time when the message carries one.
- `budget_check()` gates a run before it commits to N calls. On a live cap it exits **2**, the harness's established "could not measure" code, so an unaffordable run reads INCONCLUSIVE rather than as a failure.

**Deliberately conservative:** it refuses only with a parsed reset time still in the future. An unparseable message proceeds, and dry runs are never gated. A governor that blocks on a guess would silently stop measurement for the wrong reason.

State lives under `tests/evals/results/`, already gitignored. Clear a stale block with `rm tests/evals/results/.budget-state.json`.

---

## Running them

```bash
bash tests/skills/triggering/test-skill-coverage.sh
bash tests/skills/structure/test-model-recency.sh
node tests/skills/structure/test-targets-floor-agreement.mjs
bash tests/evals/test-budget-governor.sh          # governor self-test, 15 cases
```

Add `--update-baseline` to the two ratchets only when a finding is genuinely fixed.

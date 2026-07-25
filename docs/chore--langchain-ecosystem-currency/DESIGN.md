# Brainstorm — closing the LangChain-ecosystem currency gap

Ran in-context rather than fanning out to parallel agents (session directive: no AgentTool unless
requested). Mode: open exploration, constraint "use existing patterns". Tier 6 (open-source plugin).

## Phase 1 — memory context

Three prior decisions constrain the design:

- `dead_mjs_ci_gate_pattern` (#2996) — a gate registered in one layer but not discovered by
  `scripts/ci/run-tests.sh` is silently dead. Verified: the runner now globs `test-*.sh` **and**
  `test-*.mjs` (line 57), so a new `.mjs` gate WILL be discovered.
- `silent_noop_green_workflow` — `ci-sentinel.yml` ran green for months writing nothing. Any new
  watcher must be judged by its output artifact, never its exit code.
- `drift_audit_needs_verification` — "this is stale" verdicts from code-only reading run ~60%
  false-positive. Every finding here was verified against a published `.d.ts` or registry JSON,
  which clears that bar.

Existing machinery to reuse (not reinvent): `scripts/check-labs-versions.mjs` +
`.github/workflows/labs-version-watch.yml` already do fetch → diff → `--apply` → open a PR.

## Phase 2 — divergent ideas (16, unfiltered)

| # | Idea |
|---|---|
| 1 | Hand-fix the 4 broken Langfuse JS snippets |
| 2 | Rewrite the "LangGraph 1.2" callout + add 4 rules for the real 1.2 surface |
| 3 | Teach `check-labs-versions.mjs` a PyPI resolver (dual-registry) |
| 4 | New gate: compare every skill's `targets:` floor against live registry latest |
| 5 | Rename `migration-v2-v3.md` → `migration-v3-v4.md`; fix "Langfuse v3" prose |
| 6 | Add a JS/TS twin track to the langgraph skill (`@langchain/langgraph` 1.4.x) |
| 7 | **Import-symbol gate** — assert every symbol a skill imports exists in the package's published `.d.ts` |
| 8 | New `references/langfuse-js-v5.md` (LangfuseClient / LangfuseSpanProcessor / @langfuse/langchain) |
| 9 | Add the Langfuse JS experiments surface (`ExperimentManager`, `createEvaluatorFromAutoevals`, `RegressionError`) to golden-dataset |
| 10 | Add `upstream-version-tested:` frontmatter to the two skills so the existing watchdog applies |
| 11 | Move `langgraph-supervisor` / `langgraph-swarm` to a documented track-only "do not adopt" tier |
| 12 | Nightly digest **issue** instead of auto-PR (lower blast radius) |
| 13 | **Package-existence gate** — assert every `@scope/pkg` named in docs resolves on the registry |
| 14 | Trigger evals for the new 1.2 rules |
| 15 | Just delete the JS `targets:` entry (cheapest correctness) |
| 16 | Authoring rule: a version claim must be machine-checkable |

## Phase 3 — keep / discard gate

| # | Verdict | Reason |
|---|---|---|
| 1 | **KEEP** | Broken code ships today. Non-negotiable. |
| 2 | **KEEP** | The skill's headline claim is factually wrong about its own version. |
| 3 | **KEEP** | Root cause. Without it every other fix rots again. |
| 4 | **KEEP** | Catches the `>=1.2.0` vs 1.4.8 class. |
| 5 | KEEP (cheap) | Pure rename + prose. Zero risk. |
| 6 | DISCARD | 37 rules × two languages doubles maintenance for a surface with no evidence of demand. Prefer #15. |
| 7 | **KEEP** | The only idea that would have caught `LangfuseExporter` *generically*. Highest leverage. |
| 8 | KEEP | JS SDK is a different major (5) with different package names. Needs its own page. |
| 9 | KEEP (defer) | Real gap, but additive, not a defect. Wave 3. |
| 10 | KEEP | Enables #3 with zero new frontmatter vocabulary. |
| 11 | KEEP (cheap) | Records a decision that already holds; prevents re-litigation. |
| 12 | DISCARD | `labs-version-watch.yml` already opens PRs and works. Adding a second notification channel is drift. |
| 13 | **KEEP** | Would have caught `@langfuse/vercel`. Cheap; folds into #7. |
| 14 | KEEP | ork's own eval-coverage contract requires it for new rules. |
| 15 | KEEP | Chosen over #6. |
| 16 | KEEP (cheap) | Makes #4/#7 enforceable at authoring time. |
| — | CRASH | none |

## Phase 4 — evaluation of the three load-bearing ideas (0-10, 7 dimensions)

| Dimension | #3 PyPI resolver | #4 floor-vs-upstream gate | #7 import-symbol gate |
|---|---|---|---|
| Correctness | 9 | 8 | 9 |
| Maintainability | 8 | 7 | 6 |
| Security | 7 | 7 | 6 (fetches remote `.d.ts`) |
| Performance | 8 | 6 (N registry calls) | 5 (slowest) |
| Testability | 9 | 8 | 7 |
| **Simplicity** | 9 | 7 | 4 |
| Impact | 8 | 7 | **10** |
| **Composite** | **8.3** | **7.1** | **6.7** |

**Devil's advocate, #7 (import-symbol gate):** it is the highest-impact idea and the lowest-simplicity
one. Parsing fenced code blocks to extract imports is a lexical heuristic, and this repo has already
rejected one lexical version-scanner for exactly that reason (see the header comment in
`test-targets-floor-agreement.mjs`: "a lexical scan cannot separate 'requires >= X' from 'feature Y
landed in X'"). The counter is that *imports* are not prose — `import { X } from "pkg"` is
unambiguous in a way that "LangGraph 1.2" never is. But it needs network at test time, which makes
it a nightly job, not a PR gate. Scope it to TypeScript imports from packages that have a published
`.d.ts`; do not attempt Python.

**Devil's advocate, #3:** `npm view` shells out per package and the script has no PyPI code path.
Adding one resolver is easy; the trap is that it will then report drift on `langgraph 1.2.9` while
the skill floor is `>=1.2.0` — which is CORRECT, not drift. A floor is not a pin. The resolver must
compare floor-satisfiability, not string equality, or it will cry wolf on every skill and get muted
(the exact failure mode of a gate that gets baselined into noise).

## Phase 5 — synthesis: three approaches

### A. Content-only hotfix
Fix the broken snippets, the 1.2 callout, the file rename, the JS target. No automation.
- **Ships in:** one PR, hours.
- **Test strategy:** existing `npm run test:skills` + a manual re-verify of each corrected import
  against the published `.d.ts`.
- **Trade-off:** restores correctness, changes nothing about why it broke. Rots again by ~Q4.

### B. Hotfix + dual-registry watchdog  ← recommended
A, plus: `upstream-version-tested:` on both skills, a PyPI resolver in
`check-labs-versions.mjs`, floor-satisfiability comparison, and the LangChain-ecosystem packages
enrolled in `labs-version-watch.yml`.
- **Ships in:** two PRs.
- **Test strategy:** unit-test the resolver against recorded registry JSON fixtures (offline, no
  network in the PR gate); assert the workflow's OUTPUT artifact — that a drift run actually
  produces a branch/PR — per the `silent_noop_green_workflow` lesson.
- **Trade-off:** catches version drift, still would not have caught `LangfuseExporter` (a symbol
  that never existed at any version).

### C. B + import-symbol/package-existence gate
B, plus a nightly job that resolves each TS import in skill docs against the package's published
`.d.ts` and each `@scope/pkg` against the registry.
- **Ships in:** three PRs.
- **Test strategy:** fixture-driven unit tests for the extractor (a doc with a known-bad import must
  fail); one live smoke run proving it flags the four current defects before they are fixed.
- **Trade-off:** the only option that closes the actual defect class found today. Costs a network-
  dependent nightly job and a lexical extractor that needs care.

### Trade-off table

| | A | B | C |
|---|---|---|---|
| Fixes today's broken code | yes | yes | yes |
| Prevents version drift | no | yes | yes |
| Prevents phantom-symbol drift | no | no | **yes** |
| New CI surface | none | 1 nightly | 1 nightly |
| Composite score | 5.5 | 8.3 | 7.9 |
| Recurrence risk | high | medium | low |

**Recommendation: B now, C as a follow-up milestone.** B is the highest composite and reuses
machinery that already works. C has the higher ceiling but its extractor is the kind of lexical gate
this repo has burned itself on before; it deserves its own design pass rather than being bolted onto
a correctness hotfix.

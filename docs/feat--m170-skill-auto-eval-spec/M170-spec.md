# M170 — Skill Auto-Eval Against Latest CC

**Status**: ⚠️ **SUPERSEDED** · **Owner**: @yonatangross · **Drafted**: 2026-05-23 · **Superseded**: 2026-05-23

---

## ⚠️ SUPERSEDED — 85% redundant with existing infrastructure

A `/ork:assess` pass after this spec was merged in #1961 surfaced significant
prior art that was missed during drafting. Filing M170 as proposed would
duplicate work already shipped under M120 / M130 / M137:

| Prior-art component                                  | What it does                                                          |
|------------------------------------------------------|-----------------------------------------------------------------------|
| `shared/cc-support.json`                             | Single source of truth for the CC supported floor                     |
| `scripts/stamp-cc-support.mjs`                       | Stamps SoT to derived files                                           |
| `tests/manifests/test-cc-version-floor.sh` (#1765)   | CI test asserting derived files agree with SoT (CLAUDE.md, hooks, doctor) |
| `scripts/cc-release-watch.mjs` (#1486)               | Pulls CC CHANGELOG, drops snapshots, emits gap report                 |
| `scripts/cc-triage.mjs` (#1486)                      | LLM-extracts CCFeature[] per snapshot                                 |
| `scripts/cc-file-adoption-issues.sh`                 | Auto-files adoption issues                                            |
| `.github/workflows/cc-support-window-bump.yml`       | Automated support window bump                                         |
| `docs/docs--cc-adoption-bundle-2.1.140-148/`         | In-progress adoption bundle for the exact CC range cited below        |

### The single real gap

`test-cc-version-floor.sh` validates 3 derived sites (`cc-version-matrix.ts`,
`CLAUDE.md`, `doctor/version-compatibility.md`). It does **not** check the
111 `src/skills/*/SKILL.md` frontmatter `compatibility:` fields. Closing that
gap is roughly 30 lines of bash — not a milestone with 9 issues.

### Follow-up issues filed instead

Both filed under **GH#152 "CC 2.1.148 adoption"** (the active CC adoption
milestone, where the 88-skill sweep belongs by convention):

- **Issue A** — Extend `test-cc-version-floor.sh` to check SKILL.md
  `compatibility:` fields against the SoT. Size XS.
- **Issue B** — Extend `scripts/cc-triage.mjs` to flag skills missing
  newly-introduced CC features as adoption candidates. Size S.

### Why this happened

The spec was drafted without searching for `tests/manifests/test-cc-*` or
`scripts/cc-*` files. Lesson captured in memory as
`feedback_grep_prior_art_before_milestone.md`.

### What still has value here

The interactive **playground** (`playground.html`) is genuinely useful for
visualizing the compat-floor histogram and gut-checking proposed floor
settings — it can stay as a reference, regardless of the spec being superseded.

---

## 📜 Original spec below (kept for history)

The sections below are the original draft as merged in #1961. They no longer
reflect the path forward — see the SUPERSEDED block above.

**Source preference**: User feedback recorded in `.claude/rules/recent-decisions.md`:
> "i want to create a way for us to auto evalulate all of our skills and subagents
>  whether they are up to stanrd with latest cc stuff"

---

## 🎯 Problem

OrchestKit ships **111 skills** with hand-maintained `compatibility:` floors in each
`SKILL.md` frontmatter. There is no automated way to:

1. Detect when a skill's stated floor is older than the project floor (CC ≥ 2.1.139).
2. Surface skills that could adopt newer CC features (hooks fields, flags, APIs).
3. Block PRs that ship a skill whose floor is below a manifest-declared minimum.

The result: skill frontmatter rots silently.

## 📜 Evidence — current state of 92 skills with `compatibility:` floors

```
floor      count  status
─────      ─────  ──────────────────────────────────────────────
2.1.75       3   🔴 74 versions stale (component-search, design-*)
2.1.76      73   🔴 73 versions stale  ← 79% of all skills
2.1.78       2   🔴
2.1.81       1   🔴
2.1.84       1   🔴
2.1.86       1   🔴
2.1.91       1   🔴
2.1.98       4   🔴 (implement, verify)
2.1.108      2   🟡 (brainstorm)
2.1.111      1   🟡
2.1.139      2   🟢 at floor
2.1.142      1   🟢 above floor
─────────  ─── 
Total       92
Below floor 88 (96%)
```

19 skills have no `compatibility:` field at all → silent failure mode.

## 🔥 Why Now

CC 2.1.140 → 2.1.146 shipped concrete adoption opportunities (cf. project memory
on `shared/cc-snapshots/`):

- **2.1.145** Stop/SubagentStop hooks now receive `background_tasks` + `session_crons`
  → 6+ skills currently hand-roll this.
- **2.1.145** OTEL `agent_id` / `parent_agent_id` on tool spans
  → observability skills lag.
- **2.1.143** `worktree.bgIsolation: "none"` escape hatch
  → worktree-pain skills (cover, implement) should mention it.
- **2.1.142** `--effort`, `--model`, `--permission-mode` on `claude agents`
  → /ork:cover, /ork:implement could parameterize.

A linter can catch all of these mechanically.

## 🎯 Scope

### In scope
1. **Static linter** — scan `src/skills/*/SKILL.md` frontmatter `compatibility:` field;
   compare against (a) project floor in CLAUDE.md (b) latest snapshot in
   `shared/cc-snapshots/`.
2. **Drift report** — per-skill JSON output: `{skill, floor, deltaVsProjectFloor,
   missedFeaturesSinceFloor}`.
3. **Feature-mention check** — grep each skill body for known CC API surface;
   emit hits/misses. Snapshot-driven rules table.
4. **CI gate** — `npm run test:skill-compat` fails when (a) skill floor < project
   floor, or (b) snapshot ≥ 5 versions newer than any individual skill floor.
5. **Auto-fix mode** — `--fix` flag bumps stale floors to project floor (safe path:
   floor-only, no body edits).

### Out of scope
- Rewriting skill bodies to adopt new APIs (manual review per skill).
- Subagent compatibility (separate workstream — `src/agents/*.md` has no `compatibility:` field).
- LLM-based evaluation (deterministic rules only in v1).

## 📜 Proposed Child Issues

```
#  Title                                       Size  Depends on
── ─────────────────────────────────────────── ───── ──────────
1  Add compatibility field to 19 missing skills   S   —
2  Build compat-floor linter (scripts/lint-      M    —
   skill-compat.mjs)
3  Snapshot-driven feature-rules table           S    —
   (shared/cc-snapshots/index.json)
4  Drift report — JSON + ASCII summary           S    #2
5  `npm run test:skill-compat` + manifest test   M    #2, #3
   integration
6  CI gate wiring (.github/workflows/test.yml)   S    #5
7  --fix mode — bump-only floor rewriter         M    #2
8  Adoption sweep — bump 88 stale floors via #7  S    #7 (mechanical)
9  Docs — CONTRIBUTING-SKILLS.md compat section  XS   #5
   update
```

**Total estimate**: 4 S + 3 M + 1 XS = ~3 working days if sequential.

## ✅ Acceptance Criteria

- [ ] `npm run test:skill-compat` exists and fails on any skill with floor < 2.1.139.
- [ ] All 111 skills have a `compatibility:` frontmatter field.
- [ ] Drift report identifies skills where ≥ 5 CC versions have shipped since their floor.
- [ ] CI gate blocks PRs introducing new stale skills.
- [ ] Adoption sweep applied — no skill below current project floor.
- [ ] `CONTRIBUTING-SKILLS.md` documents the compat policy + how to bump.

## ❌ Non-Goals (explicitly)

- **No LLM-graded skill quality assessment.** Keep v1 deterministic — version
  strings, regex, file presence. LLM grading is a future milestone (M???).
- **No subagent (`src/agents/*.md`) coverage** — out of scope; agents don't currently
  carry `compatibility:`. Add later if needed.
- **No automatic body edits.** `--fix` touches only the floor string in frontmatter.

## 📜 Related Memory

- `feedback_release_please_extra_files.md` — version files are governed by config,
  do not hand-edit. M170 linter touches `compatibility:` not anchor versions, so safe.
- Stored decision: "auto evaluate skills against latest cc" — direct source.

## ⚠️ Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bumping 88 floors triggers manifest test failures | M | #6 runs after #2 + #3, CI is the safety net |
| Feature-mention check produces false positives | H | Make it advisory in v1, not a gate |
| `--fix` mode mass-touches all 111 skills → noisy PR | M | One PR per ~20 skills; or per-tier batches |
| Snapshot drift if `shared/cc-snapshots/` lags upstream | M | Existing `cc-watch` pipeline already snapshots |

## ⏸ Sequencing

```
Week 1: #1 #2 #3 #4          (linter + data layer)
Week 2: #5 #6 #9             (CI integration + docs)
Week 3: #7 #8                (auto-fix + adoption sweep)
```

## 📜 Out

Once M170 ships, the **same linter framework** can extend to:
- Subagent (`src/agents/*.md`) frontmatter validation
- Hook (`src/hooks/hooks.json`) feature audit
- LLM-graded skill quality (future M)

End.

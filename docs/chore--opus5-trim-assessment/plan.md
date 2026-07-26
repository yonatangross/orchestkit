## 0. AUDIT INTEGRITY FIRST

6 dimension reports arrived, not 7 (`rules`, `live-skills`, `agents`, `index-tax`, `anachronism`, `overlap`). ~87 findings total. **48 survived adversarial verification (~55%).** Everything refuted is dropped below and named so it does not get smuggled back.

```
DIMENSION        FINDINGS  UPHELD  REFUTED   VERIFIER'S ONE-LINE
rules               18       11       7      antipatterns.md is HOOK-GENERATED, not prose
live-skills         20       16       4      MCP-probe cut would break a 3-consumer contract
agents              10        3       7      desc rewrite already A/B'd at delta-0; would blow CI cap
index-tax            9        3       6      metrology real, remediation deletes 15 skills outright
anachronism         11        7       4      `compatibility:` is stamper-maintained, not rot
overlap             19        8      10      the "39 unreachable skills" spine is a fabricated grep
```

I re-measured the load-bearing numbers myself rather than trusting either side.

---

## 1. THE VERDICT: the thesis is 20% right and pointed at the wrong target

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CLAIM                          │ VERDICT │ NUMBER                        │
├────────────────────────────────┼─────────┼───────────────────────────────┤
│ "121,718 B of always-loaded    │ ❌ FALSE│ Real index = 23,469 B         │
│  skill frontmatter, ~30k tok"  │         │ (59 skills × name+desc)       │
│                                │         │ = 5,867 tok. 5.2x overstated. │
├────────────────────────────────┼─────────┼───────────────────────────────┤
│ "97 skills never invoked       │ ❌ FALSE│ 55 of 114 are DELIBERATELY    │
│  = dead weight"                │         │ hidden (dmi:true, documented  │
│                                │         │ 2-tier design, CONTRIBUTING-  │
│                                │         │ SKILLS.md:124). 87 skills are │
│                                │         │ statically wired. TRUE        │
│                                │         │ orphans = 9. Measured.        │
├────────────────────────────────┼─────────┼───────────────────────────────┤
│ "36 specialist agents lose to  │ ❌ FALSE│ Repo already A/B'd description│
│  Explore because descriptions  │         │ rewrites: delta-0 routing     │
│  are vague; rewrite them"      │         │ gain (audit-activation/SKILL. │
│                                │         │ md:92). Descs are 249/250 B   │
│                                │         │ from a hard CI cap. Rewriting │
│                                │         │ makes the real tax 72% WORSE. │
├────────────────────────────────┼─────────┼───────────────────────────────┤
│ "Anthropic cut ~80%, so can we"│ ⚠️ 20%  │ Defensible per-session cut =  │
│                                │         │ ~1,900 tok of 9,977 (19%).    │
│                                │         │ Defensible src cut = ~530 KB  │
│                                │         │ of 9.99 MB (5.3%).            │
├────────────────────────────────┼─────────┼───────────────────────────────┤
│ "Scaffolding is actively       │ ✅ TRUE  │ 5 SHIPPED BUGS hiding inside  │
│  harmful"                      │         │ 500-line ceremony files, incl.│
│                                │         │ one that tells an Opus 5 user │
│                                │         │ to DOWNGRADE, and a budget    │
│                                │         │ gate measuring the wrong set. │
└──────────────────────────────────────────────────────────────────────────┘
```

**The honest reframe:** this repo does not have a token problem. It has a **defect-concealment problem**. The per-session tax is 9,977 tokens (measured, below), which is fine. But `create-pr` has shipped a `--base dev` against a repo with no `dev` branch, `/ork:help` greps a path marketplace users do not have, `cover` ships a workaround the sibling skill explicitly refutes, `doctor` prescribes an Opus 4.8 downgrade, and 21 skills instruct a tool no skill is permitted to call. All five sat undetected because nobody can read a 500-line file. That is what "dead weight is harmful" actually means here.

**And the repo's own budget gate is broken and red today** (I ran it): it models the skill index as `user-invocable: true` (35 skills × 80 tok = 2,800) when the real model-facing set is `disable-model-invocation != true` (59 skills = 5,867 tok). It undercounts by ~3,100 tokens, is blind to 34 skills that DO cost index bytes, and charges for 10 slash-only skills that cost zero. It fails at 6,235/5,500 while measuring the wrong thing.

---

## 2. THE CUT LIST IN WAVES

### 🔴 WAVE 0 — Ship the 5 confirmed bugs first (not a cut; ~0 bytes, highest value)

| # | Defect | File:line | Fix |
|---|--------|-----------|-----|
| 1 | Tells Opus 5 users to downgrade to Opus 4.8 | `src/skills/doctor/SKILL.md:171,178-182` (+`assess/SKILL.md:54,56` cross-ref) | Capability check, not model name. **Do NOT route through `models.vocab.json`** — it has zero `xhigh` field (verified). Needs a schema add first, or hardcode the supported-effort list in doctor. |
| 2 | `--base dev` in a repo with no `dev` branch | `create-pr/SKILL.md:24` (**always-loaded frontmatter**), `:184,:185,:213,:380`; `cover/SKILL.md:287` | `BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD \| sed 's\|^origin/\|\|')`. **Do NOT touch `:153`** — that guard correctly rejects both `dev` and `main`. |
| 3 | `/ork:help` greps `src/skills`, absent for every installed user; silently falls back to a hardcoded 18-of-114 table | `help/SKILL.md:55-66`, `:108-124` | `${CLAUDE_PLUGIN_ROOT}/skills` with `src/skills` fallback; delete the hardcoded table (it contradicts `:69`). |
| 4 | `cover` mandates a manual worktree workaround for a CC 4.7 bug, contradicting `implement:340-345` and the doc it cites (`manual-worktree-pattern.md:3` = "⚠ SUPERSEDED") | `cover/SKILL.md:263-290,:310` | Delete. Use `Agent(isolation="worktree")`. -3,100 B. |
| 5 | `TaskGet(...)` instructed in **21** SKILL.md files, permitted in **0** allowlists | 21 files | Delete the line. **Then fix the class**: `commit/SKILL.md` declares `allowed-tools: [Bash]` and calls AskUserQuestion/Write/Read; `create-pr` calls Write+Read undeclared; `assess`, `explore` call Write; `remember` calls AskUserQuestion. **11 tool names across 10 skills. `tests/skills/audit-skill-permissions.sh` only checks the key EXISTS — it never checks coverage.** That missing assertion is the generator of the bug. |

**Verify:** `npm run test:skills && npm run test:agents && npm run build` (stage `plugins/`).

---

### 🟢 WAVE 1 — Zero-risk deletions (mechanical, no judgement)

| Target | Bytes | Files | Risk | Note |
|--------|-------|-------|------|------|
| 9 true orphans (dmi:true + ui:false + zero inbound refs): `audit-skills, checkpoint-resume, feedback, notebooklm, presentation-builder, release-checklist, skill-evolution, upgrade-assessment, validate-counts` | **281,567** | 9 dirs | med | ⚠️ 2 have NON-frontmatter wiring: `skill-evolution` is named in `ork:auto`'s routing description; `feedback` appears in 39 files under `src/hooks/src`. Grep each before `rm`. |
| Agent `## Task Management` CC-2.1.16 tutorial (restates the TaskCreate tool schema) | **11,324** | 32 agents | low | 31/34 byte-identical. Verifier-measured. |
| Skill TaskCreate/TaskUpdate 8-subtask ceremony block | ~11,900 | 8 skills | low | Serial `addBlockedBy` chain is wrong the moment phases parallelise. |
| CC-changelog archaeology in skills (Progressive Output 2.1.76, Monitor 2.1.98, `/recap`, Focus mode, PostCompact, rewind menu) — every version is below the declared 2.1.220 floor | ~12,000 | 7 skills | low | `/recap` + focus-mode notes instruct the USER, injected into the MODEL's context. |
| Pseudo-Python argv parsers (`token.split("=",1)[1]` tutorials) | ~5,000 | 11 skills | low | `argument-hint:` already states the flags. |
| Agent `## Opus 4.8: 128K Output Tokens` sections | **2,368** | 10 agents | low | Verifier-measured. |
| Agent "Consult project memory…" boilerplate | **3,720** | 20 agents | low | All 20 already carry `memory:` frontmatter or `mcp__memory__*`. |
| `brainstorm` Agent Teams: 4 verbatim agent prompts + 8 CC block quotes | **6,514** | 1 | low | ⚠️ **KEEP `:116-124`** — the AskUserQuestion 4-option cap + dead preview-nav bug (dated 2026-05-28) is incident-backed, non-derivable. |
| `implement` Budget Awareness (advisory metric the model cannot compute) | **1,003** | 1 | low | Self-labelled placeholder for an unshipped API. |
| `testing-patterns` redirect stub | **12,160** + **270 index B** | 1 dir | low | ⚠️ It is `ui:false` with no command file — **delete the dir, do NOT flag it** (flagging = unreachable). |
| `eval-golden.md:9` schema line (`expected_behavior`/`grader_type`) | ~90 | 1 | low | **0 of 166** yaml files under `tests/evals/` contain either token. DELETE, do not merge. |
| CLAUDE.md `Critical Rules` block → 4 lines | **~260** | 1 | low | ⚠️ Whole-file release-please governed → needs `release-please-override` label. |

**Wave 1 total: ~348 KB src, ~530 index+session bytes.**
**Verify:** `npm run test:skills`, `npm run test:agents`, `bash tests/orphans/test-orphan-agents.sh` (must stay "All agents referenced"), `bash bin/validate-counts.sh`, `npm run build`.

---

### 🟡 WAVE 2 — Merges

| Merge | Bytes | Risk | Blocking prerequisite |
|-------|-------|------|----------------------|
| `product-frameworks` → delete (31 of 49 files are **byte-identical** to the 7 skills split out of it) | **174,386** | med | ⚠️ It IS in an agent's `skills:` list. Must remove the reference in the same commit or the agent fails to load. Verified: this is a live delete, not an orphan. |
| `design-ship` → `--ship` flag on `design-import` (the two longest descriptions in the index, 768 + 751 B, each spending its tail disambiguating from the other) | 10,395 + **~790 index B** | low | Neither has ever been invoked. |
| 5 `testing-*` skills → one `testing` (keep only: emulate-first house policy, Vitest 4.1 `aroundEach`, Playwright, k6 v1.0, Storybook 10 version deltas) | ~318,000 | **med** | ⚠️ 4+ agents declare individual `testing-*` skills. Rewrite agent frontmatter in the same commit. Do this LAST. |
| Agent `Status Protocol`: keep the inline enum, delete only the trailing "Never report DONE if you have concerns" sentence | **~2,100** | low | ❌ **Do NOT** collapse to a `Read()` of `shared/status-protocol.md` — that file is 2,238 B vs 208 B inline, a 10x per-spawn PESSIMIZATION across 1,135 spawns. |

**Wave 2 total: ~505 KB src, ~790 index bytes.**
**Verify:** every merge needs `grep -rn '<deleted-skill>' src/agents src/skills` returning clean, then `npm run test:agents`.

---

### 🟠 WAVE 3 — Rewrites (judgement required, one decision per file)

| Target | Action | Saving |
|--------|--------|--------|
| The 8 longest index descriptions (`design-import` 768, `design-ship` 751, `auto` 721, `storybook-mcp-integration` 684, `mcp-visual-output` 679, `portless` 659, `design-to-code` 653, `verify` 615) | Trim toward ~300 B each. **Keep every negative/redirect clause** — there are 16 of them and they are the highest-value bytes in the index. **Do NOT gut `auto`'s routing table** (it is the front door and its recursion guard is non-derivable). | **~3,100 index B / ~775 tok** |
| "Use when" restatement tails across 54 index skills (measured: 6,611 B total) | Delete only tails that are verb-conjugations of the preceding sentence. Keep tails naming an input artifact/state (`design-context-extract`: "a screenshot, URL, or video" is real routing signal). | **~3,300 index B / ~825 tok** |
| `assess` dimension set: description says 6, `AskUserQuestion:139` says 4, `rubric.json` + verdict schema say 7 (`scalability`+`compliance` unadvertised). `implement/SKILL.md:141` hard-gates on `rubric.json`. | Make all four agree on the 7 in `rubric.json`. Delete the 4-option AskUserQuestion (`--effort` already controls depth). | ~600 B, **removes a silent merge-gate failure** |
| `commit/SKILL.md:103-119` hardcodes `poetry run ruff/mypy` — 4 of 6 commands fail in this repo | Detect from `package.json` scripts / `pyproject.toml`. | ~300 B, fixes a "runs and fails" path |
| `auto/SKILL.md:32` cites "112 skills" and "10 distinct skills" telemetry | Drop the counts, keep the mechanism. **Note the correct telemetry: `ork:auto` = 5 invocations, not 58 — the index-tax dimension summed `hq-ext:auto` (53) into it.** | ~200 B |
| `doctor` + 9 files: `Opus 4.8` prose (79 occurrences tree-wide, `test-model-recency.sh` reports 0 because it only matches ID-shaped strings) | Fix the 4 occurrences in `audit-full` (not just `:5`) and the 6 in `doctor`. | ~2,000 B |
| `CONTRIBUTING-SKILLS.md:212` — states `.claude/rules/*.md` all auto-load. **False.** Only the 2 without `paths:` load. | Correct it. Highest-leverage doc fix in the repo: converts "rules are expensive" into "path-less rules are expensive". | 0 B, unblocks correct authoring |
| `CLAUDE.md:11` → `shared/rules/anti-sycophancy.md` does not exist (real path `src/skills/shared/rules/`); `visual-style.md` → `tests/perf/` does not exist (real: `tests/performance/`) | Fix both paths. | 0 B |
| `frontend-ui-developer.md:514-558` "Anti-Patterns (FORBIDDEN)" | ⚠️ **INVERTED from the original report.** ~11 of 16 NEVERs encode real wiring (`@/lib/dates`, `useFormatting`, `@/lib/animations`, `AnimatePresence`, `i18n.t('time.minutesShort')`, `bg-primary` tokens). Cut only the ~3 generic ones (raw fetch, non-exhaustive switch, console.log). **The actual bug in this file is that those paths belong to a DIFFERENT project and ship to every ork consumer** — plus `:497 "## Standards (Updated Jan 2026)"`. | ~400 B + fixes a real defect |
| `Grounding Protocol` on the 4 agents that literally say "Δ0 on Opus" then justify with "this agent runs on a cheaper tier (`inherit`)" (`frontend-ui-developer:78`, `ci-cd-engineer:66`, `product-strategist:56`, `test-generator:65-66`) | ⚠️ **Fix the prose, do NOT delete the block.** Every one of the 14 blocks ends with "cross-check against `.claude/rules/antipatterns.md`" + "read the lockfile" — both non-derivable. `backend-system-architect:74` and `code-quality-reviewer` do NOT say Δ0; leave them. `infrastructure-architect:64` is a 7th `inherit` agent the report missed. | ~200 B, removes a false premise |

**Wave 3 index total: ~6,400 B → ~1,600 tokens/session.**
**Verify:** `bash tests/performance/test-token-overhead.sh` (Test 3 + Test 4 must stay green), `npm run test:skills`.

---

### 🔵 WAVE 4 — Ban-voice → judgement-voice

The repo already wrote the user's exact thesis and then exempted the one file that loads every session:

> `CONTRIBUTING-SKILLS.md:529` — "If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow flag. Today's LLMs are smart… when given a clear explanation of *why* something matters, they go beyond rote instructions."

Meanwhile `CLAUDE.md` carries 5 caps-bans. Convert, do not delete:

| Rule | Keep? | Rewrite to |
|------|-------|-----------|
| `CLAUDE.md:36` "NEVER edit `plugins/`" | ✅ INFORMATIVE | "`plugins/` is regenerated by `npm run build`; edits there are overwritten." |
| `CLAUDE.md:81` "NEVER `gh issue close`" | ✅ INFORMATIVE | "Issues close via `Closes #N` when CI merges the PR; closing by hand breaks that link." |
| `CLAUDE.md:66` "don't commit secrets / skip security tests / bypass with `--no-verify`" | ❌ HOBBLING | "`bin/git-hooks/pre-push:322` runs the security suite, so `--no-verify` only relocates the failure to CI." (gitleaks already runs at `ci.yml:162`.) |
| `CLAUDE.md:64` "use TaskCreate for 3+ step work" | ⚠️ KEEP | The `todo-enforcer` hook that once backed this is **gone** (`entries/prompt.ts:29` is a stale comment). Cutting it removes the only surviving control. |
| `CLAUDE.md:7` "Never Hebrew. No exceptions." | ⚠️ CONFLICT | Directly overrides the user-global "unless explicitly asked otherwise". Pick one. |
| `scripts-conventions.md` strict-mode/quoting/shellcheck bullets | ❌ HOBBLING (119 B, path-scoped so 0 session cost) | Keep only `set -x` + secrets. Dedupe — that one fact is stated in 3 files. |
| `usage-analytics-hardening.md` Refactoring + "every 5 files" | ⚠️ REWRITE (always-loaded, 1,886 B) | Keep worktree + 1Password verbatim (incident-backed). Compress Refactoring to the hook's blind spot ("`stale-import-detector` does not see files you never touched"). Replace "every 5 files" with the reason. ~190 B. |
| `design-stylecards` NEVERs, `cc-native-first.md`, `eval-runner.md:69` | ✅ **KEEP VERBATIM** | These are the house style: verdict + the evidence that produced it + the failure that happens without it. |

---

## 3. HARD NUMBERS

```
                              BEFORE          AFTER (all 4 waves)     DELTA
─────────────────────────────────────────────────────────────────────────────
Skills (SKILL.md)               114              ~98                 -16
  · model-facing index           59               56                  -3
  · slash-only / wired           55               42                 -13
Agents                           36               36                   0  ⚠️
─────────────────────────────────────────────────────────────────────────────
PER-SESSION ALWAYS-LOADED (measured today, project-controlled)
  CLAUDE.md                    4,621 B  1,156t   4,320 B  1,080t     -76t
  MEMORY.md (200 lines)        3,798 B    950t   3,798 B    950t       0
  Agent descriptions (36)      5,314 B  1,329t   5,314 B  1,329t       0  ⚠️
  Skill index (59 name+desc)  23,469 B  5,867t  16,900 B  4,225t  -1,642t
  Path-less .claude/rules      2,701 B    675t   2,100 B    525t    -150t
─────────────────────────────────────────────────────────────────────────────
  TOTAL SESSION TAX          39,903 B  9,977t  32,432 B  8,109t  -1,868t
                                                                    (-19%)
─────────────────────────────────────────────────────────────────────────────
src/ total                   9,988,725 B      ~9,459,000 B        -529 KB
  src/skills                  9,556,659 B      ~9,050,000 B        (-5.3%)
  src/agents                    432,066 B         ~409,000 B
Live-15-skill bodies (on-invoke) 231 KB            ~185 KB          -46 KB
─────────────────────────────────────────────────────────────────────────────
Confirmed shipped bugs             5                  0
Untested invariants                3                  0  (see §5)
```

⚠️ **Agent descriptions stay at 5,314 B and agent count stays at 36.** Both were headline recommendations and both are refuted: the descriptions are 249/250 B from a hard CI cap with an in-repo A/B showing delta-0 routing gain from rewriting, and `tests/orphans/test-orphan-agents.sh` passes clean on all 36 — including the 6 "never spawned" ones, which are dispatched by name from skills (`design-import/SKILL.md:139` literally contains `subagent_type="ork:claude-design-orchestrator"` and `:4` declares it a hard requirement).

⚠️ Not counted above because nobody has measured it honestly: the six indexed pattern-libraries (`security-patterns`, `performance`, `database-patterns`, `python-backend`, `api-design`, `architecture-patterns`, ~1.5 MB) are largely OWASP/Core-Web-Vitals/AAA restatement wrapped around a thin layer of real version pins. The "1,350,000 bytes saved" figure was the **only** byte claim in 87 findings that I could not reproduce. Measure it before committing; the salvage set is real (`references/{cc-permission-model,langfuse-mask-callback,presidio-integration,zod-v4-api}.md`, RFC 9457, SQLAlchemy-2.0-async).

---

## 4. WHAT MUST NOT BE CUT

```
🔒 Agent frontmatter enforcement — 33/36 declare agent-scoped `hooks:`,
   8 declare `disallowedTools: [Write,Edit,MultiEdit]`, 29 scope `mcpServers`.
   This is ENFORCEMENT, not information. `disallowedTools` on a reviewer is
   what makes the review honest. Zero of it is derivable.

🔒 Agent `skills:` blocks — 36/36 declare them, they survive the build, and
   `tests/agents/test-frontend-performance-engineer.sh:41` requires the field.
   The overlap dimension's central claim ("grep returns EMPTY, no agent
   declares any skill") is FABRICATED. 87 skills are reachable through it.
   Acting on that finding would have deleted 30 wired skills.

🔒 `.claude/context/session/state.json` Context Protocol in 25 agents — the
   file EXISTS, is populated right now (session 61366a40), is written by
   `lifecycle/session-env-setup.ts:88-99`, and is schema-validated by
   `tests/run-all-tests.sh:173`. Deleting these pointers was the single most
   destructive recommendation in the whole audit.

🔒 The MCP capability probe + `.claude/chain/capabilities.json` — the PLUGIN
   ships NO `.mcp.json`. The `alwaysLoad` guarantee is local to THIS repo only.
   Three references consume the file (`chain-patterns/references/tier-fallbacks
   .md:27,41`, `rules/probe-before-use.md:27`, `references/mcp-detection.md:37`).
   Cutting it deletes graceful degradation for every non-dogfood user.

🔒 `compatibility:` on 114 skills — NOT index-loaded, and actively maintained
   by `scripts/stamp-cc-support.mjs:214-300`, gated by two tests, shipped in
   PR #3141 one day before this audit. The uniform 83 exist so the next floor
   bump has a per-skill anchor.

🔒 `.claude/rules/antipatterns.md` — GENERATED at SessionStart by
   `lifecycle/sync-session-dispatcher.ts:79`. `git rm` yields a dirty tree that
   regenerates. 9 agent bodies cite it by path as a mandatory step. To shrink
   it, edit `STATIC_ANTIPATTERNS` in `prompt/antipattern-warning.ts`.

🔒 Quality Bar sections (10 of 15 live skills) — the only content written as
   checkable POSTCONDITIONS rather than procedure. `verify`'s REACHED/UNREACHED
   distinction is incident-backed ("a validator shipped 2026-07-19 was fully
   defined, fully tested, and never called at its call site").

🔒 `dream` and `quickviz` — 100% informative. Every guard names the incident
   that produced it. Use `dream`'s shape (algorithm + guard + incident) as the
   rewrite target for `implement`/`verify`/`cover`/`assess`.

🔒 `cc-native-first.md`, `eval-runner.md:69`, `design-stylecards` NEVERs,
   `rules-meta.md` — ban-voice that EARNS the ban. cc-native-first documents a
   measured 60% error rate on the alternative. That is the criterion.

🔒 The 16 negative/redirect clauses in skill descriptions ("Do NOT use to grade
   tests that already exist"). ~23x value-per-byte vs "Use when". EXPAND these.
```

---

## 5. THE 5 HIGHEST-LEVERAGE IMPROVEMENTS

**1. Fix the token-overhead gate to measure the real index — it is red today and wrong.**
`tests/performance/test-token-overhead.sh:196` counts `user-invocable: true` (35). The model-facing set is `disable-model-invocation != true` (**59**). 10 skills are `ui:true + dmi:true` (slash-only, cost **zero** index) and are being charged; 34 are `ui:false + dmi:false` (cost **real** index) and are invisible. Live result: gate reports 6,235 tok vs 5,500 budget; truth is ~9,977. Swap the predicate, measure actual `name+description` bytes instead of `count × 80`, then re-baseline the budget honestly.

**2. Assert that `allowed-tools:` covers every tool the body instructs.**
`tests/skills/audit-skill-permissions.sh:56,105` only checks the key exists. That gap shipped `TaskGet` in 21 files and a `commit` skill that declares `[Bash]` then calls AskUserQuestion, Write and Read. One test kills an 11-name, 10-file class permanently.

**3. Add a reachability gate: `dmi:true + ui:false + zero inbound refs` = fail.**
This is the check that would have found the 9 real orphans, and — critically — the check whose ABSENCE let an auditor claim 39. Pair it with a rule that `dmi:true + ui:false` is only legal with a declared consumer. Fix `CLAUDE.md`'s agent-frontmatter line to name `skills:` correctly while you are there (it is currently right; do not "fix" it to say agents have no skills).

**4. Extend `test-model-recency.sh` to catch prose model claims, not just ID-shaped ones.**
It scans 1,698 files and reports **0 superseded** while 79 `Opus 4.8` prose mentions sit in the tree, including `## Opus 4.8: 128K Output Tokens` headers and a `doctor` check that prescribes a downgrade. Without this, every fix in Wave 3 re-rots at Opus 6. Same gate should reject hardcoded `CC 2.1.NN` stamps in agent bodies (20 files carry them; the floor lives in CLAUDE.md and is already CI-tested).

**5. Close the visual-style / sub-agent loop mechanically, and stop counting hook output as free.**
`CLAUDE.md:15` says "Sub-agents do NOT inherit this; restate it in their prompt" — a rule whose compliance depends on unaided recall at N call sites. `prompt/visual-style-nudge.ts` (shipped 2026-07-26) already re-anchors every 8th prompt, so the static sentence is now near-duplicate. Separately: **the per-turn hook `systemMessage` tax is on nobody's ledger.** The display-lint hook fired on every Bash call in this very session at 200-434 chars each. Under the operating thesis those are the strongest hobbling candidates in the repo — behavioral prohibitions, injected repeatedly, that no static byte count sees. Measure them from `~/.claude/analytics/hook-timing.jsonl` before optimizing another byte of `CLAUDE.md`.

---

**Sequencing:** Wave 0 → Wave 1 → measure → Wave 3 index trims → Wave 2 merges last (they need agent-frontmatter surgery) → Wave 4 anytime. `CLAUDE.md` edits need the `release-please-override` label (`count-sync.md:33-35`: whole-file governed path). Every wave ends with `npm run build` and staging `plugins/` alongside `src/`.
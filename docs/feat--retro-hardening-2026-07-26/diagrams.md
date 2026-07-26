# Retro-Hardening Plan — Diagrams & Provenance

Source-of-truth Mermaid for the 6 mechanisms rendered as an interactive dashboard in
`plan-viz.html`. Every BEFORE diagram traces a real incident from this session's
`compaction-summary.txt` and verified repo state (not hypothetical). Every AFTER diagram
shows where the proposed control intercepts the same chain.

> **Mermaid gotcha:** `classDef` colors below are **hex**, never `hsl()` — `hsl()` breaks
> when these diagrams are re-rendered inside an HTML playground. The playground itself
> (`plan-viz.html`) does not embed the Mermaid runtime (zero external deps per
> `playground-visual-standard.md` — same precedent as `decision-router.template.html`,
> which replaced Mermaid with inline SVG); these are the authored source diagrams.

Verdict legend: 🟢 SHIP · 🟡 PARK · 🔴 KILL

---

## Status after correctness assessment (2026-07-26, /ork:assess correctness, 6.0/10)

A dedicated correctness pass over this plan (pre-implementation) revised the board.
Full findings live in the assess transcript; the load-bearing deltas:

| # | Was | Now | Why |
|---|-----|-----|-----|
| 5 | 🟢 SHIP | ✅ **BUILT** | `bin/check-skill-invocable.sh`, 6-link chain check, mutation-verified (stale-build flip caught by `--all`). |
| 6 | 🟢 SHIP | ✅ **BUILT** | `pretool/write-edit/context-file-budget-guard.ts`, 12 tests, wired at all 3 points (see below). |
| 1 | 🟢 SHIP | 🟡 **PAPER FIRST** | Self-contradiction: the design forbids network calls in-hook (<50ms budget) but its own decision gate ("queue already deep") is only knowable via `gh api`. As written it is either a blanket ASK on every `gh run cancel|rerun` (false-positive heavy for routine CI use) or it needs the call it forbids. ALSO: a verbatim sync of personal patterns #12/#13 into the public repo would leak HQ-private detail (org names, PR numbers, credential-rotation steps) — the sync needs a genericization pass, not a copy. |
| 3 | 🟢 SHIP | 🔴 **REDESIGN** | No data source: the WorktreeCreate `HookInput` carries only `project_dir` + `worktree_name`, and `project_dir` IS the wrong value in the incident this guard targets. No `expected_repo` field exists anywhere in the contract. The guard likely belongs at `PreToolUse:Task` dispatch time (where declared intent still exists), not at worktree provisioning. Plus unhandled edge cases: forks (origin legitimately differs), no-remote repos (skip-not-refuse), bare worktrees. |

**Wiring correction the assess caught (applies to any future hook here):** registration
is **3-point**, not 2-point — `hooks.json` (dispatcher only) + `entries/<event>.ts`
import-and-map + **the dispatcher's internal array** (`WRITE_EDIT_HOOKS[]` /
`BASH_HOOKS[]`). A hook present in the first two but absent from the array never runs:
the #959 dead-hook class one layer deeper than the checklist guarded.

---

## Pipeline provenance

```mermaid
flowchart LR
    A["brainstorm\n6 mechanisms proposed"] --> B["inline fact-check\ncaught 11-vs-13 pattern\ncount fork; confirmed\nworktree-provisioner.ts:209"]
    B --> C["adversarial assess\nSHIP / PARK / KILL\nper mechanism"]
    C --> D["this plan\ndocs/feat--retro-hardening-2026-07-26/"]

    classDef stage fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class A,B,C,D stage;
```

The fact-check step matters on its own: the brainstorm draft cited the ci-debug playbook
at "11 patterns"; the live file (`~/.claude/skills/ci-debug/SKILL.md`) is actually at
**13** (row 13 = `Runner-pool starvation misread as CI failure`, added THIS session).
Confirmed by grepping the table directly rather than trusting the draft's count.

---

## Mechanism 1 — 🟢 SHIP — ci-debug fork-sync + ASK hook on `gh run cancel|rerun`/`update-branch`

**Measured damage:** 4 self-inflicted supersessions on platform PR #9083 (ci-debug
pattern #13, dated 2026-07-26): "Both `update-branch` and `gh run rerun` queue a NEW
request into the same branch concurrency group, which cancels the run you are waiting
for and sends it to the BACK of the queue" — oldest queued run landed 2h+ behind a
36-deep backlog on 6 runners.

### BEFORE — the self-inflicted stall

```mermaid
flowchart TD
    Q1["Queue: 36 deep\n6 hetzner runners"] --> R1["PR #9083 run\nqueued"]
    R1 --> W["/ci-debug diagnosis\nin progress"]
    W -->|"gh run rerun /\nupdate-branch #1"| C1["Same concurrency group\nCANCELS waiting run"]
    C1 -->|"requeues to back"| Q2["Queue: still 36+\nrun now further back"]
    Q2 -->|"gh run rerun #2, #3, #4"| C1
    C1 --> STALL["4 supersessions\n2h+ delay"]

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class C1,STALL bad;
    class Q1,R1,W,Q2 neutral;
```

### AFTER — ASK hook intercepts the mutating call

```mermaid
flowchart TD
    Q1["Queue: 36 deep\n6 hetzner runners"] --> R1["PR #9083 run\nqueued"]
    R1 --> W["/ci-debug diagnosis\nin progress"]
    W -->|"gh run rerun /\nupdate-branch attempt"| ASK["ASK hook:\nfork-sync check —\nhas the ref actually\nchanged? show queue\ndepth, require confirm"]
    ASK -->|"ref unchanged,\nqueue already deep\n-> DENY by default"| SAFE["Run left alone,\nnatural drain"]
    ASK -->|"operator explicitly\nconfirms anyway"| PROCEED["Single controlled\nrerun, ack'd cost"]

    classDef good fill:#1c3a2e,stroke:#3f9e70,color:#d8f2e4,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class ASK,SAFE good;
    class Q1,R1,W,PROCEED neutral;
```

---

## Mechanism 2 — 🟡 PARK — PR evidence-gate (needs bounded spec)

**Measured damage (two incidents, same root cause — asserted before verified):**
- **$0-exposure claim:** initially reported a "live 19x production leak since 12:07Z"
  for Opus-5 pricing. A real Langfuse query showed **ZERO** `claude-opus-5` traces at
  any window (1d/7d/30d/90d) — actual exposure was **$0**. Self-corrected only after
  running the query.
- **13,250 vs 1,312 miscount:** a Langfuse purge-scope recommendation cited 1,312
  traces; the user pushed back ("why purge them? not useful? explain"), forcing
  re-investigation that found the real scope was **13,250** (10x off) — and that the
  producer bug was still actively creating ~1,924 new inflated traces in the prior
  2 days alone, meaning a purge then would have refilled immediately.

### BEFORE — claim ships ahead of the query

```mermaid
flowchart TD
    OBS["Observation:\nnew Opus-5 pin,\ncost-sensitive"] --> CLAIM1["Claim: live 19x\nprod leak since 12:07Z"]
    CLAIM1 --> USER1["Reported to user\nas fact"]
    USER1 -->|"query run\nAFTER the claim"| REAL1["Langfuse: 0 traces\nany window -> $0"]

    OBS2["Observation:\npurge candidate\ntraces"] --> CLAIM2["Claim: 1,312\ntraces to purge"]
    CLAIM2 --> USER2["Reported to user"]
    USER2 -->|"user pushes back:\nwhy purge them?"| REAL2["Recount: 13,250\n(10x off);\nproducer still live"]

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class CLAIM1,CLAIM2 bad;
    class OBS,USER1,REAL1,OBS2,USER2,REAL2 neutral;
```

### AFTER — evidence-gate blocks the unverified claim (shape only — spec not bounded yet)

```mermaid
flowchart TD
    OBS["Observation:\ncost/severity-shaped\nclaim drafted"] --> GATE{"Evidence-gate:\nlive query result\nattached?"}
    GATE -->|"no"| BLOCK["BLOCKED —\nrun the query first\n(Langfuse / count API)"]
    BLOCK --> QUERY["Real query:\n0 traces -> $0,\nor 13,250 not 1,312"]
    QUERY --> GATE
    GATE -->|"yes, evidence\nattached"| SHIP2["Claim ships with\nthe query result inline"]

    classDef park fill:#3a3320,stroke:#c9a13b,color:#f2e9d0,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class GATE,BLOCK park;
    class OBS,QUERY,SHIP2 neutral;
```

**Why PARK, not SHIP:** the mechanism shape is right, but "which claims are gated",
"what counts as evidence", and "how it composes with existing hooks" are undefined —
shipping now would either gate nothing (too narrow) or block routine status updates
(too broad).

---

## Mechanism 3 — 🟢 SHIP — worktree repo-identity guard at `worktree-provisioner.ts:209`

**Measured damage:** 2 of 3 dispatched `ork:` subagents (`ork:monitoring-engineer`,
`ork:llm-integrator`) spawned worktrees in the **wrong repository** (orchestkit,
instead of the intended platform/core), burned ~101k + ~127k ≈ **230k tokens**,
returned single-sentence non-answers, and left stray detached-HEAD worktrees with
0 commits / 0 dirty files.

Verified root cause — `src/hooks/src/worktree/worktree-provisioner.ts:209`:

```ts
const worktreePath = join(projectDir, '.worktrees', name);
```

`projectDir` (line 208) is `input.project_dir || process.cwd()` — accepted with no
check that it matches the repo the calling agent actually intends to target.

### BEFORE — no identity check at provisioning time

```mermaid
flowchart TD
    DISPATCH["Agent() dispatched:\ntarget = platform/core"] --> CWD["Actual cwd at\ndispatch time:\norchestkit"]
    CWD --> PROV["worktree-provisioner.ts:209\nworktreePath =\njoin(projectDir, ...)"]
    PROV -->|"no identity check"| WRONG["Worktree created\nin ORCHESTKIT,\nnot platform/core"]
    WRONG --> WORK["Subagent works\nin wrong repo,\nfinds nothing relevant"]
    WORK --> WASTE["~230k tokens burned\n(101k + 127k),\n1-sentence non-answer"]

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class WRONG,WASTE bad;
    class DISPATCH,CWD,PROV,WORK neutral;
```

### AFTER — repo-identity guard refuses the mismatch

```mermaid
flowchart TD
    DISPATCH["Agent() dispatched:\ntarget = platform/core"] --> CWD["Actual cwd at\ndispatch time:\norchestkit"]
    CWD --> PROV["worktree-provisioner.ts:209\n+ repo-identity guard"]
    PROV --> CHECK{"git remote / repo\nname matches\ndeclared target?"}
    CHECK -->|"no"| REFUSE["Refuse provisioning\n(or ASK): repo\nmismatch detected"]
    CHECK -->|"yes"| PROCEED["Worktree created\nin the CORRECT repo"]

    classDef good fill:#1c3a2e,stroke:#3f9e70,color:#d8f2e4,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class CHECK,REFUSE good;
    class DISPATCH,CWD,PROV,PROCEED neutral;
```

---

## Mechanism 4 — 🔴 KILL — display-lint circuit-breaker

**Context, not a fresh incident:** `display-lint`'s advisory nudge fired repeatedly
during THIS session alone (visible live in this task's own tool calls — 6+ separate
"[display-lint] N chars across M stages" notices). The proposed mechanism is a
per-session circuit-breaker that auto-suppresses the nudge after N repeats.

Issue **#2947** (`fix(hooks): display-lint counts quoted content and escaped operators
as shell stages`, state: CLOSED) already documents the real defect: `display-lint.ts`
reuses `normalizeCommand()` — a **security** primitive built to see through quoting —
for a **cosmetic** stage count, so quoted `|`/`;`/`&&` and escaped `\|` get counted as
real stages, manufacturing false positives (e.g. a single-stage `python3 -c "..."`
denied as "7 stages").

### BEFORE — noise treated as a volume problem

```mermaid
flowchart TD
    CMD["Bash command with\nquoted operators\n(python3 -c \"...\")"] --> LINT["display-lint.ts:63\nreuses normalizeCommand()\n(security primitive)"]
    LINT -->|"quoted content\ncounted as stages"| FALSEPOS["False positive:\n1 real stage counted\nas 7"]
    FALSEPOS --> NUDGE["Advisory nudge\nfires repeatedly"]
    NUDGE --> PROPOSAL["Proposed fix:\ncircuit-breaker to\nsuppress after N nudges"]

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class FALSEPOS,PROPOSAL bad;
    class CMD,LINT,NUDGE neutral;
```

### AFTER (killed) — a breaker on top of a broken counter is the wrong layer

```mermaid
flowchart TD
    CMD["Bash command with\nquoted operators"] --> LINT["display-lint.ts\ndedicated stage counter\n(blank quotes FIRST,\nnever unescape\nbefore splitting)"]
    LINT -->|"1 real stage,\ncounted as 1"| CORRECT["No false positive —\nnudge doesn't fire\nfor genuinely\nsingle-stage commands"]
    CORRECT -.->|"breaker never\nneeded here"| KILLED["KILLED: circuit-breaker\nwould have masked\nremaining REAL nudges\ntoo, not just false ones"]

    classDef good fill:#1c3a2e,stroke:#3f9e70,color:#d8f2e4,stroke-width:1px;
    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class LINT,CORRECT good;
    class KILLED bad;
    class CMD neutral;
```

**Why KILL:** the fix belongs in `countDisplayStages()` (blank quoted regions before
splitting, per `#2947`'s own proposed patch), not in a breaker that would silence
correct 3-real-stage denials along with the false ones. A breaker also does nothing
for the underlying miscount — the next session hits the same false positives, just
quieter about it.

---

## Mechanism 5 — 🟢 SHIP — `bin/check-skill-invocable.sh`

**Measured damage:** confirming whether `/hq-ext:handoff` was a real, invocable skill
took 3 separate lookups this session — `find ~/.claude/plugins ~/.claude/skills
-iname '*handoff*'`, a grep for `'Previous Session Handoff'`, and a manual scan of the
enumerated available-skills list — and still ended **ambiguous**: only a marketplace
directory (`plugins/marketplaces/yonatan-hq/skills/handoff`) and an unrelated
`validate-handoffs.sh` script turned up, with no confirmation the slash command
actually resolves.

### BEFORE — ad hoc filesystem archaeology, inconclusive

```mermaid
flowchart TD
    ASK["Is /hq-ext:handoff\ninvocable?"] --> F1["find ~/.claude/plugins\n~/.claude/skills\n-iname '*handoff*'"]
    F1 --> F2["grep -rl\n'Previous Session\nHandoff'"]
    F2 --> F3["manual scan of\nenumerated\navailable-skills list"]
    F3 --> AMBIG["3 lookups later:\nstill AMBIGUOUS —\nonly a marketplace dir\n+ unrelated script found"]

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class AMBIG bad;
    class ASK,F1,F2,F3 neutral;
```

### AFTER — one deterministic check

```mermaid
flowchart TD
    ASK["Is /hq-ext:handoff\ninvocable?"] --> SCRIPT["bin/check-skill-invocable.sh\nhq-ext:handoff"]
    SCRIPT --> MANIFEST["Reads the loaded\nplugin/skill manifest\ndirectly"]
    MANIFEST --> ANSWER["Deterministic answer:\nINVOCABLE / NOT FOUND,\nin one call"]

    classDef good fill:#1c3a2e,stroke:#3f9e70,color:#d8f2e4,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class SCRIPT,ANSWER good;
    class ASK,MANIFEST neutral;
```

---

## Mechanism 6 — 🟢 SHIP — pre-write byte-budget hook on `MEMORY.md`/`CLAUDE.md`

**Measured damage:** `MEMORY.md` was flagged by the PostToolUse hook as exceeding its
140-line target (measured at 180 lines / 176 memory files mid-session; 175 lines /
173 files at time of writing) **repeatedly across the whole session**, with zero
corrective action taken — `/ork:dream` compaction was explicitly deferred multiple
times as "not something to do mid-task", because the warning was advisory-only and
trivially easy to defer.

### BEFORE — advisory warning, no enforcement, ignored all session

```mermaid
flowchart TD
    WRITE["PostToolUse:\nwrite to MEMORY.md"] --> CHECK["Hook checks\nline count"]
    CHECK -->|"180 lines\n> 140 target"| WARN["Advisory warning\nlogged"]
    WARN --> DEFER["Deferred:\n'not mid-task'"]
    DEFER --> WRITE

    classDef bad fill:#3a1f24,stroke:#c4534f,color:#f2d9d7,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class WARN,DEFER bad;
    class WRITE,CHECK neutral;
```

### AFTER — pre-write hard gate

```mermaid
flowchart TD
    WRITE["PreToolUse:\nwrite to MEMORY.md\nor CLAUDE.md"] --> GATE{"Byte/line budget\nexceeded?"}
    GATE -->|"no"| PASS["Write proceeds"]
    GATE -->|"yes"| BLOCKW["BLOCKED —\nrun /ork:dream\ncompaction first"]
    BLOCKW --> DREAM["/ork:dream\nconsolidates,\nprunes, dedupes"]
    DREAM --> WRITE

    classDef good fill:#1c3a2e,stroke:#3f9e70,color:#d8f2e4,stroke-width:1px;
    classDef neutral fill:#1e2130,stroke:#4c5166,color:#e8eaf2,stroke-width:1px;
    class GATE,BLOCKW good;
    class WRITE,PASS,DREAM neutral;
```

---

## Scoreboard

| # | Mechanism | Verdict | Measured damage cited |
|---|-----------|---------|------------------------|
| 1 | ci-debug fork-sync + ASK hook on `gh run cancel/rerun`/`update-branch` | 🟢 SHIP | 4 self-inflicted supersessions (ci-debug pattern #13) |
| 2 | PR evidence-gate | 🟡 PARK — needs bounded spec | $0-exposure claim; 13,250 vs 1,312 miscount |
| 3 | worktree repo-identity guard (`worktree-provisioner.ts:209`) | 🟢 SHIP | ~230k tokens wasted (101k + 127k) in wrong-repo worktrees |
| 4 | display-lint circuit-breaker | 🔴 KILL — retreads #2947 | none fresh — duplicates tracked issue |
| 5 | `bin/check-skill-invocable.sh` | 🟢 SHIP | 3 ambiguous lookups for `/hq-ext:handoff` |
| 6 | pre-write byte-budget hook (`MEMORY.md`/`CLAUDE.md`) | 🟢 SHIP | 180/140 lines, ignored all session |

**Note on target directory:** RESOLVED — branch `feat/retro-hardening-2026-07-26` was
cut and this directory renamed to `docs/feat--retro-hardening-2026-07-26/` to match the
PR Playground CI gate's expected path (`/` in the branch name replaced by `--`).

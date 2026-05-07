╔══════════════════════════════════════════════════════════════════════╗
║  PLAN: ASCII Design System + Status Glyph Vocab + Preview Audit       ║
║  3 deliverables · ~14 new files · 1 bundled PR · ~+1100 LOC           ║
║  Risk: LOW   ·   Confidence: HIGH   ·   Reversible until P1 merges    ║
║  Branch: feat/ascii-design-system  ──►  main @ 38e276510 (v7.83.2)    ║
║  CC floor: >= 2.1.125  ·  CC features used: 2.1.116, 2.1.121, 2.1.126 ║
╚══════════════════════════════════════════════════════════════════════╝
   [1] Goal  [2] Arch  [3] Spec  [4] Tokens  [5] Governance  [6] Risks


════════════════════════════════════════════════════════════════════════
[1] GOAL · NON-GOALS · DOGFOOD
════════════════════════════════════════════════════════════════════════

GOAL
  Make every ASCII output in OrchestKit consistent, lint-checked,
  snapshot-tested, i18n-safe. Establish a small status-glyph vocabulary as
  the single source of truth for ✓/✗/⚠/●/○/◆ semantics. Audit existing
  skills for AskUserQuestion options missing the `preview` field.

NON-GOALS  (decisions D1, D4 below)
  ✗  No decorative ASCII (figlet banners, mascots, kawaii faces, themes)
  ✗  No new user-invocable skill
  ✗  No statusline, no celebration hooks, no animated frames

DOGFOOD
  This document embodies the system it proposes:
    ●  Light box-drawing for prose tables, double for the title header
    ●  Status glyphs from §3.B vocabulary throughout
    ●  Layered-boxes pattern for §2 architecture
    ●  Swimlane pattern for §3.A.7 commit sequence
    ●  Reversibility-timeline pattern for §6 rollout
    ●  Blast-radius pattern for §6 lint-hook impact


════════════════════════════════════════════════════════════════════════
[2] ARCHITECTURE  (layered boxes pattern, light set)
════════════════════════════════════════════════════════════════════════

      ┌─────────────────────────────────────────────────────────────┐
      │              Author / CI / PostToolUse Hook                  │
      └────────────┬─────────────────┬────────────────┬──────────────┘
                   │                 │                │
                   v                 v                v
      ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
      │ render-ascii.sh │ │  ascii-lint.ts   │ │  test-ascii-*.sh │
      │   (1 CLI)       │ │  (warn-only)     │ │  (4 harnesses)   │
      └────────┬────────┘ └─────────┬────────┘ └─────────┬────────┘
               │                    │                    │
               └────────────┬───────┴────────────┬───────┘
                            v                    v
                  ┌────────────────────┐ ┌────────────────────┐
                  │  tokens.json       │ │  status-glyph-     │
                  │  + tokens.schema   │ │  vocabulary.md     │
                  │  (semantic tier)   │ │  (closed set v1)   │
                  └─────────┬──────────┘ └─────────┬──────────┘
                            │                      │
                            v                      v
                  ┌────────────────────┐
                  │ primitives.json    │  (raw glyph palette;
                  │ (frozen Unicode    │   semantic tier refs
                  │  code points)      │   into this)
                  └─────────┬──────────┘
                            │
                            v
                  ┌──────────────────────────┐
                  │  ascii-visualizer SKILL  │
                  │  (existing; consumer)    │
                  └──────────────────────────┘


════════════════════════════════════════════════════════════════════════
[3] SPEC
════════════════════════════════════════════════════════════════════════

──────────────────────── A. ASCII Design System ────────────────────────

A.1  TOKEN ARCHITECTURE  (see §4 for full treatment)
     Two-tier model:
       Tier 1  primitives.json  — raw Unicode code points, frozen
       Tier 2  tokens.json      — semantic char-sets that REFERENCE
                                  primitives by name (not by literal char)

     Char-set names (semantic tier; see §4.2 for naming rationale):

       set         | role                  | corner | edge | when to use
       ────────────┼───────────────────────┼────────┼──────┼─────────────
       default     │ standard prose        │ ┌─┐└┘  │ ─ │  │ default
       emphasis    │ headers, focus blocks │ ┏━┓┗┛  │ ━ ┃  │ titles
       title       │ document titles only  │ ╔═╗╚╝  │ ═ ║  │ §0 banners
       soft        │ status cards, diffs   │ ╭─╮╰╯  │ ─ │  │ ambient UI
       portable    │ NO_COLOR/CI/TTY-bare  │ +-+++  │ - |  │ fallback

     Replaces the previous flat (light/heavy/double/rounded/ascii-fallback)
     naming. Old names mixed PHYSICAL traits (light/heavy) with INTENT
     (ascii-fallback) — one taxonomy now, intent-driven. See §4.2.

A.2  RENDERER CLI  ·  scripts/render-ascii.sh <pattern> [--set NAME]
     Single bash script, used by tests AND by skill authors at write-time.
     Patterns mirror the 7 already in ascii-visualizer/SKILL.md plus
     sparkline + reversibility-timeline = 9 total.

       $ scripts/render-ascii.sh box --set emphasis --width 40 --label Backend
       ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
       ┃ Backend                              ┃
       ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

A.3  LINT HOOK  ·  src/hooks/src/quality/ascii-lint.ts  (PostToolUse)
     Severity = warn (locked, D3). Fires only on Edit|Write|MultiEdit of
     *.md under src/ AND only on diffs touching fenced blocks with ≥3
     box-drawing chars. Uses CC 2.1.121 output replacement.

       rule                     │ class      │ severity │ override
       ─────────────────────────┼────────────┼──────────┼──────────────────
       a. width-80              │ ADVISORY   │   warn   │ ascii-lint-disable: width
       b. single-set            │ NORMATIVE  │   warn   │ ascii-lint-disable: set
       c. balanced-corners      │ NORMATIVE  │   warn   │ — (no override)
       d. single-arrow-style    │ ADVISORY   │   warn   │ ascii-lint-disable: arrow
       e. density-min ≥ 0.20    │ ADVISORY   │   warn   │ tokens.json overrides

     NORMATIVE rules describe correctness (set-mixing breaks the visual
     contract, unbalanced corners produce broken boxes). ADVISORY rules
     describe taste (width, density, arrow style). Today all are `warn`
     per D3, but only NORMATIVE rules are eligible to ratchet to `block`
     in a future PR — ADVISORY rules stay `warn` indefinitely. See Q5.

A.4  SNAPSHOT HARNESS  ·  tests/unit/test-ascii-snapshots.sh
     Coverage: 9 patterns × 5 sets = 45 goldens.
     Update via:  UPDATE_SNAPSHOTS=1 bash tests/unit/test-ascii-snapshots.sh

A.5  DENSITY CHECK  ·  tests/unit/test-ascii-density.sh

       density(block) = info_glyphs / (info_glyphs + decoration_glyphs)
       info       = alnum + arrows + meaningful punctuation (:.,)
       decoration = box-drawing + whitespace beyond required indent
       threshold  = 0.20  (overridable per pattern in tokens.json)

       sample density readout (sparkline pattern):
         pages  ░░░░▒▒▓▓▓██  0.43  ✓
         logo   ████░░░░░░░  0.08  ✗  (too decorative — lint warns)

A.6  i18n ALIGNMENT  ·  tests/unit/test-ascii-i18n.sh
     Validates CC 2.1.116 CJK-alignment fix actually holds. Renders each
     pattern with ja/zh/hi labels, checks columns via wcwidth (python3).
     Fixtures: tests/fixtures/ascii/i18n/labels.json.

A.7  COMMIT SEQUENCE  (swimlane pattern)

     C1  ===[primitives + tokens + schema + render-ascii.sh]==▶
                       │
                       │ depends
                       v
     C2  ----[ascii-lint hook (warn) + validator]==============▶
                                  │
                                  │ depends
                                  v
     C3  --------[snapshot+token+density+i18n tests]==========▶
                                                │
                                                │ depends
                                                v
     C4  ---------------[status-glyph-vocab.md + SKILL update]==▶
                                                       │
                                                       │ independent
                                                       v
     C5  --------------------[preview audit (6 skills)]======▶
                                                              │
                                                              v
     C6  -----------------[manifest+CLAUDE.md+recent-decisions]▶

     === active   --- waiting/blocked   │ dependency

────────────────── B. Status Glyph Vocabulary  (CLOSED SET v1) ─────────

     New rule: src/skills/ascii-visualizer/rules/status-glyph-vocabulary.md

     ┌─────┬──────────────────────────┬──────────────────────────┐
     │  ●  │ active / on / current    │ ✗ generic bullet         │
     │  ○  │ inactive / off / pending │ ✗ decoration             │
     │  ✓  │ passed / completed       │ ✗ decoration             │
     │  ✗  │ failed / blocked         │ ✗ general "no"           │
     │  ⚠  │ warning / attention      │ ✗ hard error             │
     │  ◆  │ primary / focused        │ ✗ random emphasis        │
     │  ◇  │ secondary / unfocused    │ ✗ decoration             │
     │  ▶  │ running / in-progress    │ ✗ generic arrow          │
     │  ▷  │ paused / awaiting input  │ ✗ generic arrow          │
     │ ↑↓→ │ trend up/down/forward    │ ✗ random direction       │
     │ ▓▒░ │ fill: high/med/low       │ ✗ decoration             │
     └─────┴──────────────────────────┴──────────────────────────┘
       glyph    semantic                  DON'T use for

     ADD-A-GLYPH PROCESS  (v1 is closed; additions are minor-version)
       1. Open issue tagged `glyph-proposal` with: glyph, semantic,
          collision check vs existing 11, terminal-render screenshot.
       2. ascii-visualizer skill owner reviews; design-system reviewer
          signs off; one Phase-1 user must voice support.
       3. Bump tokens.json `version` minor (1.x → 1.x+1, additive only).
       4. Ratify in CHANGELOG.md and recent-decisions.md.
     Removing or repurposing a glyph = MAJOR bump (see §4.3).

────────────── C. AskUserQuestion Preview Audit ────────────────────────

     For each user-invocable skill, find AskUserQuestion blocks where
     options lack `preview`. Add an ASCII mock that shows the artifact
     the choice produces — not a description of the choice.

       skill                       │ status      │ action
       ────────────────────────────┼─────────────┼──────────────────────
       brainstorm                  │ partial     │ extend Step 0b
       explore                     │ TBD         │ confirm during impl
       assess                      │ TBD         │ confirm during impl
       dev                         │ TBD         │ confirm during impl
       design-context-extract      │ TBD         │ confirm during impl
       fix-issue                   │ TBD         │ confirm during impl
       visualize-plan              │   ✓ done    │ no change


════════════════════════════════════════════════════════════════════════
[4] TOKEN ARCHITECTURE  (taxonomy · schema · versioning)
════════════════════════════════════════════════════════════════════════

4.1  TIER MODEL  (deliberately 2 tiers, not 3)

     ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
     │  primitives    │──▶│   semantic     │──▶│   consumer     │
     │  (raw glyphs)  │   │   (char-sets)  │   │   (SKILL.md)   │
     └────────────────┘   └────────────────┘   └────────────────┘
        Unicode points       intent names          fenced blocks
        frozen forever       can evolve            no token refs;
                                                   cited by name in
                                                   prose only

     Why 2, not 3 (Tailwind/MUI use 3: primitive→alias→component)?
       Component-tier tokens make sense when consumers PROGRAMMATICALLY
       compose styles. Our consumers paste literal box-drawing chars
       into Markdown. A component tier (e.g., `card.border = soft.edge`)
       buys nothing and adds a layer of indirection no consumer reads.
       Revisit if/when render-ascii.sh becomes a library API.

4.2  NAMING CONVENTION  (intent over physical)

       OLD (rejected)        NEW (semantic)     reason
       ───────────────────   ──────────────     ────────────────────────
       light                 default            intent: "use this unless"
       heavy                 emphasis           intent: "draw the eye"
       double                title              intent: "doc-title only"
       rounded               soft               intent: "ambient/diff UI"
       ascii-fallback        portable           intent: "renders anywhere"

     Rule: every char-set name MUST describe USE not APPEARANCE.
     A reviewer adding a 6th set must justify it as a distinct INTENT,
     not a new shape. See §5.B governance.

4.3  SCHEMA + VALIDATION  ·  src/skills/ascii-visualizer/tokens.schema.json

     Ship a JSON Schema (draft-2020-12) alongside tokens.json. Mirrors
     what json-render-catalog does with Zod (see §7), but JSON Schema —
     not Zod — because:
       ●  consumers are bash + python tests + a TS hook (3 runtimes;
          JSON Schema has validators in all three; Zod is TS-only)
       ●  tokens are static config, not a runtime API surface
       ●  no transform/parse step needed

     Validator: scripts/validate-tokens.sh runs on pre-commit + in CI;
     ascii-lint hook also calls it before applying any rule (fail-closed
     on schema break, regardless of D3 warn-default).

4.4  VERSIONING + MIGRATION POLICY

     tokens.json carries `"version": "1.0.0"` (semver, not int).

       change                              │  bump  │  consumer action
       ────────────────────────────────────┼────────┼──────────────────────
       add char-set                        │  MINOR │  none
       add glyph to vocabulary             │  MINOR │  none
       widen density override              │  MINOR │  none
       rename a char-set                   │  MAJOR │  rewrite refs
       remove char-set                     │  MAJOR │  pick replacement
       repurpose a glyph semantic          │  MAJOR │  audit usages
       change schema (tokens.schema.json)  │  MAJOR │  re-validate
       fix typo / clarify description      │  PATCH │  none

     Consumers PIN by reading `version` at lint-hook startup; if the
     hook's expected major ≠ tokens.json major, the hook degrades to
     a single warning ("token-version-skew") and stops applying rules.
     This prevents a token MAJOR from silently changing lint behavior.

     Deprecation flow (MAJOR):
       v1.x   ──▶  v2.0-rc  (both names accepted, old name warns)
                 ──▶ v2.0    (old name removed; pinned consumers degrade)
       Minimum 1 minor release of overlap before removal.


════════════════════════════════════════════════════════════════════════
[5] GOVERNANCE  (who decides · how to extend · escape hatches)
════════════════════════════════════════════════════════════════════════

5.A  DECISION OWNERSHIP

       artifact                    │ owner                  │ reviewers
       ────────────────────────────┼────────────────────────┼─────────────
       primitives.json             │ ascii-visualizer skill │ design-sys
       tokens.json (semantic tier) │ ascii-visualizer skill │ design-sys
       tokens.schema.json          │ design-sys             │ ascii-vis
       status-glyph-vocabulary.md  │ ascii-visualizer skill │ design-sys
       ascii-lint.ts rules         │ design-sys             │ +1 author
       render-ascii.sh patterns    │ ascii-visualizer skill │ —

5.B  CONTRIBUTING PATH  ·  src/skills/ascii-visualizer/CONTRIBUTING.md

     Adding a NEW char-set, glyph, pattern, or lint rule:
       1. Open issue tagged `ascii-design`. State the GAP — what
          existing primitive/set/glyph fails to express.
       2. Author updates primitives.json (if new code point) and
          tokens.json (semantic alias). Bump version per §4.4.
       3. Add at least one snapshot golden (§A.4) and one consuming
          example in a real SKILL.md (no orphan tokens).
       4. Run `npm run test:ascii` (alias for the 4 harnesses).
       5. Reviewer checks: intent name (§4.2), no set-mixing, lint
          severity classification (§A.3 NORMATIVE vs ADVISORY).
       6. Merge; CHANGELOG entry under `### Design tokens`.

5.C  ESCAPE HATCHES  (composition WITHOUT a token PR)

     A skill author hitting a one-off case can:
       (a)  Use `ascii-lint-disable: <rule>` on the block (§A.3 overrides)
       (b)  Stay within a single existing set + the closed glyph vocab —
            no token PR needed for novel COMPOSITIONS (only novel atoms)
       (c)  Use `portable` set in any context — always allowed, never
            warned for "wrong set"
     What requires a token PR:
       ●  Any glyph not in the closed vocab (§B)
       ●  Any new char-set
       ●  Any new lint rule
       ●  Any density override > skill-local

5.D  MONOCULTURE MITIGATION

     Every skill consuming tokens.json means a token break breaks the
     world. Mitigations:
       ●  Schema validation (§4.3) catches structural breaks pre-commit.
       ●  Version pinning (§4.4) makes MAJOR breaks loud, not silent.
       ●  Lint severity = warn (D3) means a bad token release can't
          block authors.
       ●  Snapshot suite (§A.4) is the canary — 45 goldens regenerate
          deterministically; any unintended visual diff is a CI failure.
       ●  No runtime coupling: tokens are read at lint/test time, not
          at user-prompt time. A broken tokens.json never reaches end users.

5.E  CROSS-CUTTING CONCERNS  (addressed or explicitly deferred)

       concern                         │ status     │ note
       ────────────────────────────────┼────────────┼─────────────────────
       NO_COLOR=1 env var              │ ADDRESSED  │ `portable` set; lint
                                       │            │ never injects ANSI
       ANSI color codes in ASCII       │ DEFERRED   │ out of scope P1; see Q6
       Screen reader rendering         │ DEFERRED   │ box-drawing reads as
                                       │            │ noise; mitigation =
                                       │            │ caption above block;
                                       │            │ see Q7
       Terminal width < 80             │ ADVISORY   │ width-80 rule is
                                       │            │ ADVISORY (§A.3)
       Monospace font requirement      │ ASSUMED    │ documented in
                                       │            │ ascii-visualizer/SKILL


════════════════════════════════════════════════════════════════════════
[6] RISK DASHBOARD
════════════════════════════════════════════════════════════════════════

REVERSIBILITY TIMELINE
  C1 prims+tokens+CLI   [================]  FULLY REVERSIBLE  (delete dir)
  C2 lint hook (warn)   [================]  FULLY REVERSIBLE  (unregister)
  C3 tests              [================]  FULLY REVERSIBLE  (delete)
  C4 vocab + SKILL doc  [============....]  PARTIAL (text edit, easy)
       --- POINT OF NO RETURN: nothing here, all reversible ---
  C5 preview audit      [================]  FULLY REVERSIBLE  (per skill)
  C6 manifest+CLAUDE.md [================]  FULLY REVERSIBLE  (count revert)

BLAST RADIUS  (lint hook impact)

         Ring 3: skill SKILL.md files using ASCII (~12 files)
    +────────────────────────────────────────────────────+
    │   Ring 2: rule files with diagrams (~25)            │
    │  +────────────────────────────────────────────+     │
    │  │   Ring 1: ascii-visualizer + visualize-plan │     │
    │  │  +───────────────────────────────────+      │     │
    │  │  │     ascii-lint.ts  (the hook)     │      │     │
    │  │  +───────────────────────────────────+      │     │
    │  +────────────────────────────────────────────+     │
    +────────────────────────────────────────────────────+
       severity warn-only; never blocks an Edit/Write

PRE-MORTEMS
  1. "Lint becomes annoying noise"
     → severity=warn, fires only on ≥3 box-drawing-char blocks, per-rule
       disable comments.  ●  mitigated
  2. "Density threshold flags valid empty progress bars"
     → tokens.json["density_overrides"] per pattern.  ●  mitigated
  3. "i18n test flakes on CI without CJK fonts"
     → uses wcwidth (no font dep). Fixture covers Hiragana/Hanzi/Devanagari
       only — common scripts.  ●  mitigated
  4. "Token MAJOR silently changes lint behavior across 12 SKILLs"
     → version-pin + degrade-to-single-warning (§4.4). ●  mitigated
  5. "Schema break passes review unnoticed"
     → tokens.schema.json validated pre-commit + in CI. ●  mitigated


════════════════════════════════════════════════════════════════════════
[7] DECISION LOG  (ADR-lite)
════════════════════════════════════════════════════════════════════════

D1  DROPPED ascii-flair (banners/mascots/themes) DIRECTION   [LOCKED]
    Decision:     Drop ascii-flair. Build aligned design-system instead.
    Trade-off:    Less personality, but project's stated principles win.

D2  TOKENS AS JSON (NOT INLINE IN SKILL.md)
    Decision:     tokens.json with versioned schema (see §4.3, §4.4).
    Trade-off:    +1 indirection vs runtime flexibility + testability.

D3  LINT SEVERITY = warn  (NOT block)                        [LOCKED]
    Decision:     warn-only; surfaces inline diagnostics via 2.1.121
                  PostToolUse output replacement; never blocks an edit.
    Note:         Only NORMATIVE rules (§A.3) are eligible to ratchet
                  to `block` in a future PR. ADVISORY rules stay `warn`.

D4  PHASES 2 + 3 (statusline + celebration hooks) DEFERRED   [LOCKED]
    Decision:     Ship Phase 1 (this PR) alone. Re-evaluate after 30 days.

D5  TWO-TIER TOKENS (NOT THREE)                              [NEW]
    Context:      Tailwind/MUI/Vanilla Extract use primitive→alias→
                  component. Our consumers paste literal chars into MD;
                  no programmatic composition layer exists.
    Decision:     2 tiers (primitives → semantic). See §4.1.
    Revisit when: render-ascii.sh becomes a library API consumed by code.

D6  JSON SCHEMA (NOT ZOD) FOR TOKEN VALIDATION               [NEW]
    Context:      json-render-catalog uses Zod. Why diverge?
    Decision:     JSON Schema. Consumers span bash + python + TS;
                  tokens are static config not runtime API. See §4.3.
    Trade-off:    Less ergonomic types in TS hook vs cross-runtime reach.

D7  STATUS GLYPH VOCAB IS A CLOSED SET (v1)                  [NEW]
    Context:      Open-set means anyone can add a glyph in any PR;
                  semantics drift; the "single source of truth" claim
                  in §1 collapses.
    Decision:     Closed set of 11. Additions are MINOR version bumps
                  via the §B process. Removals/repurpose are MAJOR.

D8  INTENT-DRIVEN CHAR-SET NAMING (default/emphasis/title/soft/portable)
    Context:      Old names mixed PHYSICAL (light/heavy) and INTENT
                  (ascii-fallback). Reviewers couldn't decide which
                  set to use without consulting a key.
    Decision:     Rename per §4.2. One taxonomy: intent.
    Migration:    `ascii-lint-rename` codemod; old names accepted with
                  warning for one minor release (per §4.4 deprecation).


════════════════════════════════════════════════════════════════════════
[8] IMPACT SUMMARY
════════════════════════════════════════════════════════════════════════

  ┌───────────────────────────┬─────────┬──────────┬──────────────────┐
  │ Metric                    │  Phase1 │  Defers  │  This PR (P1)    │
  ├───────────────────────────┼─────────┼──────────┼──────────────────┤
  │ Skills (new)              │    0    │    0     │     0            │
  │ Skills (edited)           │    1    │    0     │     1 (asc-vis)  │
  │ Hooks (new)               │   +1    │   +2     │    +1 (lint)     │
  │ Files (new)               │  +16    │   +5     │   +16 (+schema,  │
  │                           │         │          │   +primitives,   │
  │                           │         │          │   +CONTRIBUTING) │
  │ Files (modified)          │   +9    │   +1     │    +9            │
  │ Lines (new)               │ ~+1300  │  ~+400   │  ~+1300          │
  │ Tests (new)               │   +5    │   +1     │    +5 (+schema)  │
  │ Goldens (new)             │  +45    │    0     │   +45            │
  │ User-facing commands      │    0    │   +2     │     0            │
  │ Manifest entries          │   +1    │    0     │    +1 (lint hook)│
  │ CLAUDE.md count bumps     │  187→188│ 188→189+ │   187→188 (hooks)│
  └───────────────────────────┴─────────┴──────────┴──────────────────┘

  CC 2026 FEATURES USED  (this PR)
    ✓  PostToolUse output replacement       (2.1.121)
    ✓  Devanagari/CJK alignment validated   (2.1.116)
    ✓  skill_activated OTEL event           (2.1.126) — audit baseline


════════════════════════════════════════════════════════════════════════
OPEN QUESTIONS  (need answer before C1)
════════════════════════════════════════════════════════════════════════

  Q1  Lint severity: start `warn` (D3) or `block`?
      Recommended: warn.  ●  awaiting confirmation
  Q2  Density threshold: 0.20 or 0.15?
      Recommended: 0.20 with per-pattern overrides.  ●  awaiting
  Q3  Preview audit scope: all 6 skills in this PR, or split?
      Recommended: all 6 (preview adds are tiny, cohesive).  ●  awaiting
  Q4  render-ascii.sh location: scripts/ (repo-root) or skill-local?
      Recommended: scripts/ — used by both tests and skills.  ●  awaiting
  Q5  Should NORMATIVE lint rules (single-set, balanced-corners) ratchet
      to `block` in a follow-up PR after 30d, or stay `warn` forever?
      (D3 locks P1 to warn; this asks about the ratchet path.)  ●  awaiting
  Q6  ANSI color in ASCII blocks: forbid, allow, or require an opt-in
      `--color` flag on render-ascii.sh? (Currently DEFERRED in §5.E.)
      ●  awaiting
  Q7  Screen-reader accommodation: require a prose caption above every
      fenced ASCII block (lint rule), or treat as author discretion?
      Box-drawing reads as garbage in NVDA/JAWS/VoiceOver.  ●  awaiting
  Q8  Codemod for D8 rename (light→default, heavy→emphasis, …): ship
      in this PR, or a follow-up? Affects 0 in-tree usages today (no
      consumers exist yet) but locks the migration story.  ●  awaiting
  Q9  Should the closed glyph vocab (§B, D7) live in tokens.json under
      a `glyphs:` key, or stay as a separate Markdown rule file?
      Tradeoff: machine-readable vs human-readable as primary.  ●  awaiting

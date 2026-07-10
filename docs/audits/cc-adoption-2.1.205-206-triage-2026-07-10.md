# CC 2.1.205 + 2.1.206 Adoption Triage — 2026-07-10

Manual verification of the auto-flagged `cc-adoption-gaps.json` candidates for 2.1.205
and 2.1.206, via a parallel Explore ground-truth pass (9 candidates) with a
devil's-advocate synthesis. Branch: `feat/cc-2.1.205-206-adoption`.

- 2.1.205: 25 changelog bullets
- 2.1.206: 28 changelog bullets
- `latest_known` advanced 2.1.204 → 2.1.206 via `scripts/stamp-cc-support.mjs`;
  floor/latest stay frozen at 2.1.183 per the 2026-06-20 manual_override (expires 2026-09-20)
- ~60% false-positive rate on the auto-flagged gaps, as expected

## Verdicts

| Candidate | Ver | Verdict | Surface |
|---|---|---|---|
| `EnterWorktree` external-path confirmation | 2.1.206 | **ADOPT (strongest)** | 2 worktree docs + matrix row |
| `--json-schema` strict validation | 2.1.205 | ADOPT (doc-note) | bare-eval invocation-patterns + matrix row |
| native `/doctor` full checkup + `/checkup` alias | 2.1.205 | INFO ROW | 1 matrix row |
| native `/doctor` CLAUDE.md-trim check | 2.1.206 | INFO ROW | 1 matrix row (overlaps byte-budget hook) |
| MCP per-server `request_timeout_ms` honored | 2.1.206 | INFO ROW | 1 matrix row |
| `/commit-push-pr` pushDefault auto-allow | 2.1.206 | INFO ROW | 1 matrix row |
| project verify-skill regeneration fix | 2.1.205 | NO-OP | CC's `.claude/skills/verify`, not ork's `/ork:verify` |
| `/code-review` opus-4-8 quality | 2.1.206 | NO-OP | no row type for subjective per-model deltas |
| `/model` picker price-display fixes | 2.1.206 | NO-OP | ork quotes no first-party prices |

## The one strong adoption — `EnterWorktree` external-path confirmation (2.1.206)

Changelog: *"`EnterWorktree` now asks for confirmation before entering a git worktree
outside the project's `.claude/worktrees/` directory."*

ork's entire worktree convention is `../<repo>-<task>` — **always outside**
`.claude/worktrees/`. Every `EnterWorktree` into a pre-created external worktree now
triggers a one-time confirmation prompt. Documented in:

1. `src/skills/implement/references/manual-worktree-pattern.md` — the operator-level
   `EnterWorktree` note now records the 2.1.206 confirmation + the headless workaround.
2. `src/skills/chain-patterns/references/worktree-agent-pattern.md` — new blockquote in
   the CC-version ladder (after the 2.1.203 leak-closure note).

**Deliberately NOT edited**: `implement/references/worktree-workflow.md` and
`implement/scripts/worktree-setup.sh` use raw `git worktree add` shell commands, not the
`EnterWorktree` tool. The new confirmation is tied to the tool, not the shell command —
so those files need no change (avoiding a false "everything triggers a prompt" claim).

## The doc-note adoption — `--json-schema` strict validation (2.1.205)

Changelog: *"Fixed `--json-schema` silently producing unstructured output when the schema
was invalid, and schemas using the `format` keyword being rejected."*

`bare-eval` is the ONLY ork surface using `--json-schema` (grading/trigger/quality
schemas). An invalid schema now **hard-errors** at invocation instead of yielding
un-parseable output downstream — noted in
`src/skills/bare-eval/references/invocation-patterns.md` alongside the existing 2.1.88
note. The `format`-keyword acceptance is a no-op: ork's grading schemas use `format` only
as a *property name*, not the JSON-Schema `format` keyword.

## Matrix info rows (no behavior change for ork)

- **native `/doctor` full checkup + `/checkup` alias** (2.1.205): CC's native `/doctor`,
  distinct from ork's `/ork:doctor` skill. Row only.
- **native `/doctor` CLAUDE.md-trim check** (2.1.206): complements ork's own
  `CLAUDE.md ≤ 4800B` byte-budget PostToolUse hook
  (`hooks/src/posttool/write/claude-md-byte-budget.ts`) + `tests/perf/test-token-overhead.sh`.
- **MCP per-server `request_timeout_ms`** (2.1.206): now honored (was hardcoded 60s). ork
  sets no per-server timeout today; available for slow MCP servers.
- **`/commit-push-pr` pushDefault** (2.1.206): CC built-in; ork's `commit`/`create-pr`
  push to `origin` explicitly, no permission surface change.

## No-ops (verified against real files)

- **project verify-skill regeneration** (2.1.205): CC's auto-generated *project* verify
  skill (`.claude/skills/verify`), not ork's hand-authored `/ork:verify` plugin skill.
- **`/code-review` opus-4-8 quality** (2.1.206): subjective per-model quality delta; the
  version matrix tracks capability/behavior rows, no natural home.
- **`/model` price-display fixes** (2.1.206): `eval-runner.md` and all skills quote no
  first-party list prices (the prior eval-runner pricing-fabrication concern is already
  resolved). Nothing to affect.
- Remaining bullets (background-agent list state/resume, Windows worktree/crash fixes,
  OAuth MCP re-auth, `claude rm` roster cleanup, agents-view rendering, auto-update
  memory reduction, Bedrock startup hang) are CC-internal — no ork surface.

## Files changed

- `shared/cc-support.json` — `latest_known` 2.1.204→2.1.206 + narrative append
- `src/skills/doctor/references/version-compatibility.md` — 6 matrix rows
- `src/skills/bare-eval/references/invocation-patterns.md` — 2.1.205 json-schema note
- `src/skills/implement/references/manual-worktree-pattern.md` — 2.1.206 EnterWorktree note
- `src/skills/chain-patterns/references/worktree-agent-pattern.md` — 2.1.206 EnterWorktree note
- Stamp-derived: `CLAUDE.md`, `src/hooks/src/lib/cc-version-matrix.ts` (LATEST_KNOWN_CC)
- `plugins/**` — rebuilt mirror

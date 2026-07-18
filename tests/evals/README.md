# Evaluation Framework

CI-based validation of golden test cases, scaffold integrity, and skill quality.

## Overview

This framework has two operating modes:

### Dry-run (CI default — no Claude CLI)
Validates structural correctness only:
- Golden YAML schema (required fields, valid scaffold references)
- Scaffold file creation
- Build/lint command allowlist compliance

Agent routing and quality metrics are **not evaluated** without Claude CLI.

### Full evaluation (local or self-hosted runner with Claude CLI)
Runs A/B tests comparing Claude Code performance **with** vs **without** OrchestKit's indexes:
- **With Index**: CLAUDE.md + agent-index.md + skill-indexes loaded
- **Without Index**: Baseline Claude Code with no OrchestKit indexes
- Agent routing accuracy measured via Claude output logs

## Directory Structure

```
tests/evals/
├── README.md              # This file
├── golden/                # Agent routing tests (YAML)
│   ├── api-design.yaml
│   ├── database-schema.yaml
│   └── ...                # 11 golden tests
├── skills/                # Skill trigger + quality tests (YAML)
│   ├── commit.eval.yaml
│   ├── assess.eval.yaml
│   ├── api-design.eval.yaml
│   ├── explore.eval.yaml
│   └── implement.eval.yaml
├── scaffolds/             # Minimal project templates
│   ├── python-fastapi/    # FastAPI starter
│   ├── typescript-nextjs/ # Next.js starter
│   └── empty/             # Empty project
├── known-hook-conflicts.json  # Registry of expected hook-skill conflicts
├── scripts/
│   ├── run-evals.sh       # Golden test runner
│   ├── run-trigger-eval.sh   # Skill trigger eval (💰 CC API)
│   ├── run-quality-eval.sh   # Skill quality A/B eval (💰 CC API)
│   ├── run-agent-eval.sh     # Agent routing eval (💰 CC API)
│   ├── run-skill-eval.sh     # Unified eval runner (dry-run: free)
│   ├── run-full-eval.sh      # Full pipeline runner (dry-run: free)
│   ├── eval-report.sh        # Duration aggregator (free, reads JSONs)
│   ├── compare.sh            # A/B comparison (index effectiveness)
│   ├── check-eval-regression.sh  # Regression detection (free)
│   ├── optimize-description.sh   # Description optimization (💰 CC API)
│   └── lib/eval-common.sh    # Shared colors, deps, timeout, cache
└── results/               # Output (gitignored)
    ├── with-index/
    ├── without-index/
    └── skills/            # Skill eval results
```

## Golden Test Format

```yaml
id: test-id
name: "Human readable name"
description: "What this test validates"
scaffold: python-fastapi  # Template to use
timeout: 120              # Seconds

prompt: |
  The prompt to send to Claude Code

expected:
  agent_spawned: backend-system-architect  # Expected routing (requires Claude CLI)
  files_created:                           # Expected output files
    - "app/main.py"
  build_command: "poetry install"          # Validation commands
  lint_command: "ruff check ."
  test_command: "pytest"

tags:
  - backend
  - api
```

## Running Locally

```bash
# FREE — no Claude API calls
npm run eval:report              # Duration report (reads existing JSONs)
npm run eval:report -- --json    # Machine-readable output
npm run eval:quality -- --dry-run --all   # Validate YAML structure
npm run eval:trigger -- --dry-run --all   # Validate trigger YAML

# COSTS $$ — calls Claude API (CC Max or ANTHROPIC_API_KEY)
npm run eval:trigger -- commit           # Test one skill trigger
npm run eval:quality -- --force-skill commit  # Test one skill quality
npm run eval:quality -- --all            # Full quality eval (~$2/skill)

# Golden test evaluation
EVAL_MODE=with-index ./tests/evals/scripts/run-evals.sh
EVAL_MODE=without-index ./tests/evals/scripts/run-evals.sh
./tests/evals/scripts/compare.sh
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/eval-index-effectiveness.yml`) runs:
1. On PRs that modify: `scripts/generate-indexes.sh`, `src/skills/**`, `src/agents/**`, `manifests/**`
2. Manual trigger via workflow_dispatch

In CI (no Claude CLI), the workflow validates golden test structure only. Full agent routing evaluation requires a self-hosted runner with Claude CLI installed.

## Coverage Walker (#2192)

`scripts/eval/eval-coverage.sh` walks every shipped component and confirms it has
an eval spec, so a newly added skill or agent cannot slip through uncovered.

```bash
# Report coverage + write tests/evals/results/coverage.json (gitignored artifact)
bash scripts/eval/eval-coverage.sh

# Write coverage.json only, no table (used by static-analysis.sh)
bash scripts/eval/eval-coverage.sh --json-only

# Generate a STARTER spec for every uncovered component (safe to re-run)
bash scripts/eval/eval-coverage.sh --fill

# Ratchet: exit non-zero if any component is uncovered (used by CI)
bash scripts/eval/eval-coverage.sh --check
```

Enumeration mirrors `static-analysis.sh`: skills are `src/skills/*/SKILL.md`
(so `src/skills/shared/` is excluded), agents are top-level `src/agents/*.md`
carrying YAML frontmatter (so `src/agents/README.md` and `src/agents/shared/`
are excluded). `coverage.json` also records `orphan_specs` (a spec whose
component no longer exists) as a distinct category for drift visibility.

Two CI surfaces consume this:
- `scripts/eval/static-analysis.sh` calls it advisory (warn, never fail) and
  regenerates `coverage.json` for free.
- `tests/evals/test-eval-coverage.sh` is the hard ratchet wired into
  `tests/run-all-tests.sh`; it fails the suite when any component is uncovered.

`--fill` writes STARTER specs: the trigger prompt and single assertion are
derived mechanically from the component description (tagged `starter`) and are
meant to be refined by a human before the scores are trusted.

## Quality Index + Regression Gate (#2194)

`scripts/eval/aggregate-quality-index.sh` reduces the committed-shape result
JSONs (`results/skills/*.trigger.json` + `*.quality.json`) to one per-component
quality index, deterministically (pure jq/bash, no LLM). Each metric is
normalized to 0..1; a component `score` is the mean of the metrics that exist;
`overall.index` is the mean of component scores. It writes
`results/quality-index.json` (gitignored artifact).

`tests/evals/scripts/check-eval-regression.sh` runs the aggregator over the
current results and diffs against the COMMITTED baseline
`tests/evals/quality-index.baseline.json`. It exits non-zero when a baseline
component regresses beyond the threshold (default `0.05`, override with
`EVAL_REGRESSION_THRESHOLD`) or disappears from the fresh index (coverage
cannot silently vanish once data lands). Accept an intentional change with
`--update-baseline`.

```bash
bash scripts/eval/aggregate-quality-index.sh          # write quality-index.json
bash tests/evals/scripts/check-eval-regression.sh     # gate current vs baseline
bash tests/evals/scripts/check-eval-regression.sh --update-baseline  # accept a change
```

**Honest scope.** The committed baseline currently measures **0 components**:
`results/` is gitignored and holds no committed result JSONs, so nothing has
been scored yet. In this empty state the gate is a loud NO-OP (it prints a
notice and exits 0 — it does NOT report a green quality PASS). A full paid eval
run must land and seed the baseline (`--update-baseline`) to make the index
exhaustive across the ~94 committed specs. Until then the gate is still valuable
as a ratchet on whatever IS measured, and its logic is CI-verified by
`tests/evals/test-quality-index-gate.sh` against fixtures (pass / regress /
drop / empty-state).

## Duration Report

`npm run eval:report` aggregates trigger + quality durations from result JSONs:

```
Skill                                      Trigger   Quality     Total
⚠ i18n-date-patterns                           —   47m 06s   47m 06s
  api-design                              16m 13s    3m 45s   19m 58s
  ...
TOTAL (64 skills)                          55m 09s  160m 42s  215m 51s

Insights:
  ⚠ 1 outlier(s) exceed 3× median quality duration (8m 39s)
  --changed vs --all saves ~199min per PR
```

Flags: `--json` for machine-readable output, `--top N` to control display length.

## Hook Conflict Registry

`known-hook-conflicts.json` tracks expected hook-skill conflicts. The quality eval runner diffs actual hook rejections against this registry and prints a `HOOK COMPATIBILITY` section:

- **COMPATIBLE ✓** — zero rejections
- **KNOWN CONFLICTS** — rejections match registry (expected)
- **NEW CONFLICTS ✗** — rejections NOT in registry (investigate)

## Metrics

| Metric | Dry-run | Full eval |
|--------|---------|-----------|
| Golden YAML parsed | Validated | Validated |
| Scaffold integrity | Validated | Validated |
| Build Success | Simulated | Real |
| Lint Compliance | Simulated | Real |
| Test Passing | Simulated | Real |
| Agent Routing | **Skipped** | Measured |

## Skill Eval Format

Skill evals live in `skills/` and test two things: **trigger accuracy** (does the skill activate on the right prompts?) and **quality** (does the skill add value vs base Claude?).

```yaml
id: skill-name
name: "Human readable name"
skill_path: src/skills/skill-name/SKILL.md
plugin_dir: plugins/ork

trigger_evals:
  - prompt: "realistic user prompt"
    should_trigger: true       # Skill should activate
  - prompt: "adjacent task"
    should_trigger: false      # Skill should NOT activate

quality_evals:
  - prompt: |
      multi-line task description
    scaffold: typescript-nextjs  # Optional project template
    assertions:
      - name: "what to check"
        check: "grader-friendly description of expected outcome"

tags: [skill-name, user-invocable]
```

### Running Skill Evals (local, requires CC Max)

```bash
# Trigger accuracy for one skill (5x per query)
npm run eval:trigger -- commit

# Quality A/B comparison (with-skill vs baseline)
npm run eval:quality -- commit

# All skills with eval files
npm run eval:trigger -- --all
```

### Writing Good Eval Entries

- **Trigger positives**: Include casual phrasing ("save my progress"), indirect requests, and varied vocabulary
- **Trigger negatives**: Use **near-misses** that share keywords but need a different skill. "push to main" shares git context with commit but is not a commit task
- **Cross-skill confusion**: Test boundaries between similar skills. "assess this PR" (assess) vs "review this PR" (review-pr)
- **Quality assertions**: Describe what to look for, not exact strings. The grader is an LLM, not regex.

## Adding New Tests

### Golden tests (agent routing)
1. Create a new YAML file in `golden/`
2. Define the prompt and expected outcomes
3. Add appropriate scaffold if needed
4. Run locally to verify
5. Commit and push

### Skill evals (trigger + quality)
1. Create `skills/<name>.eval.yaml`
2. Add 5+ trigger entries (3+ positive, 2+ negative)
3. Add 1+ quality entries with assertions
4. Run locally: `npm run eval:trigger -- <name>`
5. Commit and push

## Security Model

| Aspect | Mitigation |
|--------|------------|
| Command Execution | Allowlist-based validation (no arbitrary `eval`) |
| Binary Downloads | yq pinned to v4.40.5 with SHA256 checksum |
| Workspace Isolation | Each test runs in `mktemp -d` with cleanup trap |
| CI Isolation | Ephemeral GitHub Actions runners |
| Timeouts | Configurable per-test (default 120s) |

**Trust Model**: Golden YAML files are version-controlled and must be reviewed by maintainers. Commands in `build_command`, `lint_command`, `test_command` are validated against an allowlist in `run-evals.sh`.

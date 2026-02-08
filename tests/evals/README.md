# Golden Test Evaluation Framework

CI-based validation of OrchestKit's golden test cases and scaffold integrity.

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
├── golden/                # Test cases (YAML format)
│   ├── api-design.yaml
│   ├── database-schema.yaml
│   ├── react-component.yaml
│   ├── pytest-tests.yaml
│   └── security-audit.yaml
├── scaffolds/             # Minimal project templates
│   ├── python-fastapi/    # FastAPI starter
│   ├── typescript-nextjs/ # Next.js starter
│   └── empty/             # Empty project
├── scripts/
│   ├── run-evals.sh       # Main test runner
│   └── compare.sh         # A/B comparison
└── results/               # Output (gitignored)
    ├── with-index/
    └── without-index/
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
# Full evaluation (requires Claude CLI)
EVAL_MODE=with-index ./tests/evals/scripts/run-evals.sh
EVAL_MODE=without-index ./tests/evals/scripts/run-evals.sh
./tests/evals/scripts/compare.sh

# Dry-run (structural validation only — works without Claude CLI)
./tests/evals/scripts/run-evals.sh
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/eval-index-effectiveness.yml`) runs:
1. On PRs that modify: `scripts/generate-indexes.sh`, `src/skills/**`, `src/agents/**`, `manifests/**`
2. Manual trigger via workflow_dispatch

In CI (no Claude CLI), the workflow validates golden test structure only. Full agent routing evaluation requires a self-hosted runner with Claude CLI installed.

## Metrics

| Metric | Dry-run | Full eval |
|--------|---------|-----------|
| Golden YAML parsed | Validated | Validated |
| Scaffold integrity | Validated | Validated |
| Build Success | Simulated | Real |
| Lint Compliance | Simulated | Real |
| Test Passing | Simulated | Real |
| Agent Routing | **Skipped** | Measured |

## Adding New Tests

1. Create a new YAML file in `golden/`
2. Define the prompt and expected outcomes
3. Add appropriate scaffold if needed
4. Run locally to verify
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

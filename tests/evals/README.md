# Index Effectiveness Evaluation Framework

CI-based evaluation to measure OrchestKit's passive indexing effectiveness.

## Overview

This framework runs A/B tests comparing Claude Code performance **with** vs **without** OrchestKit's indexes:
- **With Index**: CLAUDE.md + agent-index.md + skill-indexes loaded
- **Without Index**: Baseline Claude Code with no OrchestKit indexes

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
│   ├── measure.sh         # Metrics extraction
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
  agent_spawned: backend-system-architect  # Expected Tier 1 routing
  skills_should_read:                      # Expected Tier 2 skills
    - api-design-framework
    - fastapi-advanced
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
# Run with indexes (default)
EVAL_MODE=with-index ./tests/evals/scripts/run-evals.sh

# Run without indexes (baseline)
EVAL_MODE=without-index ./tests/evals/scripts/run-evals.sh

# Compare results
./tests/evals/scripts/compare.sh
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/eval-index-effectiveness.yml`) runs:
1. On PRs that modify: `scripts/generate-indexes.sh`, `src/skills/**`, `src/agents/**`
2. Nightly at 2 AM UTC
3. Manual trigger via workflow_dispatch

## Metrics

| Metric | Description |
|--------|-------------|
| Build Success | Code compiles/installs without errors |
| Lint Compliance | No linting errors (ruff, eslint) |
| Test Passing | Tests pass (if applicable) |
| Agent Routing | Correct agent spawned from Tier 1 index |
| Skill Utilization | Expected skills read from Tier 2 index |

## Adding New Tests

1. Create a new YAML file in `golden/`
2. Define the prompt and expected outcomes
3. Add appropriate scaffold if needed
4. Run locally to verify
5. Commit and push

## Security Model

The eval framework runs with specific security mitigations:

| Aspect | Mitigation |
|--------|------------|
| Command Execution | Allowlist-based validation (no arbitrary `eval`) |
| Binary Downloads | yq pinned to v4.40.5 with SHA256 checksum |
| Workspace Isolation | Each test runs in `mktemp -d` with cleanup trap |
| CI Isolation | Ephemeral GitHub Actions runners |
| Timeouts | Configurable per-test (default 120s) |

**Trust Model**: Golden YAML files are version-controlled and must be reviewed by maintainers. Commands in `build_command`, `lint_command`, `test_command` are validated against an allowlist in `run-evals.sh`.

## References

- [Vercel agents.md evaluation](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [DeepEval agent evaluation](https://deepeval.com/guides/guides-ai-agent-evaluation)
- [AGENTS.md standard](https://agents.md/)

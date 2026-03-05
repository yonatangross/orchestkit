---
paths:
  - "scripts/**"
  - "bin/**"
---

# Script Conventions

## Shell Scripts
- Start with `set -euo pipefail` (strict mode)
- Never use `set -x` when secrets are in scope
- Quote all variables: `"${var}"` not `$var`
- Use `shellcheck` clean patterns

## Git Hooks (bin/git-hooks/)
- `pre-commit`: fast checks only (lint, format)
- `pre-push`: security tests must pass
- Never bypass with `--no-verify` — fix the underlying issue

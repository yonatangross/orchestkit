---
description: Create GitHub pull requests with validation and auto-generated descriptions
allowed-tools: Bash, Read, Glob, Grep
---

# Create Pull Request

Load and follow the skill instructions from the `skills/create-pr/SKILL.md` file.

Execute the `/skf:create-pr` workflow to:
1. Run pre-flight checks (verify branch, uncommitted changes, push if needed)
2. Run local validation (lint, format, type checks, tests)
3. Gather context (issue number, commits, diff stats)
4. Create PR with auto-generated description via `gh pr create`
5. Verify and return PR URL

## Rules
- No junk files created
- Run validation locally (no agents for lint/test)
- All content goes directly to GitHub PR body

## Arguments
- No arguments: Create PR for current branch

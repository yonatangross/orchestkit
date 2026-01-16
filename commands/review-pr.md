---
description: Comprehensive PR review with 6-7 parallel specialized agents
allowed-tools: Bash, Read, Glob, Grep, Task, WebFetch
---

# Review PR

Load and follow the skill instructions from the `skills/review-pr/SKILL.md` file.

Execute the `/skf:review-pr` workflow to:
1. Gather PR information using `gh pr view`
2. Auto-load relevant skills (code-review-playbook, security-scanning)
3. Launch 6 parallel review agents (code-quality, security, tests, backend, frontend)
4. Run validation (lint, format, type checks, tests)
5. Synthesize review into structured report
6. Submit review via `gh pr review`

## Arguments
- PR number: `123`
- Branch name: `feature-branch`

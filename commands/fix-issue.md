---
description: Fix GitHub issue with parallel analysis and implementation
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Task
---

# Fix Issue

Load and follow the skill instructions from the `skills/fix-issue/SKILL.md` file.

Execute the `/skf:fix-issue` workflow to:
1. Understand the issue via `gh issue view`
2. Create feature branch (`issue/<number>-fix`)
3. Check memory for related context
4. Launch 5 parallel analysis agents (root cause, impact, backend, frontend, tests)
5. Query Context7 for relevant patterns
6. Launch 2 implementation agents (fix + tests)
7. Run validation (lint, format, type checks, tests)
8. Commit and create PR

## Arguments
- Issue number: GitHub issue number to fix (e.g., "123")

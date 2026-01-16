---
description: Creates git commits with conventional format, branch protection, and pre-commit validation
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Smart Commit

Load and follow the skill instructions from the `skills/commit/SKILL.md` file.

Execute the `/skf:commit` workflow to:
1. Verify we're not on a protected branch (dev/main)
2. Run local validation (lint, format, type checks)
3. Review staged and unstaged changes
4. Create a conventional commit with proper formatting
5. Include Co-Authored-By attribution

## Arguments
- No arguments: Commit all staged changes
- With message: Use provided message as commit description

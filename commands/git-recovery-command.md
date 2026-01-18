---
description: Quick recovery from common git mistakes including undo commits, recover branches, and reflog operations
allowed-tools: Bash, Read, Grep
---

# Git Recovery

Load and follow the skill instructions from the `skills/git-recovery-command/SKILL.md` file.

Execute the `/skf:git-recovery` workflow to:
1. Show current git state (status and recent log)
2. Present interactive recovery options
3. Guide through safe recovery operations
4. Verify recovery success

## Recovery Options

- Undo last commit (keep or discard changes)
- Recover deleted branch
- Reset file to last commit
- Undo rebase or merge
- Find lost commits via reflog
- Unstage files

## Safety

- Always shows what will be lost before destructive operations
- Provides backup commands for recovery
- Requires explicit confirmation for destructive actions
- Verifies results after each operation

## Arguments
- No arguments: Interactive mode with all options
- With scenario: Jump directly to specific recovery scenario

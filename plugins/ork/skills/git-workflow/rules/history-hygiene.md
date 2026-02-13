---
title: History Hygiene Rules
impact: HIGH
impactDescription: "Dirty history with WIP commits and fixups makes bisect impossible and reviews painful"
tags: squash, fixup, interactive-rebase, clean-history
---

## History Hygiene Rules

A clean git history makes debugging (bisect), code review, and onboarding dramatically easier.

### Before Pushing: Clean Up

```bash
# Squash WIP commits before pushing
git rebase -i HEAD~3

# In the editor:
pick abc1234 feat(#123): Add user validation
fixup def5678 WIP: more validation
fixup ghi9012 fix typo

# Result: One clean commit instead of three messy ones
```

### Fixup Commits (During Development)

Use `--fixup` to mark commits that should be squashed later:

```bash
# Initial commit
git commit -m "feat(#123): Add user model"

# Later fixes to the same work
git commit --fixup HEAD    # Auto-squash into previous
git commit --fixup HEAD~2  # Auto-squash into specific commit

# Before pushing, auto-squash all fixups
git rebase -i --autosquash HEAD~5
```

### What to Squash

| Squash | Keep Separate |
|--------|---------------|
| WIP commits | Each logical feature |
| "Fix typo" after feature | Bug fixes (different concern) |
| "Address review feedback" | Refactoring (different intent) |
| Multiple attempts at same thing | Test additions (reviewable unit) |
| Formatting fixes mixed with logic | Documentation updates |

### Commit Message Quality

```bash
# BAD history
abc1234 WIP
def5678 stuff
ghi9012 fix
jkl3456 more fixes
mno7890 finally works

# GOOD history
abc1234 feat(#123): Add user validation with Zod schemas
def5678 test(#123): Add validation edge case tests
ghi9012 docs(#123): Document validation error codes
```

### Interactive Rebase Commands

| Command | Effect |
|---------|--------|
| `pick` | Keep commit as-is |
| `reword` | Change commit message |
| `squash` | Merge into previous, combine messages |
| `fixup` | Merge into previous, discard message |
| `drop` | Remove commit entirely |

### Key Rules

- Clean up history before pushing — squash WIP and fixup commits
- Each commit in final history should be meaningful and atomic
- Use `--fixup` during development, `--autosquash` before pushing
- Never rewrite published history (commits others have pulled)
- Commit messages should explain WHY, not just WHAT

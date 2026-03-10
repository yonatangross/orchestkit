---
title: Keep git history clean by squashing WIP commits and fixups before merge
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
```

### Fixup Commits (During Development)

```bash
git commit --fixup HEAD        # Auto-squash into previous
git commit --fixup HEAD~2      # Auto-squash into specific commit

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

**Incorrect — Dirty WIP history:**
```bash
abc1234 WIP
def5678 fix
ghi9012 more fixes
```

**Correct — Cleaned history:**
```bash
git rebase -i --autosquash HEAD~4
# Result: One clean commit
abc1234 feat(#123): Add user validation with edge case handling
```

### Key Rules

- Clean up history before pushing — squash WIP and fixup commits
- Each commit in final history should be meaningful and atomic
- Use `--fixup` during development, `--autosquash` before pushing
- Never rewrite published history (commits others have pulled)

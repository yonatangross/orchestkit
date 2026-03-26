---
title: When to invalidate fingerprints and force re-run
impact: HIGH
impactDescription: "Stale fingerprints cause skipped tests after checkout, stash, or merge — code changed but fingerprints say it didn't"
tags: fingerprint, cache, invalidation, git
---

## Fingerprint Invalidation

Fingerprints must be invalidated when file contents change outside the normal edit flow.

**Incorrect — trusting fingerprints after git operations:**
```python
# Wrong: fingerprints match but code is completely different branch
git checkout feature-branch  # Different code
/ork:expect                  # "No changes since last run" — WRONG
```

**Correct — invalidate on state-changing git operations:**
```python
# Right: clear fingerprints when git state changes
INVALIDATION_TRIGGERS = [
    "git checkout",    # Different branch = different code
    "git stash pop",   # Restored changes
    "git merge",       # Merged code from another branch
    "git rebase",      # Rebased commits
    "git reset",       # Reset to different state
    "git pull",        # Pulled upstream changes
]
# After any of these: delete .expect/fingerprints.json
```

**Key rules:**
- Hash file **contents** (sha256sum), not metadata (mtime)
- Store fingerprints per target (unstaged/branch/commit) — don't mix
- Always re-run if last result was `fail` (even if fingerprints match)
- `--force` flag bypasses fingerprint check entirely
- `.expect/fingerprints.json` should be in `.gitignore`

---
title: Release Commit, Tag, and Push
impact: HIGH
impactDescription: "Wrong commit format breaks CI changelog automation; wrong tag name breaks semver tooling; pushing without confirmation is irreversible on shared remotes"
tags: git-commit, git-tag, git-push, release, conventional-commits
---

## Release Commit, Tag, and Push

### Commit Format

**Incorrect:**
```bash
git commit -m "version bump"       # Not conventional format
git commit -m "Release 6.0.21"    # Missing type prefix
git commit -m "release v6.0.21"   # Inconsistent — v prefix in message but not tag
```

**Correct:**
```bash
git commit -m "$(cat <<'EOF'
release: v6.0.21

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- Type: `release`
- No scope needed
- Include Co-Authored-By when working with Claude

### Tag

```bash
git tag v6.0.21
```

- Tag must exactly match `"version"` in `package.json` with a `v` prefix
- Use annotated tags for public releases: `git tag -a v6.0.21 -m "Release v6.0.21"`

### Push — Confirm With User First

**Always ask the user before running:**

```bash
git push --follow-tags
```

This pushes commits AND the version tag. On a shared remote this is effectively irreversible.

**Script available:** Run `scripts/pre-push-confirm.sh` to show the user a summary of what will be pushed and prompt for explicit confirmation before executing the push.

**Key rules:**
- Use `release:` type, not `chore:` or `version:` for release commits
- Tag with `v` prefix matching `package.json` version exactly
- NEVER push without explicit user confirmation — even if user said "go ahead" earlier in the conversation

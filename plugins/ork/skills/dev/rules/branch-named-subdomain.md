---
title: "Branch-Named Subdomain"
impact: "HIGH"
impactDescription: "Without per-branch subdomains, two worktrees on the same machine collide on the same `localhost:3000`. Auth callbacks, agent-browser sessions, and emulate stub URLs all leak across branches."
tags: [naming, subdomain, worktree-isolation, dns-safety]
---

## Branch-Named Subdomain

The portless subdomain MUST derive deterministically from the current git branch. Two worktrees branched off the same repo coexist by living at different `.localhost` hostnames.

**Incorrect:**
```bash
# Hardcoded subdomain — every worktree fights for it
portless start --domain dev.localhost
```

**Correct:**
```bash
# Slug from branch: lowercase, slashes → dashes, DNS-safe charset, 63-char cap
slug=$(git rev-parse --abbrev-ref HEAD \
  | tr '[:upper:]' '[:lower:]' \
  | tr '/' '-' \
  | tr -cd 'a-z0-9-' \
  | cut -c1-63)
[[ "$slug" == "head" ]] && slug="dev"   # detached HEAD fallback
portless start --domain "${slug}.localhost"
```

**Key rules:**
- Replace `/` with `-` (DNS labels can't contain slashes)
- Lowercase (DNS is case-insensitive but tools differ in normalization)
- Strip non-`[a-z0-9-]` characters
- Cap at 63 characters (DNS label limit)
- Detached HEAD (`HEAD` literal) → fall back to `dev`
- Empty branch (no git repo) → fall back to `dev`
- `agent-browser` session name == subdomain (so commands without `--session` flag attach correctly when there's only one)

Reference: `slug_branch()` in `src/skills/dev/scripts/boot.sh`

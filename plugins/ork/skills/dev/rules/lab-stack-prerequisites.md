---
title: "Lab-Stack Prerequisites"
impact: "CRITICAL"
impactDescription: "Booting a half-stack (e.g. dev server without portless) leaves the user with a non-stable URL, broken auth callbacks, and an agent-browser session that points at nothing."
tags: [prerequisites, boot, all-or-nothing]
---

## Lab-Stack Prerequisites

Boot must verify all four binaries (`portless`, `emulate`, `agent-browser`, plus a runnable `dev` script) are present BEFORE touching any of them. If any are missing, exit 0 with install hints — never spin up a partial stack.

**Incorrect:**
```bash
# Boots dev server even without portless — user gets http://localhost:3000
# instead of the stable HTTPS subdomain. Auth callbacks break in any flow
# that depends on the production-shaped URL.
pnpm dev &
agent-browser session start --name dev
```

**Correct:**
```bash
# All-or-nothing prereq sweep first
require() { command -v "$1" >/dev/null 2>&1 || { echo "✗ $1 missing"; return 1; }; }
require portless && require emulate && require agent-browser || {
  echo "Skipping boot — install missing tools and re-run."
  exit 0
}
# Then proceed with full stack
```

**Key rules:**
- Check ALL four prerequisites before starting ANY of them
- Exit code 0 (not 1) when missing prereqs — this is a graceful skip, not an error
- Print explicit `Install: npm i -g <pkg>` hints alongside missing binary
- Honor `CI=1` env var: skip boot entirely (CI doesn't need a dev server)
- Don't auto-install — let the user decide

Reference: `src/skills/dev/scripts/boot.sh` (prereq sweep at the top of `main()`)

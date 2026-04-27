---
title: "Idempotent Boot"
impact: "HIGH"
impactDescription: "Without idempotency, a second `/ork:dev` invocation while the stack is live spawns duplicate dev servers (port collisions), duplicate emulate processes (port collisions), and a duplicate agent-browser session — turning a quick re-attach into a state-corrupted mess."
tags: [idempotency, boot, liveness-probe]
---

## Idempotent Boot

Re-running `/ork:dev` while the stack is already live MUST be a no-op. The script reads `.claude/state/dev-stack.json`, probes each tracked PID with `kill -0`, and short-circuits if any are alive.

**Incorrect:**
```bash
# Always boots, regardless of existing state
portless start ...
emulate up &
pnpm dev &
agent-browser session start ...
# → second invocation gets EADDRINUSE on every port and a duplicate session
```

**Correct:**
```bash
if [[ -f .claude/state/dev-stack.json ]]; then
  if bash scripts/status.sh --quiet; then
    echo "ork:dev — already running. Run /ork:dev stop to tear down."
    exit 0
  fi
  # State file exists but PIDs dead → stale, clean up before booting
  rm -f .claude/state/dev-stack.json
fi
# proceed with full boot
```

**Key rules:**
- Check state file existence BEFORE any side effects
- Liveness probe = `kill -0 <pid>` (POSIX signal-0; doesn't actually signal, just checks)
- "Live" = at least one tracked PID still running (not all — partial death is recoverable)
- Stale state file (file exists, all PIDs dead) → clean it up and proceed to boot
- Exit code 0 for the no-op case (this is success, not error)
- Atomic state write: `tmp.json` + `os.replace` so crashes mid-write don't leave half-files

Reference: `main()` in `src/skills/dev/scripts/boot.sh`, `status.sh --quiet`

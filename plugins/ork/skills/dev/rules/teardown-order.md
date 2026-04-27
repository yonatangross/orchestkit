---
title: "Reverse Teardown Order"
impact: "MEDIUM"
impactDescription: "Killing portless before agent-browser leaves agent-browser holding a TLS connection to a dead proxy — logs noise, but more importantly, cached cookies/session state can persist past stop and confuse the next boot."
tags: [teardown, signals, ordering]
---

## Reverse Teardown Order

`/ork:dev stop` must SIGTERM components in REVERSE boot order. SIGKILL fallback after 5 seconds for processes that don't respond to SIGTERM.

Boot order:        portless → emulate → dev-server → agent-browser
Teardown order:    agent-browser → dev-server → emulate → portless

**Incorrect:**
```bash
# Forward order — agent-browser holds TLS to dead portless, dev server still
# accepts requests after emulate vanishes (returns 500s instead of mocked data)
kill $(cat .pidfile/portless)
kill $(cat .pidfile/emulate)
kill $(cat .pidfile/dev-server)
agent-browser session stop --name dev
```

**Correct:**
```bash
# Reverse order — each layer has live peers up to the moment it exits
agent-browser session stop --name "${slug}"
kill -TERM ${dev_pid}; sleep 5; kill -0 ${dev_pid} 2>/dev/null && kill -KILL ${dev_pid}
kill -TERM ${emu_pid}
portless stop --domain "${sub}"
rm -f .claude/state/dev-stack.json
```

**Key rules:**
- agent-browser stops FIRST (it's the consumer; nothing should depend on it)
- dev server stops before emulate (avoids "emulate gone, dev server returns 500s")
- emulate stops before portless (emulate uses portless's TLS for callbacks)
- portless stops LAST (its CA + /etc/hosts cleanup is a separate concern)
- SIGTERM with 5-second SIGKILL fallback per process
- Always remove the state file last — if anything in the chain throws, leave the file so `status.sh` can show the user what's stuck

Reference: `src/skills/dev/scripts/stop.sh`

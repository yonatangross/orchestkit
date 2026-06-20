# Check 15: CC Bash-Sandbox Posture

**Severity: info** — this is a *recommendation*, never a hard gate. Claude Code's
OS sandbox is opt-in and Bash-only; doctor surfaces whether it's on and nudges it,
but a session is healthy without it.

## What it is

Claude Code ships a native **Bash sandbox** (`/sandbox` → Seatbelt on macOS,
bubblewrap on Linux/WSL2). OrchestKit ships **zero** sandbox config by design —
isolation is the harness's job, not a plugin's. So most users never turn it on
and don't know it exists. This check makes the posture visible.

There is **no runtime API** for a hook to read sandbox state, so the only signal
is `settings.local.json`. Treat a missing `sandbox.enabled` key as "off / unknown".

## The check

Resolve `sandbox.enabled` across both scopes (project overrides user), and note
whether the two highest-value hardening keys are set:

```bash
proj=".claude/settings.local.json"
user="$HOME/.claude/settings.local.json"
read_key() { [ -f "$1" ] && jq -r "$2 // empty" "$1" 2>/dev/null; }

enabled="$(read_key "$proj" '.sandbox.enabled')"
[ -z "$enabled" ] && enabled="$(read_key "$user" '.sandbox.enabled')"

deny_read="$(read_key "$proj" '.sandbox.filesystem.denyRead | length')"
[ -z "$deny_read" ] && deny_read="$(read_key "$user" '.sandbox.filesystem.denyRead | length')"

net_allow="$(read_key "$proj" '.sandbox.network.allowedDomains | length')"
[ -z "$net_allow" ] && net_allow="$(read_key "$user" '.sandbox.network.allowedDomains | length')"

case "$enabled" in
  true)  echo "✅ sandbox: ON   (denyRead entries: ${deny_read:-0}, network allowlist: ${net_allow:-0})" ;;
  false) echo "⚠️ sandbox: explicitly OFF" ;;
  *)     echo "⚠️ sandbox: not configured (running unsandboxed)" ;;
esac
```

## Reporting + nudge

- `sandbox.enabled == true` → report ON. If `denyRead` is empty, add: *"sandbox on
  but `~/.ssh` / `~/.aws` are still readable — add them to `sandbox.filesystem.denyRead`."*
- `false` / unset → emit the nudge below.

**Nudge (info-level):**

```
Run /sandbox to enable Claude Code's OS Bash-sandbox. Starter config for
.claude/settings.local.json:

  "sandbox": {
    "enabled": true,
    "filesystem": { "denyRead": ["~/.ssh", "~/.aws", "~/.config/gh"] },
    "network":    { "allowedDomains": ["github.com", "registry.npmjs.org",
                                       "pypi.org", "api.anthropic.com"] }
  }
```

## Honest limits — STATE THESE IN THE OUTPUT, do not hide them

- **Bash-only.** The sandbox confines Bash subprocesses. The Read/Write tools,
  MCP servers, and hooks run **unsandboxed** on the host. Turning it on raises the
  floor; it is **not** full agent containment.
- **`~/.ssh` is readable by default** unless `sandbox.filesystem.denyRead` is set —
  the nudge above includes it for exactly this reason.
- **No detection API.** `settings.local.json` is the only signal; a session running
  sandboxed via CLI flag without the settings key reads here as "not configured".

This pairs with the runtime network-egress guard (#2533): the guard blocks known
exfil patterns at the policy layer; the sandbox adds a real OS boundary. Neither is
a substitute for the other. See milestone #160.

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
is the settings files. Treat a missing `sandbox.enabled` key as "off / unknown".

**Read all four scopes.** The real-world config usually lives in
`~/.claude/settings.json` (user settings proper), not `settings.local.json` —
a check that reads only the local files reports "off / unknown" against a machine
where the sandbox is on (measured 2026-08-22: live config in user settings.json,
Check 15 blind to it).

## The check

Resolve `sandbox.enabled` across the scopes (project overrides user; within a
scope, `settings.local.json` overrides `settings.json`), and note whether the two
highest-value hardening keys are set:

```bash
read_key() { [ -f "$1" ] && jq -r "$2 // empty" "$1" 2>/dev/null; }
# precedence: project local > project > user local > user
resolve() {
  local v
  for f in ".claude/settings.local.json" ".claude/settings.json" \
           "$HOME/.claude/settings.local.json" "$HOME/.claude/settings.json"; do
    v="$(read_key "$f" "$1")"; [ -n "$v" ] && { echo "$v"; return; }
  done
}
proj=".claude/settings.local.json"
user="$HOME/.claude/settings.json"

enabled="$(resolve '.sandbox.enabled')"
deny_read="$(resolve '.sandbox.filesystem.denyRead | length')"
net_allow="$(resolve '.sandbox.network.allowedDomains | length')"

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
  **Partial exception since CC 2.1.229**: native `/doctor` flags ambiguous entries in
  `sandbox.network` domain lists. That is one class of misconfiguration, not a
  posture check, and it still cannot tell you whether the sandbox is actually on.

## Domain-list spelling (CC >= 2.1.229)

`sandbox.network` domain lists changed shape in 2.1.229. Two rules now apply:

- **Bracket IPv6 literals**: `"[::1]:443"`, not `"::1:443"`. An unbracketed literal
  is ambiguous about where the address ends and the port begins.
- **Ambiguous spellings fail closed and are flagged by `/doctor`.** Before 2.1.229 an
  ambiguous entry could fail *open*, silently widening the allowlist. Prefer bare
  hostnames (`github.com`) and add a port only when you mean to scope to it.

The starter config above is unaffected: 4 plain hostnames, no IPv6 literal, no port.
Keep it that way, and keep the `denyRead` entries free of a trailing slash (a trailing
slash silently voided the deny rule before CC 2.1.224).

This pairs with the runtime network-egress guard (#2533): the guard blocks known
exfil patterns at the policy layer; the sandbox adds a real OS boundary. Neither is
a substitute for the other. See milestone #160.

## Sub-check 15b: recent sandbox violations (macOS unified log)

**Severity: warn on findings, warn on unobservable.** macOS keeps a system-wide
sandbox violation log: every *reporting* Seatbelt denial lands in the unified log
as a kernel message with sender `Sandbox`. anthropic-experimental/sandbox-runtime
describes this as real-time notifications with detailed information about what
was attempted and why it was blocked. Nothing in a CC session surfaces those
rows, so this sub-check runs a bounded, read-only query and reports what it sees.

**Script:** `${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/check-sandbox-violations.sh`

```bash
# Bounded, read-only. Verified live 2026-08-21 on Darwin 25.5.0:
/usr/bin/log show --last 15m --style compact --predicate 'sender == "Sandbox"'
# Sample row it returns:
#   kernel[0:...] (Sandbox) Sandbox: ecosystemd(2048) deny(1) file-read-data /Library/Preferences/com.apple.security.plist

"${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/check-sandbox-violations.sh" --window 15m
"${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/check-sandbox-violations.sh" --json
"${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/check-sandbox-violations.sh" --process 'bash|node|python|git'
```

Exit codes: `0` observed + clean, `1` observed + deny events found, `2`
UNOBSERVABLE (fail closed, see below), `3` skipped (non-macOS), `4` usage error.

### The check MUST fail closed

The `log` CLI refuses to run from inside a sandbox. Measured 2026-08-21 from a
CC sandboxed Bash call: exit 64, stderr `log: Cannot run while sandboxed`. When
that happens the script reports **UNOBSERVABLE** and exits 2. It never converts
"could not look" into "zero violations": a denied instrument is a finding, not a
zero. Doctor reports the denial verbatim and prints the exact command to re-run
from an unsandboxed shell.

### Honest limits, state these in the output

- **Reporting denials only.** Sandbox profiles can deny *without* reporting.
  Measured 2026-08-21: a write denied by CC's own Bash sandbox
  (`touch /etc/...` returned `Operation not permitted`) left **no** unified-log
  row within the query window. Zero reported events is therefore not proof of
  zero denials; the script's clean-path output says so explicitly.
- **System-wide, not session-scoped.** The unified log mixes in platform daemons
  (`ecosystemd`, `ecosystemanalyticsd`, mach-lookup noise). Those are normal
  background traffic. Attribution to the session is best-effort: use
  `--process 'bash|node|python|git'` to focus on rows naming session tooling.
- **macOS only.** On Linux, sandbox denials surface via auditd/journald, which
  this check does not read; it exits 3 with an explicit skip reason instead of
  passing silently.

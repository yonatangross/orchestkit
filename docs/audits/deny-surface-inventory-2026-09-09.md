# DENY surface inventory (2026-09-09)

Track D of epic #4005 / issue #4004. Depth is the Lab `STATE.mode` radio
([generic-harness-matrix](https://orchestkit.yonyon.ai/lab/generic-harness-matrix.html)).
Default is `matrix-only`: inventory only, no host ports.

This is not a copy of 171 TypeScript hooks. Claude Code stays the reference
implementation. Muse and OpenCode have no hook API; their adapter stays empty.

## Operator `permissions.deny` (setup payload v4)

Canonical file: `src/skills/setup/references/operator-permissions.json`.
Delivered by setup phase 3.6 with consent. Doctor audits presence.
CI gate: `tests/ci/restricted-smoke/probe-permission-deny.sh`.

Opinions that left the un-disableable hook set (#3835):

- `dangerous-command-blocker` -> Bash deny rules (rm -rf / and twins, force-push
  to main/master, mkfs, dd, chmod 777, find -delete)
- `file-guard` -> Edit deny on `.env`, credentials.json, secrets.json, pem, keys,
  `.husky/`
- `git-validator` -> `git push --force origin main` / `master` (and `-f`)

Plus credential Read rules (`~/.ssh/**`, `~/.aws/credentials`, …).

A plugin `settings.json` cannot carry these. CC reads only `agent` and
`subagentStatusLine` from plugin settings.

## Remaining hook DENY / hard-block

Hooks that still return `outputDeny` or `outputBlock` / `continue: false` in
`src/hooks/src` (not tests, not dist):

| Hook | Envelope | Class |
|---|---|---|
| `pretool/bash/network-egress-guard` | `outputDeny` | RCE-shaped egress (`bash <(curl)`, `eval $(curl)`, `nc -e`) |
| `pretool/write-edit/content-secret-scanner` | `outputDeny` | secret write |
| `pretool/mcp/memory-validator` | `outputDeny` | oversized / poison memory payloads |
| `pretool/mcp/context7-tracker` | `outputDeny` | rate limit |
| `elicitation/elicitation-guard` | `outputBlock` | elicitation policy |
| `skill/pattern-consistency-enforcer` | `outputBlock` | pattern violations |
| `skill/coverage-threshold-gate` | `outputBlock` | coverage floor |
| `skill/cross-instance-test-validator` | `outputBlock` | missing tests |
| `subagent-stop/subagent-quality-gate` | `outputBlock` | subagent quality |
| `posttool/check-plugins-drift` | `outputBlock` | plugins/ drift |
| `config-change/settings-reload` | `outputBlock` | dangerous settings edits |
| `posttool/write/stale-import-detector` | `outputBlock` | stale imports |
| `prompt/goal-tracker` | `outputBlock` | goal tracker |

Un-disableable registry (`SECURITY_HOOKS`, 3 left) does **not** deny:

- `auto-approve-safe-bash` (allow / reject patterns, not the old blocker)
- `redact-secrets` (warn)
- `security-command-audit` (log only)

`network-egress-guard` ASK on upload was retired; DENY on RCE-shaped fetch remains
because CC sandbox allowlists still let `curl URL | sh` through (#3877).

## What each mode would do

- `matrix-only` (this PR): this file plus the Lab matrix. No Codex/Cursor/pi port.
- `guard-class`: implement the operator deny list plus `network-egress-guard` and
  `content-secret-scanner` on Codex (`hooks.json`, CC event names), Cursor
  (`sessionStart` camelCase), pi (`extensions`). Skip Muse/OpenCode. Document
  `--dangerously-bypass-hook-trust` and Cursor hook trust.
- `semantic-parity`: same outcomes, tests per host (blocked force-push, blocked
  secret write). Still skip Muse/OpenCode. Still do not copy 171 files.

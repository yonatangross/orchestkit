# Hook divergence purge, evidence record (2026-08-31, #3835)

Operator directive: remove every hook that diverges from a Claude Code native mechanism, fully, in one push; PARTIAL losses accepted; register updated in `shared/rules/cc-native-first.md`. This file records the measurements the verdicts stand on, in the shape `cc-native-first.md`'s audit gates demand (capability checks measured, consumers read).

## 1. The inventory (what blocks, at HEAD before the purge)

Of 225 handler files: 33 deny/ask/block-capable (4 already dead, 29 live), 6 input/output rewriters, ~186 advisory/telemetry (out of scope; they block nothing). The four dead ones (`agent/block-writes`, `ci-safety-check`, `deployment-safety-check`, `migration-safety-check`) are reachable only through agent-frontmatter `hooks:`, which CC ignores (#3461); they were masked for months because the registry-closure gate once counted frontmatter as a dispatch path.

## 2. The delivery measurement (why PR 1 exists)

CC parses a plugin `settings.json` as `pick(["agent","subagentStatusLine"]).strip()`; every other key, `permissions` included, is silently discarded (binary-proven at 2.1.226, doc-confirmed at 2.1.251 in `plugins-reference`). `src/settings/ork.settings.json` has exactly one top-level key, `permissions`, so ork's 26 deny / 5 allow rules never enforced anywhere, since v7.0.0. Consequence: the hooks were the only live enforcement, and the purge's first PR (#3836) had to build the operator-scope delivery vehicle (consent-gated writer + doctor audit + tripwire probe) before any deletion.

## 3. The native-capability measurements

- **Deny under bypass, no hooks**: canary probe (`tests/ci/restricted-smoke/probe-permission-deny.sh`, zero spend, stub-scripted `tool_use`): control arm (no rule, `--dangerously-skip-permissions`) executed the canary; trip arm (`permissions.deny` on the exact command) left the canary absent and the model received denial text. Measured on CC 2.1.251, 2026-08-31, before #3836 was committed. This is now a CI step; exit 1 reads REGRESSED and names the restore path.
- **Sandbox network enforcement**: measured 2026-08-29 (#3808): `sandbox.enabled: true` + allowlist answered `curl https://example.com` with `CONNECT tunnel failed, response 403` plus a `<sandbox_violations>` block. An enabled sandbox with no network lists still lets every egress through; native Windows has no sandbox backend (Seatbelt is macOS, bubblewrap is Linux/WSL2), so Windows users get rules only.
- **Compound commands**: CC evaluates permission rules per segment; nine correctness fixes across releases (1.0.120, 2.1.7, 2.1.59, 2.1.77, 2.1.98, 2.1.216, 2.1.246, 2.1.251 among them). Good, not settled; the tripwire probe is the watchdog.
- **Rule syntax**: `Bash(cmd *)` is prefix/glob (not gitignore); deny rules see through `env`/`sudo`/`watch` wrappers (2.1.113); `find` `-exec`/`-delete` stopped being auto-approvable at 2.1.113; deny/ask keep any-depth path matching where allow anchored to cwd (2.1.214); `Read()` deny also hides files from Glob/Grep (2.1.162). Unverified corners: leading-wildcard argument globs, and whether `Bash(rm:*)` equals `Bash(rm *)`.
- **What only a hook can do** (the whole KEEP set rests on this): dynamic `permissionDecisionReason` text, `additionalContext` into the model, `systemMessage` to the user, reading runtime state (branch, byte content, budgets), and interactive consent. A JSON rule has none of these.

## 4. The blast radius (consumers read, not grepped)

| candidate | dispatcher seat | unit cases | security suite | probes |
|---|---|---|---|---|
| dangerous-command-blocker | sync-bash L69 | 147 | 5 files | 0 |
| compound-command-validator | sync-bash L70 | 37 | 3 files | 1 |
| network-egress-guard | sync-bash L85 | 32 | 1 whole file | 1 |
| git-validator | sync-bash L87 | 147 (5 files) | none | 1 |
| file-guard | sync-write-edit L46 | 76 | 2 files | 1 |
| agent-browser-safety | unified-advisory L72 | 43 | none | 0 |

Structural facts that shaped the PR order: `src/lib/security-hooks-registry.ts` declares three candidates un-disableable (`assertCanToggle()` throws), so amending it is its own reviewed commit; `sync-bash-dispatcher.ts:73-84` documents an ordering invariant anchored on hooks being deleted, so the comment block is rewritten with the surviving roster; the security suite (`tests/security/run-security-tests.sh`, pre-push and CI) globs its files and asserts registration first, so it fails loudly, and its assertions are rewritten to the #3807 tripwire shape ("the NATIVE mechanism denies X, else REGRESSED") rather than deleted. None of the six candidates is a `hooks.json` entry, so the 176 count barely moves; `bin/validate-counts.sh` re-stamps whatever does.

## 5. Prior art followed

#2889 (buried 51 dead hooks in one PR) for scale; #3807 (wrapper removal) for the second gate: do not only assert the thing is gone, assert the assumption that made removing it safe still holds; #3808 for the observation bar: retirement gates are met by measurement, never by reading a changelog. #959 is the anti-pattern this sequencing avoids (a deletion that silently killed three telemetry streams for months).

## 6. The user-facing why

2026-08-31 morning: two real users (voice note + screenshot, both transcribed/measured, memory `project_user_feedback_2026_08_31_yotam_nir`) reported hook Yes/No prompts every few minutes; both escaped with `--dangerously-skip-permissions`, disabling everything. The canary probe proves native deny survives exactly that flag; ork's asks did not need to exist for those commands, and after the purge they do not.

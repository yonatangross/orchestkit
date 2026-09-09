# Multi-engine support audit: what pi, Codex and Cursor actually load from OrchestKit

Date: 2026-09-08. Tree: `feat/multi-engine-support` at `280f0c83d` (10.0.0-beta.8).
Every row below is a measurement on this workstation unless it is marked DERIVED.

The operator's question was "why doesn't OrchestKit support pi officially, and Codex and
Cursor?" Half of the premise is wrong and half is right. Codex and Cursor have shipped
adapters since August 2026 (#3265, #3748, #3753). pi has nothing: no manifest, no docs page,
no docs-site search hit ("pi" returns PII masking and pie charts).

## Engines measured

| Engine | Version | Where it lives |
|---|---|---|
| pi | 0.85.0 | pnpm global, `@earendil-works/pi-coding-agent` |
| Codex CLI | 0.153.4 (`codex --version` prints `codex-cli 0.153.4`) | `~/.local/bin/codex` |
| cursor-agent | 2026.09.02-c22c1a3 | `~/.local/share/cursor-agent/versions/2026.09.02-c22c1a3` |
| Claude Code | floor 2.1.251 | reference host |

Sources read: pi 0.85.0 `dist/core/package-manager.js`, `dist/core/skills.js`,
`dist/core/system-prompt.js`, `dist/core/pi-manifest.js`; the codex and cursor-agent binaries
(string tables); `plugins/ork-codex/`, `plugins/ork/.cursor-plugin/`, `.agents/plugins/`,
`.cursor-plugin/`; the operator's `~/.pi/agent/settings.json`, `~/.codex/config.toml`,
`~/.cursor/`.

## What each engine loads

### SKILL.md (the cross-engine surface)

| Engine | Discovery paths | OrchestKit result |
|---|---|---|
| Claude Code | plugin manifest `skills` | 107 skills, 36 agents, 171 hooks |
| pi | `~/.pi/agent/skills`, `~/.agents/skills`, project `.pi/skills`, project `.agents/skills` (cwd and every ancestor up to the git root), packages via `pi install`, `--skill <path>` | see below |
| Codex | `~/.agents/skills`, project `.agents/skills`, plugin `skills` path | 6 skills from `ork-codex` |
| Cursor | plugin `skills` path, `.cursor/skills`, and it also reads `.claude-plugin/plugin.json` | 107 skills, 36 agents, 36 command wrappers |

**pi loader against the tree** (pi's own `loadSkillsFromDir`, run directly with node, no
model, no lock files):

```
plugins/ork/skills:       skills=107 diagnostics=0
src/skills:               skills=107 diagnostics=0
plugins/ork-codex/skills: skills=6   diagnostics=0
.agents/skills:           skills=0   (directory does not exist)
```

`formatSkillsForPrompt` on those 107 lists **78** in the model-visible block. The other 29
carry `disable-model-invocation: true` and stay reachable only as `/skill:<name>`. The catalog
block is 44,549 characters, about 11k tokens, before any skill body is read.

**pi headless, real model** (`z-ai/glm-5.3-flash` via OpenRouter, `</dev/null`, `--mode json`,
`--skill ./plugins/ork/skills`, four runs, USD 0.0002 each):

| flags | model answer | input tokens |
|---|---|---|
| `--no-builtin-tools` | `SKILLS=0` | 1,626 |
| `--approve --no-builtin-tools` | `SKILLS=0` | 1,600 |
| `--no-approve` (builtin tools on) | `SKILLS=139 FIRST=tavily-best-practices HAS_IMPLEMENT=yes` | 21,729 |
| `--approve` (builtin tools on) | `SKILLS=139 FIRST=tavily-best-practices HAS_IMPLEMENT=yes` | not captured |

139 = 78 OrchestKit + the operator's user-level skills. The variable is the tool set, not
trust. `dist/core/system-prompt.js:29` says it outright: "Append skills when a tool capable of
reading their files is available." **A pi run with `--no-builtin-tools` never sees a single
OrchestKit skill.** That flag is the read-only guard of the sweep class (below), so the
cheapest lane is also the one that cannot use OrchestKit at all today.

**pi package install is a no-op for OrchestKit (DERIVED from the loader source).**
`pi install git:github.com/yonatangross/orchestkit` clones the repo as a package and resolves
resources in this order: `package.json` `pi` key, else the default directories `skills/`,
`extensions/`, `prompts/`, `themes/` at the package root. OrchestKit's root `package.json` has
no `pi` key and the root has no `skills/` directory (skills live in `src/skills` and
`plugins/ork/skills`), so the install registers zero resources. The working shape on this
machine is hq-ext-plugin's `"pi": {"skills": ["./skills", "./plugins/hq-codex/skills"],
"extensions": ["./integrations/pi/hq-gate.ts"]}`, which pi has loaded from
`~/.pi/agent/git/github.com/Yonatan-HQ/hq-ext-plugin` since 2026-08-28.

**Codex** loads the `ork-codex` plugin: `codex plugin list` shows
`ork-codex@orchestkit-codex installed, enabled 10.0.0-beta.5` sourced from
`https://github.com/yonatangross/orchestkit.git` path `plugins/ork-codex` ref `main`. Main is at
beta.8; the plugin cache lags three releases behind, so "ref main" is not "tracks main". The
pack is six thin skills (82 lines total): `$ork-brainstorm`, `$ork-explore`, `$ork-implement`,
`$ork-assess`, `$ork-verify`, `$ork-review-pr`. The four role templates
(`ork_explorer`, `ork_implementer`, `ork_reviewer`, `ork_verifier`) are present in
`~/.codex/agents/` because Codex loads roles from there, not from a plugin manifest. The
codex binary reads `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json` and
`.cursor-plugin/plugin.json`, `.agents/plugins/marketplace.json`, `.agents/skills`, `.codex/agents`,
`.codex/hooks` and `AGENTS.md`.

**Cursor** is pointed at the full `ork` plugin (`.cursor-plugin/marketplace.json` source
`plugins/ork`). `plugins/ork/.cursor-plugin/plugin.json` lists `skills`, `agents` and
`commands` (36 generated wrappers under `.cursor-plugin/commands/`). On this machine
`~/.cursor/plugins/installed.json` does not list `ork` (only claude-hud and two LSP plugins),
so the Cursor route is CLAIMED by #3748 and #3750, not re-measured live tonight. The cached
tree at `~/.cursor/plugins/cache/orchestkit/ork/05464277…` has a `.cursor-plugin/plugin.json`
and no `commands/` directory, which is the pre-#3541 shape. Open defect: #3941, the wrappers
carry 259 bare same-skill relative refs and 53 `${CLAUDE_PLUGIN_ROOT}` refs that Cursor cannot
resolve from `.cursor-plugin/commands/`.

### Hooks (Claude Code only, and what each engine has instead)

| Engine | Hook mechanism | OrchestKit today |
|---|---|---|
| Claude Code | `hooks.json`, 171 TypeScript hooks | shipped |
| pi | none; TypeScript **extensions** declared in `package.json` `pi.extensions` | nothing shipped |
| Codex | `hooks.json` under `.codex/hooks`, events `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit` (binary string table), trust-gated (`--dangerously-bypass-hook-trust` exists) | nothing shipped; the operator's own `~/.codex/hooks/hq-guard-pretooluse.py` proves the surface works |
| Cursor | `.cursor/hooks.json` `{"version":1,"hooks":{"sessionStart":[{"command":…}]}}` (measured at `~/.cursor/hooks.json`) | nothing shipped (#293 closed as docs only) |

Claude hook scripts need `${CLAUDE_PLUGIN_ROOT}` and the CC event payload, so they do not
port as files. Codex's event names match Claude Code's, which makes a thin fallback plausible
for the guard-class hooks; Cursor's events are camelCase and payloads differ.

### MCP configuration

| Engine | File read | Host discovery | OrchestKit today |
|---|---|---|---|
| Claude Code | `.mcp.json`, plugin manifest `mcpServers` | n/a | context7 recommended, not shipped |
| pi (`pi-mcp-adapter` 2.32.1) | `.pi/mcp.json`, `.mcp.json`, `~/.config/mcp/mcp.json`, in that precedence | `hostConfigDiscovery` off by default | repo has no `.mcp.json`, so `mcp({})` reports `0/0 servers` |
| Codex | `~/.codex/config.toml` `[mcp_servers.*]`, plugin `mcp.json` | user config wins over plugin | `ork-codex/mcp.json` ships context7 over HTTP with `bearer_token_env_var` |
| Cursor | `~/.cursor/mcp.json`, project `.cursor/mcp.json` | n/a | nothing shipped |

pi's `.pi/mcp.json` layers an `includeTools` allowlist per server, which is how a pi pane is made
read-mostly by construction (measured in platform: 11 servers, 61 tools, per-server allowlists).
OrchestKit ships no template for it.

### Placeholders

`${CLAUDE_PLUGIN_ROOT}` is delivered as a literal by pi and never substituted by Cursor (#3822,
measured on pi 0.84.4). After #3940 same-skill refs are bare relative, which pi and the Agent
Skills spec resolve against the SKILL.md directory. Cross-skill (22) and `shared/` (29) refs
and hook commands still carry the variable.

## The lane model that decides which engine runs what

Three classes, from the conveyor that dispatches work on this estate:

| Class | Engine and flags | Reads skills? | Writes? | Cost |
|---|---|---|---|---|
| **sweep** | pi, cheap OpenRouter model, `--no-builtin-tools`, MCP reads only | **no** (measured above) | no | local, fractions of a cent |
| **mech** | pi with `--approve`, or Codex `--profile ork-mech`, or cursor-agent `--force --sandbox enabled` | yes | yes, sandboxed to the workspace plus `--add-dir` for the git common dir | quota-routed |
| **reason** | Claude Code, attended | yes, plus hooks | yes | Claude quota |

Two headless pi contracts are load-bearing for any of this: `pi -p` blocks forever on an open
stdin (close it with `</dev/null`), and the session directory is the first write (`--no-session`
or `--session-dir <writable>`).

## Gaps, ranked

1. pi has no install path: no `pi` key in `package.json`, no root `skills/`, no `.pi/mcp.json`
   template, zero docs-site mentions. A user who runs `pi install git:github.com/yonatangross/orchestkit`
   gets nothing and no error.
2. The sweep class cannot see skills at all. Either the guard changes (a read-only tool set
   instead of no tools) or the docs say so plainly.
3. Codex plugin cache lags main (beta.5 vs beta.8) with "ref main" in the source line.
4. Cursor wrappers ship unresolvable paths (#3941, open).
5. No hooks story outside Claude Code, while Codex exposes the same event names.
6. No support matrix anywhere a user lands (README, installation page).

## Controls that would fail today

- `node -e` against pi's loader with the repo root as the package: 0 resources.
- `grep -c '"pi"' package.json`: 0.
- docs-site search "pi": no guide in the top 3.
- `codex plugin list` version equals `plugins/ork-codex/.codex-plugin/plugin.json` version: false.

## Amendment, 2026-09-08 (lane #4002)

Two rows above were re-measured while shipping the Codex mech profile, and one
of them was wrong.

**Corrected.** The Codex CLI version row read `2026.09.02-c22c1a3`, which is the
cursor-agent build string. `codex --version` on this workstation prints
`codex-cli 0.153.4`. Everything else in the Codex rows re-measured unchanged.

**New, and it changes the fix shape.** `--profile <name>` on codex-cli 0.153.4
does NOT select a `[profiles.<name>]` table in `config.toml`. The flag's own
type is `CONFIG_PROFILE_V2` and its help reads "Layer `$CODEX_HOME/<name>.config.toml`
on top of the base user config". A legacy table is a hard error:

```
$ CODEX_HOME=<isolated> codex exec --strict-config --profile ork-mech "hi"
Error loading config.toml: --profile `ork-mech` cannot be used while
<home>/config.toml contains legacy `profile = "ork-mech"` or `[profiles.ork-mech]`
config; move those settings into <home>/ork-mech.config.toml and remove the
legacy profile selector/table.
```

Positive control that the file, not the table, is what gets read: putting
`sandbox_mode = "bogus-mode"` in `ork-mech.config.toml` fails at
`ork-mech.config.toml:2:16: unknown variant`.

Three further measurements from the same probes, each run against an isolated
`CODEX_HOME` with no auth, so every arm ends at HTTP 401 and nothing is billed:

| Probe | Result |
|---|---|
| `--profile` naming a file that does not exist | no error. Codex runs on the base config, so a typo silently downgrades the sandbox |
| `codex exec` with a prompt argument and an inherited open stdin | blocks on `Reading additional input from stdin...`, no timeout. `</dev/null` clears it |
| writable roots, cwd inside a linked worktree | `sandbox: workspace-write [workdir, /tmp, $TMPDIR]`. With `--add-dir <git common dir>` the header lists that path too, which is the `index.lock` fix |

The shipped artifact is `src/codex/ork-codex/profiles/ork-mech.config.toml`,
loaded verbatim under `codex exec --strict-config` to produce the header quoted
in the guide.

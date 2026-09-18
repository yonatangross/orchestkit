# Antigravity (agy) host audit: what agy 1.2.6 actually loads from OrchestKit

Date: 2026-09-18. Tree: `feat/4235-agy-host` off `origin/main` (10.0.0-beta.51).
Every row below is a measurement on this workstation unless it is marked DERIVED.

Issue #4235: the host picker lists seven hosts and agy is missing while the HQ
floor runs agy lanes every day. This audit is the source for every "loads /
does not load" sentence on the host card. Marker artifacts live under
`/tmp/agy-probe/` (a git-init scratch workspace) and `/tmp/agy-shared/`; nothing
was left planted in `~/.gemini/` when the audit finished.

## Engine measured

| Engine | Version | Where it lives |
|---|---|---|
| Antigravity CLI (`agy`) | 1.2.6 | `~/.local/bin/agy` (Mach-O arm64, 184 MB) |

Sources read: `agy --help`, `agy plugin/mcp/agent --help`, the binary string
table (embedded changelog lines are the best spec this binary ships), the
bundled `agy-customizations` skill docs at
`~/.gemini/antigravity/builtin/skills/agy-customizations/docs/` (skills.md,
hooks.md, json_configs.md, plugins.md, mcp_servers.md, rules.md),
`~/.gemini/config/`, `~/.gemini/skills/`, `~/.agents/skills/`,
`~/.gemini/antigravity-cli/settings.json`, and the dispatcher dry-run below.

## The discovery model (measured, then confirmed against the bundled docs)

agy has a real customization system, not a config-file convention. The
"customization root" is `.agents/` in a workspace and `~/.gemini/config/`
globally. Under a root it discovers `skills/<name>/SKILL.md`,
`plugins/<name>/` (plugin.json + skills/ + agents/ + commands/ + hooks.json +
mcp_config.json + rules/), `hooks.json`, `skills.json`, `plugins.json`, and
`mcp_config.json` (global root only for MCP). `skills.json`/`plugins.json`
carry `entries`/`inherits` path lists, so a repo can point at a shared skill
directory with two lines of JSON.

Workspace registration matters. In print mode, cwd alone does NOT register the
workspace: `cd /tmp/agy-probe && agy -p "/skills"` returned the 43-line
user-level list even after `/tmp/agy-probe` was added to
`trustedWorkspaces` in `~/.gemini/antigravity-cli/settings.json`. What registers
it is `--add-dir <absolute path>`; a relative `--add-dir .` does not (measured
both ways, same session). In the TUI the launch directory is the workspace, so
the interactive lane shape needs no flag; `trustedWorkspaces` already holds
dozens of dispatcher-created `.worktrees/` entries.

## What loads

### Skills

| Root | Test | Result |
|---|---|---|
| `<workspace>/.agents/skills/<name>/SKILL.md` | marker `ork-agy-marker`, `agy -p "/skills" --add-dir /tmp/agy-probe` | LOADS (listed by name+description) |
| `~/.gemini/config/skills/<name>/` | marker `ork-agy-marker-user` | LOADS |
| `~/.gemini/skills/<name>/` (shared with gemini-cli) | marker `ork-agy-gemini-marker` | LOADS |
| `<workspace>/.agents/skills.json` `entries[].path` | marker at `/tmp/agy-shared/skills/ork-agy-shared` referenced from `.agents/skills.json` | LOADS |
| `~/.agents/skills/` (skills.sh `-g` universal dir, pi's convention) | `skills add -g` wrote `~/.agents/skills/doctor`; `agy -p "/skills"` shows 0 `doctor` rows | DOES NOT LOAD |
| skills.sh project install | `npx skills add yonatangross/orchestkit -s doctor` wrote `./.agents/skills/doctor`; `/skills` lists it | LOADS (the pack answer) |
| `<plugin>/skills/` under `.agents/plugins/` | marker `marker-plugin:ork-agy-plugin-marker` | LOADS, namespaced `<plugin-dir>:<name>` |
| `agy plugin install <dir>` of `plugins/ork` | `agy plugin validate plugins/ork` | VALIDATES: `skills: 108 processed` (107 + CONTRIBUTING-SKILLS.md counted as a skill). Install copies to `~/.gemini/config/plugins/ork/`; not installed live |

`/skills` in print mode is a non-interactive answer (one tab-separated record
per line, no model call). Same for `/hooks`, `/agents`, `/help`, `/config`,
`/permissions`, `/usage`, `/model`, `/effort`, `/changelog`. `/mcp` and
`/clear` refuse in print mode by design.

### Slash commands and skill expansion

| Surface | Test | Result |
|---|---|---|
| `/<skill-name>` expansion in print mode | `agy -p "/ork-agy-marker" --add-dir /tmp/agy-probe` | model replied `AGY_MARKER_OK` (body expanded client-side) |
| `--disable-slash-commands` | same prompt with the flag | still `AGY_MARKER_OK`: the skill description sits in the model's catalog, so the model activates it anyway. The flag gates `/name` text expansion, not skill discovery (measured, mildly surprising) |
| Plugin `commands/*.md` | `agy plugin validate` on marker plugin | `commands: 1 processed (converted to skills)`; the entry point is still `/<name>` |
| ork `.cursor-plugin/commands/*.md` wrappers | not in any agy discovery root | DOES NOT LOAD (and their `${CLAUDE_PLUGIN_ROOT}` refs would not resolve anyway, #3941) |
| Namespace | plugin-dir prefix | `marker-plugin:ork-agy-plugin-marker`; an `ork` plugin dir yields `ork:doctor`, matching the `/ork:<skill>` spelling |

### Agents

| Surface | Test | Result |
|---|---|---|
| `<plugin>/agents/*.md` | marker agent in marker-plugin, `agy -p "/agents" --add-dir /tmp/agy-probe` | LOADS (`ork-agy-marker-agent` listed) |
| `plugins/ork/agents/` | `agy plugin validate plugins/ork` | `agents: 36 processed` (would load on plugin install) |

### Hooks

| Surface | Test | Result |
|---|---|---|
| `<workspace>/.agents/hooks.json` | marker `PreInvocation` hook writing `/tmp/agy-probe/hook-fired.txt` | LISTED by `agy -p "/hooks"`, FIRED on a real `agy -p "Reply with exactly: OK"` run (file contains a timestamp) |
| `~/.gemini/config/hooks.json` | pre-existing `herdr` `PreInvocation` hook | LOADS (listed beside the marker) |
| `plugins/ork/hooks/hooks.json` + `plugins/ork/hooks/dist/` | `agy plugin validate plugins/ork` | `hooks: skipped (not found)`; agy wants `<plugin>/hooks.json` at the plugin root, not `hooks/hooks.json` |
| ork hook schema | agy `hooks.json` is `{hookName: {EventName: [handlers]}}` with events `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`; stdin payload is camelCase protojson (`conversationId`, `stepIdx`), stdout is `{decision: allow|deny|ask|force_ask}` | DOES NOT PORT. CC's `{eventName: [{matcher, hooks}]}` shape and `${CLAUDE_PLUGIN_ROOT}` commands are a different contract; a straight copy would register hook names `PreToolUse`/`PostToolUse` containing no event keys |

### MCP

| Surface | Test | Result |
|---|---|---|
| `~/.gemini/config/mcp_config.json` | planted `ork-agy-marker-mcp` stdio server | `agy mcp list` shows `ork-agy-marker-mcp stdio enabled /bin/cat` (removed after) |
| `<plugin>/mcp_config.json` | real stdio marker server (`/tmp/agy-probe/marker-mcp.py`, `tools/list` exposes `marker_ping`) inside `.agents/plugins/marker-plugin/` | `agy -p "Call the tool named marker_ping ..."` returned `AGY_MCP_MARKER_PONG` (server spawned, tool routed, answer returned) |
| repo `.mcp.json` | not in any agy discovery root; `agy mcp list` never enumerates it | DOES NOT LOAD (the plugin `mcp_config.json` route is the measured way to ship a server) |
| `agy mcp add/remove/list/enable/disable` | manages the global `mcp_config.json` | works; `mcp list` shows global entries only, not plugin-bundled ones |

### Rules (DERIVED)

Bundled docs: `AGENTS.md` and `GEMINI.md` are discovered per-directory from cwd
up to the repo root, deduplicated; plugin `rules/` merge when the plugin is
enabled. Not marker-tested; the orchestkit `AGENTS.md` would load in a lane
opened at the repo root.

## The unattended lane shape (deliverable 4 evidence)

Dispatcher dry-run, verbatim:

```
$ python3 ~/.config/herdr/plugins/hq-crossrepo/bin/hq_dispatch.py \
    --repo orchestkit --kind gemini --class mech --dry-run \
    "audit-marker: reply with AGY_LANE_OK"

repo: orchestkit at /Users/me/coding/yonatangross/orchestkit
route: forced → gemini
autonomy: gemini mech → --sandbox --dangerously-skip-permissions
model: gemini mech -> gemini-3.8-flash-medium
plan: git -C ... worktree add .../.worktrees/45021-audit-marker -b chore/dsp-45021-audit-marker
plan: workspace create --cwd .../.worktrees/45021-audit-marker --label '... orchestkit · audit marker 45021'
      agent start audit-marker-45021 --kind agy --pane <w:p1> -- --sandbox --dangerously-skip-permissions --model gemini-3.8-flash-medium
      agent prompt audit-marker-45021 'audit-marker: reply with AGY_LANE_OK'
      trailer: working defaults + RECAP (870 chars sent)
```

The pane launches interactive `agy` in the lane worktree, so the worktree's
`.agents/` is the workspace root and `.agents/skills` loads after folder trust
(dispatcher worktrees already populate `trustedWorkspaces`). The prompt goes
over the agent socket; slash-command expansion happens inside the session. No
real dispatch was run: the kind's quota is capped and the dry-run already
records the exec plan. Recorded as dry-run only, per the issue.

## Pack decision

agy reads project `.agents/skills`, so the Muse/OpenCode path is reused as-is:
`npx skills add yonatangross/orchestkit -s <starter>` writes `./.agents/skills/`
with Antigravity and Antigravity CLI both in skills.sh's universal target list
(measured live: `Installing to: AiderDesk, Antigravity, Antigravity CLI, ...`
and `./.agents/skills/doctor` universal). No `ork-agy` pack, no new plugins/
directory.

Two honest caveats:

- `skills add -g` (global) lands in `~/.agents/skills/`, which agy does NOT
  read. Global agy skills live in `~/.gemini/config/skills/` (or
  `~/.gemini/skills/`). The project-level line is the correct default; a user
  who wants the skills everywhere can copy the directory or run
  `agy plugin install` on a checkout.
- A fuller install exists but is not the card's line:
  `agy plugin validate plugins/ork` reports `skills: 108, agents: 36` and
  `agy plugin install <checkout>/plugins/ork` would copy them into
  `~/.gemini/config/plugins/ork/` namespaced `ork:<name>`. It needs a local
  clone, so it is a power path, not the one-liner.

## Gaps, ranked

1. agy does not read `~/.agents/skills/` (the skills.sh global dir). Global
   installs silently land somewhere agy never looks.
2. Print-mode workspace discovery needs an absolute `--add-dir`; bare cwd and
   relative `.` both miss `.agents/skills`. Headless users must be told.
3. Hooks are a different schema and payload contract; nothing of ork's
   hook surface ports as files.
4. ork's slash-command wrappers (`.cursor-plugin/commands/`) do not load; the
   invocable shape is `/skill-name` (or `ork:skill-name` via plugin install).
5. Repo `.mcp.json` is not read; shipping an MCP server means a plugin
   `mcp_config.json`.

## Controls that would fail today

- `agy -p "/skills" --add-dir <repo>` after `skills add` in the repo: 0 ork
  rows before this change is exercised on a fresh clone.
- `agy plugin validate plugins/ork | grep hooks`: reports `skipped`.
- `ls ~/.agents/skills` shows skills agy will never list.
- `agy mcp list` shows no ork-supplied server (none is shipped).

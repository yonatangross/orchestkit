# Host support measurement, 2026-11-22

Closes the measurement half of #5262, #5263, #5264, #5265. Every number below was
read from a live binary or an installed artifact on this machine, not inferred.

| Host | Binary | Version | Command(s) |
|---|---|---|---|
| Devin | `devin` | 3000.14.30821 (a09cd7f323ee) | `plugins_cache/installed.json`, `~/.config/devin/config.json` |
| Antigravity | `agy` | 1.5.14 | `agy plugin list`, `agy agents`, `agy mcp list` |
| OpenCode | `opencode` | 1.19.6 (via `npx opencode-ai@latest`) | `opencode debug skill`, `opencode agent list`, `opencode debug config` |
| Muse Code | `muse` | 1.4.25 (1.4.25-R9361.1) | `muse plugins inspect ork`, `muse skills list`, `muse plugins list` |

## Devin (#5262)

The plugin store (`~/.local/share/devin/cli/plugins_cache/installed.json`) lists
`plugins/ork` (git-subdir of yonatangross/orchestkit) as a required plugin, repo and
managed-account scope. The cached bundle contains `skills/` (82 dirs), `agents/`
(36 `.md`), and `hooks/hooks.json`.

`devin plugins info ork` could not be run: the command requires an authenticated
session (`You must be logged in to manage plugins`). Counts above were read from
the installed artifacts instead. That Devin loads the ork agents is confirmed by
this session itself, whose subagent profiles include all 36 `ork:*` agents.

Hooks: Devin's config schema carries the Claude Code lifecycle hook shape, but
fires only 9 event types: `Notification`, `PermissionRequest`, `PreToolUse`,
`PostToolUse`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStop`,
`UserPromptSubmit`. ork's hooks.json registers 103 entries across 31 events, so
**58 of 103 entries** land on events Devin fires. Entries on `Setup`,
`InstructionsLoaded`, `FileChanged`, `TaskCreated`, `PostCompact`, and the other
22 event types are never invoked.

## Antigravity (#5263)

`agy plugin list` shows `ork (disabled, 10.0.0-beta.56), Source: claude-code,
Components: 107 skills`: agy imports the Claude Code plugin wholesale and reads
its skills. All 36 `ork-*` agents appear in `agy agents`.

Hooks: hq-ext (also a claude-code import) shows `Components: 86 skills, 8 hooks`,
so agy counts plugin hooks when it can parse them. ork's entry lists **no hooks
component**, a measured zero rather than a gap in agy's reader. The installed copy
is also stale (beta.56, when ork carried 107 skills); a fresh import would carry
the current set.

MCP: `agy mcp list` manages a full server table (stdio + http, enable/disable),
real MCP support configured per agy's own config, independent of plugin packs.

## OpenCode (#5264)

`opencode debug skill` enumerates skills from `~/.claude/skills`,
`~/.agents/skills`, `~/.config/opencode/skill(s)/` and project `.opencode/` dirs.
The skills.sh starter (12 skills) installs into `~/.agents/skills` and is picked
up. The full ork set is loadable the same way or via `skills.paths` in
`opencode.json`; the table keeps the 12-skill starter count because that is what
the documented command installs.

Agents: OpenCode reads `*.md` agent files from `.opencode/agent(s)/` and
`~/.config/opencode/agent(s)/`. ork ships no OpenCode-format agents and no pack
installs them, so `none`.

Hooks: OpenCode plugins are TypeScript modules with an event-handler API, not
hooks.json lifecycle events. ork registers nothing there, so `none`.

MCP: full `mcp` block support in opencode.json (local + remote, enabled flag).

## Muse Code (#5265)

`muse plugins list` shows `ork 10.5.3 enabled=true active=true` (foreign-import
from `~/.claude/plugins/cache`). `muse plugins inspect ork --json` reports
`capabilities.skills` containing every skill in the pack: the **full set loads**,
not just the 12-skill starter.

`capabilities` also lists `hooks: []`, `mcp_servers: []`, `commands: []`, a
positively empty hooks array, so hooks = `none`. There is no agents capability
kind in Muse's plugin model at all, so agents = `none`.

`muse skills list` additionally reads user-scope `~/.agents/skills` (219 skills
visible), so the skills.sh starter route also works as a subset install.

## Table changes

- Devin: `82 | 36 | 58 of 103` (was `82 | ? | ?`).
- Antigravity: `82 | 36 | none`, route `plugin (claude-code)` (was `12 | ? | ?`).
- Muse Code: `82 | none | none`, route `plugin (muse)` (was `12 | ? | ?`).
- OpenCode: `12 | none | none` (was `12 | ? | ?`).

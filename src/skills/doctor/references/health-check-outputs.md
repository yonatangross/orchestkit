# Health Check Output Examples

Reference output examples for each `/ork:doctor` check category.

## Channel Detection

**Stable:**
```
Channel: stable (v7.0.0)
```

**Beta:**
```
Channel: beta (v7.0.0-beta.3)
⚠ You are on the beta channel. Report issues at github.com/yonatangross/orchestkit/issues
```

**Alpha:**
```
Channel: alpha (v7.0.0-alpha.1)
⚠ You are on the alpha channel. Expect breaking changes. Report issues at github.com/yonatangross/orchestkit/issues
```

**Detection logic:**
1. Read version from `.claude-plugin/plugin.json` (`version` field) or `version.txt`
2. If version contains `-alpha` → alpha channel
3. If version contains `-beta` → beta channel
4. Otherwise → stable channel

## Installed Plugins

```
Installed Plugins: 1
- ork: 92 skills, 33 agents, 104 hook entries
```

## Skills Validation

```
Skills: 79/79 valid
- User-invocable: 18 commands
- Reference skills: 61
```

## Agents Validation

```
Agents: 38/38 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

## Hook Health

```
Hooks: 95/95 entries valid (12 bundles)
- Global: 34, Agent-scoped: 54, Skill-scoped: 7
- Async hooks: 9 (native async)
- Error Rate: 0.3%
```

## Memory System

```
Memory System: healthy
- Graph Memory: 42 decisions, 0 corrupt, queue depth 3
```

## Build System

```
Build System: in sync
- Skills: 69 src/ = 69 plugins/
- Agents: 38 src/ = 38 plugins/
- Last build: 2 minutes ago
```

## Permission Rules

```
Permission Rules: 12/12 reachable
```

## Schema Compliance

```
Schemas: 15/15 compliant
```

## Coordination System

```
Coordination: healthy
- Active instances: 1
- Stale locks: 0
```

## Context Budget

```
Context Budget: 1850/2200 tokens (84%)
```

## Claude Code Version

**OK:**
```
Claude Code: 2.1.47 (OK)
- Minimum required: 2.1.47
- All 15 features available
```

**Degraded:**
```
Claude Code: 2.1.44 (DEGRADED)
- Minimum required: 2.1.47
- Missing: last_assistant_message, added_dirs, Windows hooks, worktree discovery
- Upgrade: npm install -g @anthropic-ai/claude-code@latest
```

## External Dependencies

**Installed:**
```
External Dependencies:
- agent-browser: installed (OK)
```

**Not installed:**
```
External Dependencies:
- agent-browser: NOT INSTALLED (optional - install with: npx skills add vercel-labs/agent-browser)
```

## Plugin Validate

**Pass (CC >= 2.1.77):**
```
Plugin Validate: PASSED
- claude plugin validate: 0 errors, 0 warnings
```

**Fail (CC >= 2.1.77):**
```
Plugin Validate: FAILED
- claude plugin validate: 2 errors
  - src/skills/broken/SKILL.md: missing required field "description"
  - src/hooks/hooks.json: invalid matcher pattern at hooks[3]
- Fix errors and re-run: npm run build && claude plugin validate
```

**Skipped (CC < 2.1.77):**
```
Plugin Validate: SKIPPED (requires CC >= 2.1.77)
- Falling back to OrchestKit custom validation only
```

## Managed Settings Policy (CC >= 2.1.92)

**OK — forceRemoteSettingsRefresh with endpoint:**
```
Managed Settings: OK
- forceRemoteSettingsRefresh: enabled
- Remote endpoint configured
```

**Warning — forceRemoteSettingsRefresh without endpoint:**
```
Managed Settings: WARNING
- forceRemoteSettingsRefresh: enabled but no remote settings endpoint detected
- This will block startup if network is unavailable
- Configure a remote endpoint or remove forceRemoteSettingsRefresh
```

**Info — not set:**
```
Managed Settings: OK (default)
- forceRemoteSettingsRefresh: not set (falls back to cached settings)
```

**MCP connector conflict (CC >= 2.1.92 fix):**
```
MCP Servers: WARNING
- Plugin MCP server "{name}" duplicates a claude.ai connector
- Prior to CC 2.1.92 this caused stuck "connecting" state
- Consider setting ENABLE_CLAUDEAI_MCP_SERVERS=false or renaming the plugin server
```

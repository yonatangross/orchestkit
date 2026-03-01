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
- ork: 69 skills, 38 agents, 85 hook entries
```

## Skills Validation

```
Skills: 69/69 valid
- User-invocable: 17 commands
- Reference skills: 52
```

## Agents Validation

```
Agents: 38/38 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

## Hook Health

```
Hooks: 78/78 entries valid (12 bundles)
- Global: 55, Agent-scoped: 22, Skill-scoped: 1
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

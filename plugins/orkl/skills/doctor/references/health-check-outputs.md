# Health Check Output Examples

Reference output examples for each `/ork:doctor` check category.

## Installed Plugins

**orkl:**
```
Installed Plugins: 1
- orkl: 46 skills, 38 agents, 87 hook entries
```

**ork (full):**
```
Installed Plugins: 1
- ork: 69 skills, 38 agents, 87 hook entries
```

## Skills Validation

**Full ork:**
```
Skills: 67/67 valid
- User-invocable: 24 commands
- Reference skills: 38
```

**orkl only:**
```
Skills: 46/46 valid
- User-invocable: 24 commands
- Reference skills: 21
```

## Agents Validation

```
Agents: 36/36 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

## Hook Health

```
Hooks: 87/87 entries valid (12 bundles)
- Global: 66 (PreToolUse: 14, PostToolUse: 6, SubagentStart: 7, SubagentStop: 7,
  Setup: 6, SessionStart: 5, UserPromptSubmit: 5, PermissionRequest: 3, ...)
- Agent-scoped: 22, Skill-scoped: 1
- Async hooks: 7 (fire-and-forget)
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
- Skills: 67 src/ = 67 plugins/
- Agents: 36 src/ = 36 plugins/
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

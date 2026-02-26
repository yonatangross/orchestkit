# Health Check Output Examples

Reference output examples for each `/ork:doctor` check category.

## Installed Plugins

**orkl:**
```
Installed Plugins: 1
- orkl: 69 skills, 38 agents, 78 hook entries
```

**ork (full):**
```
Installed Plugins: 1
- ork: 69 skills, 38 agents, 78 hook entries
```

## Skills Validation

**Full ork:**
```
Skills: 69/69 valid
- User-invocable: 29 commands
- Reference skills: 40
```

**orkl only:**
```
Skills: 69/69 valid
- User-invocable: 29 commands
- Reference skills: 40
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

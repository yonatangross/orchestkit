# Claude Code Version Mapping

Maps Claude Code features to version numbers for decision context.

## Version Timeline

```
CC 2.1.0  │ 2025-10-xx │ Baseline
CC 2.1.3  │ 2025-11-xx │ Unified skills/commands
CC 2.1.6  │ 2025-11-xx │ Native agents, statusline
CC 2.1.7  │ 2025-12-xx │ Flat skills, parallel hooks
CC 2.1.9  │ 2025-12-xx │ additionalContext, auto:N MCP
CC 2.1.11 │ 2025-12-xx │ Setup hooks (--init)
CC 2.1.14 │ 2026-01-xx │ Plugin versioning (@commit)
CC 2.1.15 │ 2026-01-xx │ Engine field, npm deprecation
CC 2.1.16 │ 2026-01-xx │ Task Management, VSCode plugins
```

## Feature → Version Map

### CC 2.1.3

| Feature | Description |
|---------|-------------|
| `user-invocable` | Skills with `user-invocable: true` in frontmatter |
| Unified commands | Skills and commands merged |

### CC 2.1.6

| Feature | Description |
|---------|-------------|
| Native agents | `skills:` array in agent frontmatter |
| Statusline | `statusline` config for context HUD |
| Model selection | `model: sonnet/opus/haiku` in agents |
| Context modes | `context: fork/inherit/none` in skills |

### CC 2.1.7

| Feature | Description |
|---------|-------------|
| Flat skills | `skills/<skill-name>/` structure |
| Parallel hooks | Native parallel execution |
| Output aggregation | Hook outputs merged |
| Line continuation fix | `\` no longer bypasses validation |

### CC 2.1.9

| Feature | Description |
|---------|-------------|
| `additionalContext` | PreToolUse context injection |
| `auto:N` MCP | Threshold-based MCP auto-enable |
| `plansDirectory` | Custom plans location |
| Session ID guarantee | `CLAUDE_SESSION_ID` always available |

### CC 2.1.11

| Feature | Description |
|---------|-------------|
| Setup hooks | `--init`, `--init-only`, `--maintenance` flags |
| `once` hook flag | Single execution hooks |
| Self-healing | Automatic config repair |

### CC 2.1.14

| Feature | Description |
|---------|-------------|
| Plugin versioning | `@commit` and `@tag` pinning |
| Bash history | `!` + Tab for history autocomplete |
| Plugin search | `/plugin search <query>` |
| Context window fix | Uses 98% (was incorrectly 65%) |

### CC 2.1.15

| Feature | Description |
|---------|-------------|
| Engine field | `"engine": ">=2.1.15"` in plugin.json |
| NPM deprecation | Warning for npm installs |
| VSCode /usage | Plan usage in VSCode |

### CC 2.1.16

| Feature | Description |
|---------|-------------|
| TaskCreate | Create tasks with subject, description |
| TaskUpdate | Update status, set dependencies |
| TaskGet | Retrieve full task details |
| TaskList | View all tasks summary |
| Task dependencies | `blocks`/`blockedBy` relationships |
| VSCode plugins | Native plugin management UI |

## OrchestKit Version → CC Requirement

| OrchestKit | Requires CC | Key Features |
|------------|-------------|--------------|
| 4.0.0 | >= 2.1.0 | Initial release |
| 4.6.0 | >= 2.1.6 | Native agents, Context 2.0 |
| 4.10.0 | >= 2.1.7 | Flat skills, parallel hooks |
| 4.16.0 | >= 2.1.9 | additionalContext, auto:N |
| 4.19.0 | >= 2.1.11 | Setup hooks |
| 4.25.0 | >= 2.1.15 | Engine field |
| 5.0.0 | >= 2.1.16 | Task Management |

## Detecting CC Version

### From CLI

```bash
# Get version string
claude --version
# Output: claude-code 2.1.16

# Parse version number
claude --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+'
```

### From Environment

```bash
# Not currently exposed, but proposed:
echo $CLAUDE_CODE_VERSION
```

### From Feature Detection

```typescript
function detectCCVersion(): string {
  // Check for TaskCreate tool availability
  if (hasToolAvailable('TaskCreate')) return '>=2.1.16';

  // Check for Setup hook support
  if (hasSetupHooks()) return '>=2.1.11';

  // Check for additionalContext support
  if (hasAdditionalContext()) return '>=2.1.9';

  // Check for flat skills
  if (hasFlatSkillStructure()) return '>=2.1.7';

  return '>=2.1.0';
}
```

## Using in Decision Metadata

When saving a decision, include the CC version:

```typescript
const metadata = {
  cc_version: await getCCVersion(),  // "2.1.16"
  plugin_version: getPluginVersion(), // "4.28.3"
  // ...other fields
};
```

This enables:
- Timeline grouping by CC version
- Understanding which CC features enabled the decision
- Tracking plugin evolution with CC updates

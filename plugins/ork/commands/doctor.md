---
description: "OrchestKit doctor for health diagnostics. Use when running checks on plugin health, diagnosing problems, or troubleshooting issues."
allowed-tools: [Bash, Read, Grep, Glob]
---

# Auto-generated from skills/doctor/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# OrchestKit Health Diagnostics

## Overview

The `/ork:doctor` command performs comprehensive health checks on your OrchestKit installation. It auto-detects installed plugins and validates 11 categories:

1. **Installed Plugins** - Detects orkl or ork
2. **Skills Validation** - Frontmatter, references, token budget (dynamic count)
3. **Agents Validation** - Frontmatter, tool refs, skill refs (dynamic count)
4. **Hook Health** - Registration, bundles, async patterns
5. **Permission Rules** - Detects unreachable rules (CC 2.1.3 feature)
6. **Schema Compliance** - Validates JSON files against schemas
7. **Coordination System** - Checks lock health and registry integrity
8. **Context Budget** - Monitors token usage against budget
9. **Memory System** - Graph memory health
10. **Claude Code Version** - Validates CC >= 2.1.47
11. **External Dependencies** - Checks optional tool availability (agent-browser)
12. **MCP Status** - Active vs disabled vs misconfigured, API key presence for paid MCPs

## When to Use

- After installing or updating OrchestKit
- When hooks aren't firing as expected
- Before deploying to a team environment
- When debugging coordination issues
- After running `npm run build`

## Quick Start

```bash
/ork:doctor           # Standard health check
/ork:doctor -v        # Verbose output
/ork:doctor --json    # Machine-readable for CI
```

## CLI Options

| Flag | Description |
|------|-------------|
| `-v`, `--verbose` | Detailed output per check |
| `--json` | JSON output for CI integration |
| `--category=X` | Run only specific category |

## Health Check Categories

### 0. Installed Plugins Detection

Auto-detects which OrchestKit plugins are installed:

```bash
# Detection logic:
# - Scans for .claude-plugin/plugin.json in plugin paths
# - Identifies orkl or ork
# - Counts skills/agents per installed plugin
```

**Output (orkl):**
```
Installed Plugins: 1
- orkl: 46 skills, 37 agents, 87 hook entries
```

**Output (ork full):**
```
Installed Plugins: 1
- ork: 67 skills, 37 agents, 87 hook entries
```

### 1. Skills Validation

Validates skills in installed plugins (count varies by installation):

```bash
# Checks performed:
# - SKILL.md frontmatter (name, description, user-invocable)
# - context: fork field (required for CC 2.1.0+)
# - Token budget compliance (300-5000 tokens)
# - Internal link validation (references/ paths)
# - Related Skills references exist
```

**Output (full ork):**
```
Skills: 67/67 valid
- User-invocable: 24 commands
- Reference skills: 38
```

**Output (orkl only):**
```
Skills: 46/46 valid
- User-invocable: 24 commands
- Reference skills: 21
```

### 2. Agents Validation

Validates agents in installed plugins:

```bash
# Checks performed:
# - Frontmatter fields (name, description, model, tools, skills)
# - Model validation (opus, sonnet, haiku only)
# - Skills references exist in src/skills/
# - Tools are valid CC tools
```

**Output:**
```
Agents: 36/36 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

### 3. Hook Health

Verifies hooks are properly configured:

```bash
# Checks performed:
# - hooks.json schema valid
# - Bundle files exist (12 .mjs bundles)
# - Async hooks use fire-and-forget pattern (9 async)
# - Background hook metrics health (Issue #243)
# - Windows-safe spawning (PR #645)
```

**Output:**
```
Hooks: 87/87 entries valid (12 bundles)
- Global: 66 (PreToolUse: 14, PostToolUse: 6, SubagentStart: 7, SubagentStop: 7,
  Setup: 6, SessionStart: 5, UserPromptSubmit: 5, PermissionRequest: 3, ...)
- Agent-scoped: 22, Skill-scoped: 1
- Async hooks: 7 (fire-and-forget)
- Error Rate: 0.3%
```

See [Hook Validation](references/hook-validation.md) for details.

### 4. Memory System (NEW)

Validates graph memory with file-level integrity checks:

```bash
# Automated checks:
# - Graph: .claude/memory/ exists, decisions.jsonl valid JSONL, queue depth

# Run these commands to gather memory health data:
wc -l .claude/memory/decisions.jsonl 2>/dev/null || echo "No decisions yet"
wc -l .claude/memory/graph-queue.jsonl 2>/dev/null || echo "No graph queue"
ls -la .claude/memory/ 2>/dev/null || echo "Memory directory missing"
```

Read `.claude/memory/decisions.jsonl` directly to validate JSONL integrity (each line must parse as valid JSON). Count total lines, corrupt lines, and report per-category breakdown.

**Output:**
```
Memory System: healthy
- Graph Memory: 42 decisions, 0 corrupt, queue depth 3
```

See [Memory Health](references/memory-health.md) for details.

### 5. Build System (NEW)

Verifies plugins/ sync with src/:

```bash
# Checks performed:
# - plugins/ generated from src/
# - Manifest counts match actual files
# - No orphaned skills/agents
```

**Output:**
```
Build System: in sync
- Skills: 67 src/ = 67 plugins/
- Agents: 36 src/ = 36 plugins/
- Last build: 2 minutes ago
```

### 6. Permission Rules

Leverages CC 2.1.3's unreachable permission rules detection:

**Output:**
```
Permission Rules: 12/12 reachable
```

### 7. Schema Compliance

Validates JSON files against schemas:

**Output:**
```
Schemas: 15/15 compliant
```

### 8. Coordination System

Checks multi-worktree coordination health:

**Output:**
```
Coordination: healthy
- Active instances: 1
- Stale locks: 0
```

### 9. Context Budget

Monitors token usage:

**Output:**
```
Context Budget: 1850/2200 tokens (84%)
```

### 10. Claude Code Version

Validates runtime version against the [Version Compatibility Matrix](references/version-compatibility.md):

**Output (OK):**
```
Claude Code: 2.1.47 (OK)
- Minimum required: 2.1.47
- All 15 features available
```

**Output (degraded):**
```
Claude Code: 2.1.44 (DEGRADED)
- Minimum required: 2.1.47
- Missing: last_assistant_message, added_dirs, Windows hooks, worktree discovery
- Upgrade: npm install -g @anthropic-ai/claude-code@latest
```

### 11. External Dependencies

Checks optional tool availability:

```bash
# Checks performed:
# - agent-browser: installed globally via skills CLI
# - Validates symlink exists at ~/.claude/skills/agent-browser
```

**Output:**
```
External Dependencies:
- agent-browser: installed (OK)
```

**Output (not installed):**
```
External Dependencies:
- agent-browser: NOT INSTALLED (optional - install with: npx skills add vercel-labs/agent-browser)
```

### 12. MCP Status

Checks `.mcp.json` entries for enabled/disabled state and validates paid MCPs have their required credentials:

```bash
# Checks performed:
# - Parse .mcp.json, list each server with enabled/disabled state
# - For tavily: check TAVILY_API_KEY env var OR op CLI availability
# - For memory: check MEMORY_FILE path is writable
# - For agentation: check agentation-mcp package is installed (npx --yes dry-run)
# - Flag any enabled MCP whose process would likely fail at startup
```

**Output (healthy):**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- sequential-thinking: disabled ○
- tavily:             disabled ○  (enable: set TAVILY_API_KEY, see /ork:configure)
- agentation:         disabled ○
```

**Output (misconfigured — Tavily enabled but no key):**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- tavily:             enabled  ✗  TAVILY_API_KEY not set — MCP will fail at startup
                                  Fix: set TAVILY_API_KEY or set "disabled": true in .mcp.json
```

**Output (agentation enabled but not installed):**
```
MCP Servers:
- agentation:         enabled  ✗  agentation-mcp package not found
                                  Fix: npm install -D agentation-mcp  or  set "disabled": true
```

## Report Format

> See [references/report-format.md](references/report-format.md) for ASCII report templates (ork and orkl), JSON CI output schema, and exit codes.

## Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| All checks pass | Plugin healthy | None required |
| Skills warning | Invalid frontmatter | Run `npm run test:skills` |
| Agents warning | Invalid frontmatter | Run `npm run test:agents` |
| Hook error | Missing/broken hook | Check hooks.json and bundles |
| Memory warning | Graph unavailable | Check .claude/memory/ directory |
| Build warning | Out of sync | Run `npm run build` |
| Permission warning | Unreachable rules | Review `.claude/settings.json` |

## Troubleshooting

### "Skills validation failed"

```bash
# Run skill structure tests
npm run test:skills
./tests/skills/structure/test-skill-md.sh
```

### "Build out of sync"

```bash
# Rebuild plugins from source
npm run build
```

### "Memory unavailable"

```bash
# Check graph memory
ls -la .claude/memory/
```

## Related Skills

- `ork:configure` - Configure plugin settings
- `ork:quality-gates` - CI/CD integration
- `security-scanning` - Comprehensive audits

## References

- [Skills Validation](references/skills-validation.md)
- [Agents Validation](references/agents-validation.md)
- [Hook Validation](references/hook-validation.md)
- [Memory Health](references/memory-health.md)
- [Permission Rules](references/permission-rules.md)
- [Schema Validation](references/schema-validation.md)
- [Version Compatibility](references/version-compatibility.md)

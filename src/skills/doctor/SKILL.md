---
name: doctor
description: "OrchestKit health diagnostics for health diagnostics. Use when checking plugin health or troubleshooting issues."
context: inherit
version: 3.0.0
author: OrchestKit
tags: [health-check, diagnostics, validation, permissions, hooks, skills, agents, memory]
user-invocable: true
allowedTools: [Bash, Read, Grep, Glob]
skills: [configure]
complexity: low
---

# OrchestKit Health Diagnostics

## Overview

The `/ork:doctor` command performs comprehensive health checks on your OrchestKit installation. It auto-detects installed plugins and validates 10 categories:

1. **Installed Plugins** - Detects orkl or ork
2. **Skills Validation** - Frontmatter, references, token budget (dynamic count)
3. **Agents Validation** - Frontmatter, tool refs, skill refs (dynamic count)
4. **Hook Health** - Registration, bundles, async patterns
5. **Permission Rules** - Detects unreachable rules (CC 2.1.3 feature)
6. **Schema Compliance** - Validates JSON files against schemas
7. **Coordination System** - Checks lock health and registry integrity
8. **Context Budget** - Monitors token usage against budget
9. **Memory System** - Graph, Mem0, Fabric health
10. **Claude Code Version** - Validates CC >= 2.1.16

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
- orkl: 109 skills, 36 agents, 119 hook entries
```

**Output (ork full):**
```
Installed Plugins: 1
- ork: 200 skills, 36 agents, 119 hook entries
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
Skills: 186/186 valid
- User-invocable: 24 commands
- Reference skills: 163
```

**Output (orkl only):**
```
Skills: 18/18 valid
- User-invocable: 0 commands
- Reference skills: 18
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
Agents: 35/35 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

### 3. Hook Health

Verifies hooks are properly configured:

```bash
# Checks performed:
# - hooks.json schema valid
# - Bundle files exist (11 .mjs bundles)
# - Async hooks use fire-and-forget pattern (6 async)
# - Background hook metrics health (Issue #243)
```

**Output:**
```
Hooks: 22/22 entries valid (11 bundles)
- PreToolUse: 8, PostToolUse: 3, PermissionRequest: 3
- Async hooks: 6 (fire-and-forget)
- Error Rate: 0.3%
```

See [Hook Validation](references/hook-validation.md) for details.

### 4. Memory System (NEW)

Validates 3-tier memory architecture with file-level integrity checks:

```bash
# Automated checks:
# - Tier 1 (Graph): .claude/memory/ exists, decisions.jsonl valid JSONL, queue depth
# - Tier 2 (Mem0): MEM0_API_KEY detection, mem0-queue.jsonl depth, last sync
# - Tier 3 (Fabric): Both tiers available, session registry

# Run these commands to gather memory health data:
wc -l .claude/memory/decisions.jsonl 2>/dev/null || echo "No decisions yet"
wc -l .claude/memory/graph-queue.jsonl 2>/dev/null || echo "No graph queue"
wc -l .claude/memory/mem0-queue.jsonl 2>/dev/null || echo "No mem0 queue"
ls -la .claude/memory/ 2>/dev/null || echo "Memory directory missing"
```

Read `.claude/memory/decisions.jsonl` directly to validate JSONL integrity (each line must parse as valid JSON). Count total lines, corrupt lines, and report per-category breakdown.

**Output:**
```
Memory System: healthy
- Graph Memory: 42 decisions, 0 corrupt, queue depth 3
- Mem0 Cloud: available (API key detected), queue depth 0
- Memory Fabric: active (both tiers)
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
- Skills: 186 src/ = 186 plugins/
- Agents: 35 src/ = 35 plugins/
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

Validates runtime version:

**Output:**
```
Claude Code: 2.1.25 (OK)
- Minimum required: 2.1.16
```

## Report Format

**Full ork plugin:**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: 5.4.0  |  CC: 2.1.25  |  Plugins: ork + ork         |
+===================================================================+
| Skills           | 186/186 valid                                  |
| Agents           | 35/35 valid                                    |
| Hooks            | 22/22 entries (11 bundles)                     |
| Memory           | 3/3 tiers healthy                              |
| Permissions      | 12/12 reachable                                |
| Schemas          | 15/15 compliant                                |
| Context          | 1850/2200 tokens (84%)                         |
| Coordination     | 0 stale locks                                  |
| CC Version       | 2.1.25 (OK)                                    |
+===================================================================+
| Status: HEALTHY (9/9 checks passed)                               |
+===================================================================+
```

**Domain-specific plugins (e.g., orkl + orkl):**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: 5.4.0  |  CC: 2.1.25  |  Plugins: 3 installed            |
+===================================================================+
| Installed        | ork, orkl, orkl       |
| Skills           | 38/38 valid (combined)                         |
| Agents           | 2/2 valid                                      |
| Hooks            | 22/22 entries (via ork)                   |
| Memory           | 1/3 tiers (graph only)                         |
+===================================================================+
```

## JSON Output (CI Integration)

```bash
/ork:doctor --json
```

```json
{
  "version": "5.4.0",
  "claudeCode": "2.1.25",
  "status": "healthy",
  "plugins": {
    "installed": ["ork", "ork"],
    "count": 2
  },
  "checks": {
    "skills": {"passed": true, "count": 186, "perPlugin": {"ork": 186}},
    "agents": {"passed": true, "count": 35, "perPlugin": {"ork": 35}},
    "hooks": {"passed": true, "entries": 22, "bundles": 11, "source": "ork"},
    "memory": {"passed": true, "tiers": 3, "available": ["graph", "mem0", "fabric"]},
    "permissions": {"passed": true, "count": 12},
    "schemas": {"passed": true, "count": 15},
    "context": {"passed": true, "usage": 0.84},
    "coordination": {"passed": true, "staleLocks": 0},
    "ccVersion": {"passed": true, "version": "2.1.25"}
  },
  "exitCode": 0
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks pass |
| 1 | One or more checks failed |

## Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| All checks pass | Plugin healthy | None required |
| Skills warning | Invalid frontmatter | Run `npm run test:skills` |
| Agents warning | Invalid frontmatter | Run `npm run test:agents` |
| Hook error | Missing/broken hook | Check hooks.json and bundles |
| Memory warning | Tier unavailable | Check .claude/memory/ or MEM0_API_KEY |
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

### "Memory tier unavailable"

```bash
# Check graph memory
ls -la .claude/memory/

# Check Mem0 (optional)
echo $MEM0_API_KEY
```

## Related Skills

- `configure` - Configure plugin settings
- `quality-gates` - CI/CD integration
- `security-scanning` - Comprehensive audits

## References

- [Skills Validation](references/skills-validation.md)
- [Agents Validation](references/agents-validation.md)
- [Hook Validation](references/hook-validation.md)
- [Memory Health](references/memory-health.md)
- [Permission Rules](references/permission-rules.md)
- [Schema Validation](references/schema-validation.md)

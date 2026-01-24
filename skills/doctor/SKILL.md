---
name: doctor
description: OrchestKit health diagnostics command that validates plugin configuration and reports issues. Use when running doctor checks or troubleshooting plugin health.
context: inherit
version: 2.0.0
author: OrchestKit
tags: [health-check, diagnostics, validation, permissions, hooks]
user-invocable: true
allowedTools: [Bash, Read, Grep, Glob]
skills: [configure]
---

# OrchestKit Health Diagnostics

## Overview

The `/ork:doctor` command performs comprehensive health checks on your OrchestKit installation. It validates:

1. **Permission Rules** - Detects unreachable rules (CC 2.1.3 feature)
2. **Hook Health** - Verifies executability and references
3. **Schema Compliance** - Validates JSON files against schemas
4. **Coordination System** - Checks lock health and registry integrity
5. **Context Budget** - Monitors token usage against budget
6. **Claude Code Version** - Validates CC >= 2.1.16 for full feature support

## Overview

- After installing or updating OrchestKit
- When hooks aren't firing as expected
- When permission rules seem to have no effect
- Before deploying to a team environment
- When debugging coordination issues

## Quick Start

```bash
/ork:doctor
```

## Health Check Categories

### 1. Permission Rules Analysis

Leverages CC 2.1.3's unreachable permission rules detection:

```bash
# Checks performed:
# - Rules that can never match (unreachable patterns)
# - Overlapping rules where one shadows another
# - Invalid matcher syntax
# - Missing required fields
```

**Output:**
```
Permission Rules: 12/12 reachable
- auto-approve-safe-bash (TypeScript): OK
- auto-approve-safe-bash.sh: OK (3 patterns)
- auto-approve-project-writes.sh: OK
```

### 2. Hook Validation

Verifies all 93 hooks are properly configured:

```bash
# Checks performed:
# - chmod +x (executable permission)
# - Shebang line present (#!/usr/bin/env bash)
# - Dispatcher references valid
# - Matcher patterns syntax correct
# - No missing hook files referenced in settings.json
```

**Output:**
```
Hooks: 147/147 valid
- pretool/bash/git-branch-protection.sh: executable, 73 lines
- posttool/audit-logger.sh: executable, 89 lines
- stop/context-compressor.sh: executable, 207 lines
```

### 3. Schema Compliance

Validates JSON files against schemas in `.claude/schemas/`:

```bash
# Files validated:
# - plugin.json against plugin.schema.json
# - All SKILL.md files
# - context/*.json files
# - coordination/*.json files
```

**Output:**
```
Schemas: 15/15 compliant
- plugin.json: valid
- skills/*/SKILL.md: 79/79 valid
- context/session/state.json: valid
```

### 4. Coordination System

Checks multi-worktree coordination health:

```bash
# Checks performed:
# - work-registry.json integrity
# - decision-log.json structure
# - Stale locks (expired > 60s)
# - Heartbeat status
```

**Output:**
```
Coordination: healthy
- Active instances: 1
- Stale locks: 0
- Decision log entries: 42
```

### 5. Context Budget

Monitors token usage against the 2200 token budget:

```bash
# Calculations:
# - identity.json tokens
# - session/state.json tokens
# - knowledge/*.json tokens
# - Active skill context tokens
```

**Output:**
```
Context Budget: 1850/2200 tokens (84%)
- identity.json: 200 tokens
- session/state.json: 450 tokens
- knowledge/: 1200 tokens
```

### 6. Claude Code Version

Validates runtime Claude Code version meets minimum requirements:

```bash
# Checks performed:
# - Runtime version >= 2.1.16 (minimum for OrchestKit 5.x)
# - Feature availability detection (Task tools, VSCode plugins)
# - Upgrade guidance for older versions
```

**Output:**
```
Claude Code Version: 2.1.16 (OK)
- Task Management: available (TaskCreate, TaskUpdate, TaskGet, TaskList)
- VSCode Plugins: available
- Engine requirement: >=2.1.16 (satisfied)
```

**Upgrade guidance (if older version):**
```
Claude Code Version: 2.1.14 (OUTDATED)
- Missing features: Task Management, VSCode native plugins
- Upgrade: Run 'claude update' or reinstall from https://claude.ai/download
- Some OrchestKit features may not work correctly
```

## Report Format

```
+==================================================================+
|                    OrchestKit Health Report                       |
+==================================================================+
| Version: 5.0.0  |  CC: 2.1.16  |  Channel: stable                |
+==================================================================+
| Permission Rules     | 12/12 reachable                           |
| Hooks                | 93/93 valid                               |
| Schemas              | 15/15 compliant                           |
| Context Budget       | 1850/2200 tokens (84%)                    |
| Coordination         | 0 stale locks                             |
| CC Version           | 2.1.16 (OK)                               |
+==================================================================+
```

## Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| All checks pass | Plugin healthy | None required |
| Permission warning | Unreachable rules | Review `.claude/settings.json` |
| Hook error | Missing/broken hook | Check file permissions and paths |
| Schema error | Invalid JSON | Run schema validation script |
| Budget warning | >80% context used | Review loaded skills |
| Coordination error | Stale locks | Run cleanup script |
| CC version warning | Outdated Claude Code | Run `claude update` to upgrade |

## Troubleshooting

### "Permission rule unreachable"

```bash
# Check if a more specific rule shadows this one
# Example: "*.md" shadowed by "README.md"
cat .claude/settings.json | jq '.permissions'
```

### "Hook not executable"

```bash
# Fix permissions
chmod +x .claude/hooks/path/to/hook.sh
```

### "Context budget exceeded"

```bash
# Check which skills are loaded
# Use progressive loading - don't load entire skill directories
```

## Integration

This skill works with:
- `quality-gates` - For CI/CD integration
- `security-scanning` - For comprehensive audits


## Related Skills
- configure: Configure plugin settings
## References

- [Permission Rules](references/permission-rules.md)
- [Hook Validation](references/hook-validation.md)
- [Schema Validation](references/schema-validation.md)
# Agents Validation

## Overview

OrchestKit includes 38 specialized agents validated against CC 2.1.59 frontmatter format.

## Agent Structure

```
src/agents/
├── backend-system-architect.md
├── code-quality-reviewer.md
├── frontend-ui-developer.md
└── ... (38 total)
```

## Validation Checks

### 1. Frontmatter Fields

Required fields:
- `name` - Agent identifier (used in Task subagent_type)
- `description` - Purpose and auto-mode keywords
- `model` - opus, sonnet, or haiku
- `tools` - Array of allowed CC tools
- `skills` - Array of skill names to auto-inject

Optional fields:
- `context` - fork or inherit
- `color` - Display color
- `hooks` - Agent-specific hooks

### 2. Model Validation

Only valid models:

```bash
# Check model values
grep "^model:" src/agents/*.md | sort | uniq -c
```

Expected: opus, sonnet, haiku

### 3. Skills References

All skills in agent frontmatter must exist:

```bash
# Check skill references
for agent in src/agents/*.md; do
  grep -A100 "^skills:" "$agent" | grep "^  - " | \
    sed 's/.*- //' | while read skill; do
      [ -d "src/skills/$skill" ] || echo "Missing: $agent -> $skill"
    done
done
```

### 4. Tools Validation

Valid CC tools:
- Bash, Read, Write, Edit, MultiEdit
- Grep, Glob
- Task, Skill
- WebFetch, WebSearch
- NotebookEdit
- AskUserQuestion
- TaskCreate, TaskUpdate, TaskGet, TaskList

## Quick Validation

```bash
# Run full agent validation
npm run test:agents

# Or directly
./tests/agents/test-agent-frontmatter.sh
```

## Common Issues

### Invalid model

```yaml
model: sonnet  # Valid: opus, sonnet, haiku
```

### Missing skill reference

Ensure skill exists in `src/skills/` directory.

### Invalid tool name

Check tool spelling matches CC tool names exactly.

## Agent Registration Check (CC 2.1.50+)

Run `claude agents` to list all registered agents and compare against the expected count from manifests.

**Gate:** Only run if CC >= 2.1.50 (feature: `claude_agents_cli`). Skip with a note if version is older.

```bash
# Check registered agent count matches expected
expected_count=$(grep -c '"agents/' manifests/ork.json 2>/dev/null || echo 0)
registered_count=$(claude agents 2>/dev/null | wc -l | tr -d ' ')

if [ "$registered_count" -ne "$expected_count" ]; then
  echo "WARN: Agent count mismatch — expected $expected_count, got $registered_count"
  # List missing agents for investigation
  claude agents 2>/dev/null | sort > /tmp/ork-registered.txt
  ls src/agents/*.md 2>/dev/null | xargs -I{} basename {} .md | sort > /tmp/ork-expected.txt
  echo "Missing agents:"
  comm -23 /tmp/ork-expected.txt /tmp/ork-registered.txt
fi
```

**Check:** `claude agents | wc -l` should match expected agent count (38).

## Model Routing

See [docs/model-routing.md](../../../../docs/model-routing.md) for per-agent model assignment rationale and version history.

**Fail action:** List missing agents for manual investigation. Common causes:
- Plugin not installed or not rebuilt after adding agents
- Agent frontmatter parse error preventing registration
- CC version too old (< 2.1.50) to support `claude agents` CLI

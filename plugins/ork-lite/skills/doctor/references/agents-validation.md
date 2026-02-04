# Agents Validation

## Overview

OrchestKit includes 35 specialized agents validated against CC 2.1.6 frontmatter format.

## Agent Structure

```
src/agents/
├── backend-system-architect.md
├── code-quality-reviewer.md
├── frontend-ui-developer.md
└── ... (35 total)
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

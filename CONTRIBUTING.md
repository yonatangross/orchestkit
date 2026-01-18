# Contributing to SkillForge Plugin

Welcome to the SkillForge plugin for Claude Code! We're excited that you're interested in contributing. This plugin extends Claude Code with specialized skills, agents, and hooks for AI-native development workflows.

## How to Contribute

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/skillforge-claude-plugin.git
   cd skillforge-claude-plugin
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or for issues:
   git checkout -b issue/123-description
   ```
4. **Make your changes** following the guidelines below
5. **Test your changes** thoroughly
6. **Submit a Pull Request** to the `main` branch

### Branch Naming Convention

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation updates

## Project Structure

```
.claude/
├── skills/               # 111 skills in flat CC 2.1.7 structure
│   └── <skill-name>/
│       ├── SKILL.md           # Required: Patterns and best practices
│       ├── references/        # Optional: Specific implementations
│       └── templates/         # Optional: Code generation
├── agents/               # 25 specialized AI personas
└── context/              # Session and knowledge management
hooks/                    # Lifecycle hooks
```

## Adding New Skills (CC 2.1.7)

Skills use the CC 2.1.7 native flat structure with SKILL.md as the only required file.

### 1. Create Skill Directory

```bash
mkdir -p skills/your-skill-name/references
```

### 2. Create SKILL.md (Required)

Create `skills/your-skill-name/SKILL.md`:

```markdown
---
name: your-skill-name
description: Brief description for skill discovery
tags: [keyword1, keyword2, keyword3]
---

# Your Skill Name

Brief description of what this skill provides.

## When to Use

- Use case 1
- Use case 2

## Key Patterns

### Pattern 1
Explanation and code example.

### Pattern 2
Explanation and code example.

## Best Practices

- Practice 1
- Practice 2

## Anti-Patterns

- What NOT to do
```

### 3. Add References (Optional)

Create specific implementation guides in `references/`:
- `implementation-guide.md`
- `advanced-patterns.md`

### 4. Add Templates (Optional)

Create code templates in `templates/`:
- `component-template.py`
- `test-template.py`

### 5. Validate

```bash
./tests/skills/structure/test-skill-md.sh
```

## Adding New Agents

Agents are specialized AI personas defined in markdown.

### Create Agent File

Create `agents/your-agent.md`:

```markdown
# Your Agent Name

## Role
Brief description of the agent's specialized role.

## Capabilities
- Capability 1
- Capability 2

## Tools Available
- Tool 1
- Tool 2

## Workflow
How the agent approaches tasks.

## Success Criteria
What constitutes successful completion.

## Model Preference
haiku | sonnet | opus
```

### Register in plugin.json

Add to the `agents` array in `plugin.json`.

## Adding New Hooks

Hooks provide lifecycle automation for Claude Code.

### Hook Requirements

1. **Shebang and strict mode**:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ```

2. **CC 2.1.6 JSON output** (for pretool hooks):
   ```bash
   echo '{"continue": true, "suppressOutput": true}'
   exit 0
   ```

3. **Source common utilities** (if needed):
   ```bash
   source "$(dirname "$0")/../_lib/common.sh"
   ```

### Hook Categories

| Directory | Purpose |
|-----------|---------|
| `pretool/` | Validate before tool execution |
| `posttool/` | Act after tool execution |
| `permission/` | Auto-approve safe operations |
| `lifecycle/` | Session start/end |
| `stop/` | Conversation end handlers |

### Register Hook

Add to `.claude/settings.json` under appropriate matcher.

### Test Hook

```bash
# Syntax check
bash -n hooks/your-hook.sh

# Full test suite
./tests/unit/test-shell-syntax.sh
```

## Security Guidelines

### Required Practices

- Always use `set -euo pipefail`
- Quote all variables: `"${var}"`
- Validate file paths before operations
- Use `jq --arg` for JSON variable interpolation

### Prohibited Patterns

- **No `eval`** - Never use dynamic execution
- **No network calls** in hooks
- **No secrets** in skill files
- **No `--no-verify`** on git commands

## Testing

### Run All Tests

```bash
./tests/run-all-tests.sh
```

### Individual Test Suites

```bash
# Shell syntax
./tests/unit/test-shell-syntax.sh

# Schema validation
./tests/schemas/validate-all.sh

# Security tests
./tests/security/run-security-tests.sh

# Component counts
./bin/validate-counts.sh
```

### Before Submitting

- [ ] New skills have `SKILL.md` with valid frontmatter
- [ ] All tests pass locally
- [ ] Hook scripts output valid JSON
- [ ] No security violations
- [ ] CHANGELOG.md updated

## Questions?

1. Check existing issues and discussions
2. Open a new discussion for general questions
3. Open an issue for bug reports or feature requests

Thank you for contributing to SkillForge!
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
├── skills/           # 90 skills (78 knowledge + 12 commands)
│   └── skill-name/
│       ├── capabilities.json   # Tier 1: Discovery metadata
│       ├── SKILL.md           # Tier 2: Patterns and best practices
│       ├── references/        # Tier 3: Specific implementations
│       └── templates/         # Tier 4: Code generation
├── agents/           # 20 specialized AI personas
├── hooks/            # 96 lifecycle hooks
└── context/          # Session and knowledge management
```

## Adding New Skills

Skills follow a 4-tier progressive loading structure.

### 1. Create Skill Directory

```bash
mkdir -p skills/your-skill-name/references
```

### 2. Create capabilities.json (Tier 1 - Required)

```json
{
  "id": "your-skill-name",
  "name": "Your Skill Name",
  "version": "1.0.0",
  "description": "Brief description for skill discovery",
  "category": "backend",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "triggers": {
    "keywords": ["trigger1", "trigger2"],
    "file_patterns": ["*.py", "*.ts"],
    "context_signals": ["when user asks about X"]
  },
  "token_budget": {
    "tier1_discovery": 100,
    "tier2_overview": 500,
    "tier3_specific": 300,
    "tier4_templates": 200
  }
}
```

**Categories**: `ai`, `backend`, `frontend`, `testing`, `security`, `devops`, `workflow`

### 3. Create SKILL.md (Tier 2 - Required)

```markdown
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

### 4. Add References (Tier 3 - Optional)

Create specific implementation guides in `references/`:
- `implementation-guide.md`
- `advanced-patterns.md`

### 5. Add Templates (Tier 4 - Optional)

Create code templates in `templates/`:
- `component-template.py`
- `test-template.py`

### 6. Register in plugin.json

Add to the `skills` array in `plugin.json`:

```json
{
  "path": "skills/your-skill-name",
  "tags": ["keyword1", "keyword2"],
  "description": "Brief description"
}
```

### 7. Validate

```bash
./bin/validate-skill.sh skills/your-skill-name
./tests/schemas/validate-all.sh
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

- [ ] New skills have `capabilities.json` and `SKILL.md`
- [ ] All tests pass locally
- [ ] Hook scripts output valid JSON
- [ ] No security violations
- [ ] CHANGELOG.md updated

## Questions?

1. Check existing issues and discussions
2. Open a new discussion for general questions
3. Open an issue for bug reports or feature requests

Thank you for contributing to SkillForge!
# SkillForge Plugin Installation

## Quick Start

### From Marketplace

```bash
# Step 1: Add the marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin

# Step 2: Install (choose one)
/plugin install skillforge-complete@complete         # Everything (61 skills)
/plugin install skillforge-complete@ai-development   # AI/LLM skills (23 skills)
/plugin install skillforge-complete@backend          # Backend skills (5 skills)
/plugin install skillforge-complete@frontend         # Frontend skills (6 skills)
/plugin install skillforge-complete@quality-testing  # Testing skills (14 skills)
/plugin install skillforge-complete@devops-security  # DevOps skills (7 skills)
/plugin install skillforge-complete@process-planning # Planning skills (6 skills)
```

### From GitHub

```bash
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge
```

## Plugin Bundles

| Bundle | Skills | Description |
|--------|--------|-------------|
| `complete` | 61 | Full toolkit with agents, commands, hooks |
| `ai-development` | 23 | RAG, embeddings, LangGraph, caching |
| `backend` | 5 | APIs, databases, streaming, resilience |
| `frontend` | 6 | React 19, RSC, animations, edge |
| `quality-testing` | 14 | Unit, E2E, mocking, golden datasets |
| `devops-security` | 7 | CI/CD, observability, OWASP, auth |
| `process-planning` | 6 | Brainstorming, ADRs, GitHub CLI |

## Features

- **Progressive Loading**: Skills use `capabilities.json` for token-efficient discovery
- **20 Specialized Agents**: Product thinking + technical implementation
- **11 Commands**: `/commit`, `/implement`, `/review-pr`, etc.
- **29 Hooks**: Safety, auditing, auto-approval

## More Information

See the main [README.md](../README.md) for full documentation.

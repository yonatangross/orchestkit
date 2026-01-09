# SkillForge Plugin Installation

> **Marketplace Status:** Pending approval at [Anthropic Official](https://github.com/anthropics/claude-plugins-official/pull/86) and [CC Marketplace](https://github.com/ananddtyagi/cc-marketplace/pull/24)

## Quick Start

### Manual Installation (Works Now)

```bash
# Clone to plugins directory
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge

# Or copy to your project
cp -r skillforge-claude-plugin/.claude your-project/.claude
```

### From Marketplace (After Approval)

Once PRs are merged, these commands will work:

```bash
# Add the marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin

# Install (choose one)
/plugin install skillforge-complete@complete         # Everything (72 skills)
/plugin install skillforge-complete@ai-development   # AI/LLM skills (23 skills)
/plugin install skillforge-complete@backend          # Backend skills (12 skills)
/plugin install skillforge-complete@frontend         # Frontend skills (6 skills)
/plugin install skillforge-complete@quality-testing  # Testing skills (14 skills)
/plugin install skillforge-complete@devops-security  # DevOps skills (7 skills)
/plugin install skillforge-complete@process-planning # Planning skills (6 skills)
```

## Plugin Bundles

| Bundle | Skills | Description |
|--------|--------|-------------|
| `complete` | 72 | Full toolkit with 20 agents, 11 commands, 89 hooks |
| `ai-development` | 23 | RAG, embeddings, LangGraph, caching |
| `backend` | 12 | APIs, databases, streaming, resilience |
| `frontend` | 6 | React 19, RSC, animations, edge |
| `quality-testing` | 14 | Unit, E2E, mocking, golden datasets |
| `devops-security` | 7 | CI/CD, observability, OWASP, auth |
| `process-planning` | 6 | Brainstorming, ADRs, GitHub CLI |

## Features

- **72 Skills**: Progressive loading with `capabilities.json` for token-efficient discovery
- **20 Specialized Agents**: Product thinking (6) + technical implementation (14)
- **11 Commands**: `/commit`, `/implement`, `/review-pr`, `/explore`, etc.
- **89 Hooks**: Safety, auditing, auto-approval, quality gates

## More Information

See the main [README.md](../README.md) for full documentation.
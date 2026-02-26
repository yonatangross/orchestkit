<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# OrchestKit

### Stop explaining your stack. Start shipping.

**69 skills · 38 agents · 78 hooks**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.56-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/yonatangross/orchestkit?style=for-the-badge&logo=github)](https://github.com/yonatangross/orchestkit)

</div>

---

<p align="center">
  <a href="https://orchestkit.vercel.app/"><strong>Explore the Docs →</strong></a><br>
  <sub>Skill browser, demo gallery, setup wizard</sub>
</p>

---

## Quick Start

```bash
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
/ork:setup
```

**That's it.** The setup wizard scans your codebase, recommends skills for your stack, and creates a personalized improvement plan.

---

## Why OrchestKit?

Every Claude Code session starts from zero. You explain your stack, patterns, preferences—again and again.

OrchestKit gives Claude **persistent knowledge** of production patterns that work automatically:

| Without | With OrchestKit |
|---------|-----------------|
| "Use FastAPI with async SQLAlchemy 2.0..." | "Create an API endpoint" → Done right |
| "Remember cursor pagination, not offset..." | Agents know your patterns |
| "Don't commit to main branch..." | Hooks block bad commits |
| "Run tests before committing..." | `/ork:commit` runs tests for you |

---

## What You Get

| Component | Count | Examples |
|-----------|-------|----------|
| **Skills** | 68 | RAG patterns, FastAPI, React 19, testing, security |
| **Agents** | 38 | backend-architect, frontend-dev, security-auditor |
| **Hooks** | 78 | Pre-commit checks, git protection, quality gates |

Skills load on-demand — zero overhead. Hooks protect automatically. Agents route by task.

**[Browse everything in the Docs →](https://orchestkit.vercel.app/docs/skills/overview)**

---

## Key Commands

```bash
/ork:setup        # Personalized onboarding wizard
/ork:implement    # Full-stack implementation with parallel agents
/ork:verify       # Multi-agent validation
/ork:commit       # Conventional commit with pre-checks
/ork:explore      # Analyze unfamiliar codebase
/ork:remember     # Save to persistent memory
/ork:doctor       # Health check
```

---

## Configuration

```bash
/ork:configure
```

### Recommended MCP Servers

| Server | Purpose | Required? |
|--------|---------|-----------|
| Context7 | Up-to-date library docs | Recommended |
| Memory | Knowledge graph persistence | Recommended |
| Sequential Thinking | Structured reasoning for subagents | Optional |
| Tavily | Web search and extraction | Optional |

The setup wizard (`/ork:setup`) will recommend MCPs based on your stack.

---

## FAQ

<details>
<summary><strong>Plugin not found?</strong></summary>

```bash
/plugin list
/plugin uninstall ork && /plugin install ork
```
</details>

<details>
<summary><strong>Hooks not firing?</strong></summary>

Run `/ork:doctor` to diagnose.
</details>

<details>
<summary><strong>Claude Code version?</strong></summary>

Requires **≥2.1.56**. Check with `claude --version`.
</details>

<details>
<summary><strong>Migrating from orkl or ork-creative?</strong></summary>

Both names still work as aliases. Just run `/plugin install ork` — you get everything.
</details>

---

## Development

```bash
npm run build      # Build plugins from src/
npm test           # Run all tests
```

Edit `src/` and `manifests/`, never `plugins/` (generated).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## What's New

**v7.0.0** — Single Plugin + Setup Wizard

- **Breaking**: Collapsed 3 plugins into 1. `orkl` and `ork-creative` are now aliases for `ork`.
- **New**: `/ork:setup` — personalized onboarding wizard (scan, stack detection, skill recommendations, MCP setup, readiness score)
- All 69 skills, 38 agents, 78 hooks in one install. Zero overhead — skills load on-demand.

[Full Changelog →](./CHANGELOG.md)

---

<div align="center">

**[Docs](https://orchestkit.vercel.app/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>

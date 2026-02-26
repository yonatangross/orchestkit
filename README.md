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
```

Then start your personalized onboarding:

```bash
/ork:setup
```

The setup wizard scans your codebase, detects your tech stack, recommends skills for your needs, configures MCP servers, and creates a readiness score — all in one command.

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

**One unified plugin, everything included.**

| Component | Details |
|-----------|---------|
| **69 Skills** | RAG patterns, FastAPI, React 19, testing, security, database design, ML integration — loaded on-demand, zero overhead |
| **38 Agents** | Specialized personas (backend-architect, frontend-dev, security-auditor) — route tasks to the right expert |
| **78 Hooks** | Pre-commit checks, git protection, quality gates — ship with confidence |

All available in a single `/plugin install ork`. Skills load on-demand. Hooks work automatically.

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

## Plugin Names — All the Same Thing

**orkl**, **ork-creative**, and **ork** are identical. They're all aliases for the same complete toolkit.

- Old `orkl` users: Just install `ork`
- Old `ork-creative` users: No separate video skills — everything is in `ork`
- New users: Install `ork` once, get all 69 skills, 38 agents, 78 hooks

```bash
/plugin install ork
```

No tiering. No version confusion. Just one powerful plugin.

---

## Release Channels

| Channel | Stability | Install |
|---------|-----------|---------|
| **Stable** | Production-ready | `/plugin install ork` |
| **Beta** | May have rough edges | See below |
| **Alpha** | Experimental, may break | See below |

To install beta or alpha:

```bash
# Beta channel
/plugin marketplace add yonatangross/orchestkit --ref beta --name orchestkit-beta
/plugin install ork@orchestkit-beta

# Alpha channel
/plugin marketplace add yonatangross/orchestkit --ref alpha --name orchestkit-alpha
/plugin install ork@orchestkit-alpha
```

Run `/ork:doctor` to check which channel you're on. [Full docs](https://orchestkit.vercel.app/docs/getting-started/release-channels).

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

---

## Development

```bash
npm run build      # Build plugins from src/
npm test           # Run all tests
```

Edit `src/` and `manifests/`, never `plugins/` (generated).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## What's New in v7

**v7.0.0** — Unified Plugin Architecture

- **Simplified**: One plugin for everything. No more orkl vs ork-creative confusion. All 69 skills, 38 agents, 78 hooks in `/plugin install ork`.
- **Setup Wizard**: Run `/ork:setup` for personalized onboarding — stack detection, skill recommendations, MCP configuration, readiness scoring.
- **Zero Overhead**: Skills load on-demand. Hooks activate automatically. No performance penalty.

[Full Changelog →](./CHANGELOG.md)

---

<div align="center">

**[Docs](https://orchestkit.vercel.app/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>

<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# OrchestKit

### Stop explaining your stack. Start shipping.

**199 skills · 36 agents · 119 hooks · 2 plugins**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.33-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/yonatangross/orchestkit?style=for-the-badge&logo=github)](https://github.com/yonatangross/orchestkit)

</div>

---

<p align="center">
  <a href="https://orchestkit.vercel.app/">
    <img src="docs/assets/playground-demo.gif" alt="OrchestKit Playgrounds Demo" width="700">
  </a>
  <br>
  <a href="https://orchestkit.vercel.app/"><strong>🎮 Explore the Playgrounds →</strong></a><br>
  <sub>Interactive marketplace, demo gallery, setup wizard</sub>
</p>

---

## Quick Start

```bash
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
/ork:doctor
```

**That's it.** Skills auto-activate. Hooks protect automatically.

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
| **Skills** | 199 | RAG patterns, FastAPI, React 19, testing, security |
| **Agents** | 36 | backend-architect, frontend-dev, security-auditor |
| **Hooks** | 120 | Pre-commit checks, git protection, quality gates |
| **Plugins** | 2 | `orkl` (universal) or `ork` (full specialized) |

**[Browse everything in the Playgrounds →](https://orchestkit.vercel.app/marketplace-explorer.html)**

---

## Key Commands

```bash
/ork:implement    # Full-stack implementation with parallel agents
/ork:verify       # 6 agents validate your feature
/ork:commit       # Conventional commit with pre-checks
/ork:explore      # Analyze unfamiliar codebase
/ork:remember     # Save to persistent memory
/ork:doctor       # Health check
```

---

## Install Options

```bash
# Universal toolkit (works for any stack)
/plugin install orkl

# Full toolkit (adds Python, React, LLM/RAG specializations)
/plugin install ork
```

**orkl** (109 skills) — All workflows, agents, hooks. Architecture, security, product, accessibility, video, memory.

**ork** (199 skills) — Everything in lite + Python (FastAPI, SQLAlchemy), React (RSC, TanStack), LLM/RAG, LangGraph, MCP.

---

## Configuration

### Optional MCP Servers

```bash
/ork:configure
```

| Server | Purpose |
|--------|---------|
| Context7 | Up-to-date library docs |
| Memory | Knowledge graph |
| Mem0 | Semantic search (needs API key) |

### Environment

```bash
CLAUDE_PROJECT_DIR    # Your project
MEM0_API_KEY          # Optional: Mem0 cloud
```

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

Requires **≥2.1.33**. Check with `claude --version`.
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

**v6.0.0** — Two-tier plugin architecture

- **Breaking**: Simplified from 26 plugins to 2 (`orkl` and `ork`)
- `orkl` (109 skills) — Universal toolkit, all workflows work out of the box
- `ork` (199 skills) — Full specialized with Python, React, LLM/RAG patterns
- All 36 agents and 119 hooks included in both plugins

[Full Changelog →](./CHANGELOG.md)

---

<div align="center">

**[Playgrounds](https://orchestkit.vercel.app/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>

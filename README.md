<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# OrchestKit

### Stop explaining your stack. Start shipping.

**67 skills · 37 agents · 81 hooks · 3 plugins**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.49-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
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
| **Skills** | 67 | RAG patterns, FastAPI, React 19, testing, security |
| **Agents** | 37 | backend-architect, frontend-dev, security-auditor |
| **Hooks** | 81 | Pre-commit checks, git protection, quality gates |
| **Plugins** | 3 | `orkl` (universal), `ork-creative` (video), `ork` (full) |

**[Browse everything in the Docs →](https://orchestkit.vercel.app/docs/skills/overview)**

---

## Key Commands

```bash
/ork:implement    # Full-stack implementation with parallel agents
/ork:verify       # 36 agents validate your feature
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

**orkl** (46 skills) — All workflows, agents, hooks. Architecture, security, product, accessibility, memory.

**ork-creative** (2 skills) — Video production add-on. Demo recording, Remotion, storyboarding, content creation.

**ork** (67 skills) — Everything in lite + creative + Python (FastAPI, SQLAlchemy), React (RSC, TanStack), LLM/RAG, LangGraph, MCP.

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

### Environment

```bash
CLAUDE_PROJECT_DIR    # Your project
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

Requires **≥2.1.49**. Check with `claude --version`.
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

**v6.0.0** — Three-tier plugin architecture

- **Breaking**: Simplified from 26 plugins to 3 (`orkl`, `ork-creative`, and `ork`)
- `orkl` (46 skills) — Universal toolkit, all workflows work out of the box
- `ork-creative` (2 skills) — Video production add-on for demo recording and content creation
- `ork` (67 skills) — Full specialized with Python, React, LLM/RAG patterns
- All 37 agents and 81 hooks included in orkl and ork

[Full Changelog →](./CHANGELOG.md)

---

<div align="center">

**[Docs](https://orchestkit.vercel.app/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>

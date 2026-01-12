---
name: implement
description: Full-power feature implementation with parallel subagents, skills, and MCPs
context: fork
version: 1.0.0
author: SkillForge
tags: [implementation, feature, full-stack, parallel-agents]
---

# Implement Feature

Maximum utilization of parallel subagent execution for feature implementation.

## When to Use

- Building new features
- Full-stack development
- Complex implementations requiring multiple specialists
- AI/ML integrations

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```

## Phase 1: Discovery & Planning

### 1a. Create Task List

Break into small, deliverable, testable tasks:
- Each task completable in one focused session
- Each task MUST include its tests
- Group by domain (frontend, backend, AI, shared)

### 1b. Research Current Best Practices

```python
# PARALLEL - Web searches
WebSearch("React 19 best practices 2025")
WebSearch("FastAPI async patterns 2025")
WebSearch("TypeScript 5.x strict mode 2025")
```

### 1c. Context7 Documentation

```python
# PARALLEL - Library docs
mcp__context7__get-library-docs(libraryId="/facebook/react", topic="hooks")
mcp__context7__get-library-docs(libraryId="/tiangolo/fastapi", topic="dependencies")
```

## Phase 2: Load Skills

```python
# PARALLEL - Load capability indexes first
Read(".claude/skills/api-design-framework/capabilities.json")
Read(".claude/skills/react-server-components-framework/capabilities.json")
Read(".claude/skills/type-safety-validation/capabilities.json")
Read(".claude/skills/testing-strategy-builder/capabilities.json")
```

Then load ONLY specific references needed based on feature type.

## Phase 3: Parallel Architecture Design (5 Agents)

| Agent | Focus |
|-------|-------|
| Plan | Architecture planning, dependency graph |
| backend-system-architect | API, services, database |
| frontend-ui-developer | Components, state, hooks |
| ai-ml-engineer | LLM integration (if needed) |
| ux-researcher | User experience, accessibility |

All 5 agents run in ONE message, then synthesize into unified plan.

## Phase 4: Parallel Implementation (8 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect #1 | API endpoints |
| backend-system-architect #2 | Database layer |
| frontend-ui-developer #1 | UI components |
| frontend-ui-developer #2 | State & API hooks |
| ai-ml-engineer | AI integration |
| rapid-ui-designer | Styling |
| code-quality-reviewer #1 | Test suite |
| sprint-prioritizer | Progress tracking |

## Phase 5: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| code-quality-reviewer #2 | Security audit |

## Phase 6: E2E Verification

If UI changes, verify with Playwright MCP:

```python
mcp__playwright__browser_navigate(url="http://localhost:5173")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_take_screenshot(filename="feature.png")
```

## Phase 7: Documentation

Save implementation decisions to memory MCP for future reference.

## Summary

**Total Parallel Agents: 17 across 4 phases**

**MCPs Used:**
- sequential-thinking (complex reasoning)
- context7 (library documentation)
- memory (decision persistence)
- playwright (E2E verification)

**Key Principles:**
- Tests are NOT optional
- Parallel when independent
- Progressive skill loading
- Evidence-based completion

## References

- [Agent Phases](references/agent-phases.md)
---
name: implement
description: Full-power feature implementation with parallel subagents, skills, and MCPs. Use when implementing features, building features, creating features, or developing features.
context: fork
version: 1.1.0
author: SkillForge
tags: [implementation, feature, full-stack, parallel-agents]
user-invocable: true
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
# PARALLEL - Web searches (launch all in ONE message)
WebSearch("React 19 best practices 2026")
WebSearch("FastAPI async patterns 2026")
WebSearch("TypeScript 5.x strict mode 2026")
```

### 1c. Context7 Documentation

```python
# PARALLEL - Library docs (launch all in ONE message)
mcp__context7__query-docs(libraryId="/vercel/next.js", query="app router")
mcp__context7__query-docs(libraryId="/tiangolo/fastapi", query="dependencies")
```

## Phase 2: Skills Auto-Loading (CC 2.1.6)

**CC 2.1.6 auto-discovers skills** - no manual loading needed!

Relevant skills activated automatically based on task:
- `api-design-framework` - REST/GraphQL patterns
- `react-server-components-framework` - RSC, Server Actions
- `type-safety-validation` - Zod, tRPC, Prisma
- `unit-testing` / `integration-testing` - Test patterns

## Phase 3: Parallel Architecture Design (5 Agents)

Launch ALL 5 agents in ONE Task message with `run_in_background: true`:

| Agent | Focus |
|-------|-------|
| Plan | Architecture planning, dependency graph |
| backend-system-architect | API, services, database |
| frontend-ui-developer | Components, state, hooks |
| llm-integrator | LLM integration (if needed) |
| ux-researcher | User experience, accessibility |

```python
# PARALLEL - All agents in ONE message
Task(subagent_type="Plan", prompt="...", run_in_background=True)
Task(subagent_type="backend-system-architect", prompt="...", run_in_background=True)
Task(subagent_type="frontend-ui-developer", prompt="...", run_in_background=True)
Task(subagent_type="llm-integrator", prompt="...", run_in_background=True)
Task(subagent_type="ux-researcher", prompt="...", run_in_background=True)
```

## Phase 4: Parallel Implementation (8 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect #1 | API endpoints |
| backend-system-architect #2 | Database layer |
| frontend-ui-developer #1 | UI components |
| frontend-ui-developer #2 | State & API hooks |
| llm-integrator | AI integration |
| rapid-ui-designer | Styling |
| test-generator #1 | Test suite |
| prioritization-analyst | Progress tracking |

## Phase 5: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| security-auditor | Security audit |

## Phase 5.5: Progress Notifications (CC 2.1.7)

CC 2.1.7 supports inline notification patterns for real-time progress updates:

### Agent Completion Notifications

When subagents complete, track their progress:

```python
# After parallel agent execution
for result in agent_results:
    notification.inline(f"{result.agent}: {result.status}")

# Summary notification
notification.inline(f"Phase 5 complete: {len(agent_results)}/{expected} agents finished")
```

### MCP Deferral Awareness

When MCPs are deferred due to context limits, adapt your workflow:

```python
if mcp.deferred:
    notification.inline("MCP tools deferred - using cached docs")
    # Fall back to cached documentation
    docs = load_cached_docs("react-19-patterns")
else:
    # Normal MCP query
    docs = mcp__context7__query_docs(...)
```

### Progress Tracking Pattern

Use inline notifications for long-running phases:

```
[Phase 4] Starting: 8 parallel agents
[Phase 4] Complete: backend-system-architect (2.3s)
[Phase 4] Complete: frontend-ui-developer (3.1s)
[Phase 4] Complete: database-engineer (1.8s)
...
[Phase 4] Finished: 8/8 agents (12.5s total)
```


## Phase 6: E2E Verification

If UI changes, verify with agent-browser:

```bash
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot /tmp/feature.png
agent-browser close
```

## Phase 7: Documentation

Save implementation decisions to memory MCP for future reference:

```python
mcp__mem0__add-memory(content="Implementation decisions...", userId="project-decisions")
```

## Summary

**Total Parallel Agents: 17 across 4 phases**

**Tools Used:**
- context7 MCP (library documentation)
- mem0 MCP (decision persistence)
- agent-browser CLI (E2E verification)

**Key Principles:**
- Tests are NOT optional
- Parallel when independent (use `run_in_background: true`)
- CC 2.1.6 auto-loads skills from agent frontmatter
- Evidence-based completion


## Related Skills
- explore: Explore codebase before implementing
- verify: Verify implementations work correctly
## References

- [Agent Phases](references/agent-phases.md)
# Research Findings: Deep Dive into OrchestKit Collaboration Gaps

This document compiles findings from 4 parallel research agents that analyzed OrchestKit's actual source code to assess collaboration readiness. Each section covers a different design direction.

## Research A: Bridge Layer — Connecting Generic Agents to Your Stack

### What We Found

OrchestKit's agents are generic by design — `backend-system-architect` knows Python/FastAPI patterns but doesn't know YOUR project uses SQLAlchemy 2.0 async with Alembic migrations. There's no mechanism to tell agents about your specific stack.

### The Stack Profile Concept

A `.claude/stack-profile.json` file would declare your project's technology choices:

```json
{
  "languages": ["python-3.12", "typescript-5.6"],
  "frameworks": {"backend": "fastapi-0.115", "frontend": "react-19"},
  "database": {"primary": "postgresql-16", "orm": "sqlalchemy-2.0-async"},
  "patterns": ["cursor-pagination", "repository-pattern", "event-sourcing"],
  "antiPatterns": ["offset-pagination", "god-models", "raw-sql-in-routes"]
}
```

### What Already Exists

The `/ork:setup` wizard (Phase 1-2) already scans for package.json, pyproject.toml, Dockerfile, etc. and classifies your stack. But it presents results to the user and forgets them. The scan data is never persisted or fed to agents.

The `subagent-context-stager.ts` does inject CLAUDE.md rules, but these are generic "always/never/must" directives, not stack-specific knowledge. An agent spawned to work on your FastAPI backend doesn't know you use async SQLAlchemy — it has to rediscover this from the codebase every time.

### The Setup Infrastructure Gap

The setup wizard scans tech stack (languages, frameworks, databases) but NOT existing Claude Code infrastructure:
- Doesn't check `.claude/agents/` for custom agents
- Doesn't check `~/.claude/skills/` for user-created skills
- Doesn't audit `.claude/rules/` path-scoped rules
- Doesn't count memory graph entities
- Doesn't detect if the user has project-specific MCP servers

This means the readiness score doesn't reflect the user's actual Claude Code configuration depth.

## Research B: Structured Handoffs — Agents Passing Work

### What We Found

OrchestKit has TWO independent handoff systems that duplicate work and neither completes the loop:

1. **handoff-preparer.ts** writes `HandoffContext` with static `NEXT_AGENT_MAP` (14 mappings) + human-readable suggestions
2. **feedback-loop.ts** writes ANOTHER `HandoffContext` with pipeline-aware routing + decision IDs

Both write to `.claude/context/handoffs/`. Neither reads from it.

The `subagent-context-stager.ts` (which runs on SubagentStart) reads from:
- `.claude/context/session/state.json` (pending tasks)
- `.claude/context/knowledge/decisions/active.json` (decisions)

But NOT from `.claude/context/handoffs/`. The handoff files accumulate on disk with no consumer.

### The Blackboard Pattern

Instead of point-to-point handoffs, a typed blackboard could let agents share structured artifacts:

- `backend-system-architect` writes: `{type: "api-schema", content: {...}, confidence: 0.9}`
- `frontend-ui-developer` reads all artifacts of type "api-schema" when it spawns
- `test-generator` reads both api-schema and component-tree artifacts

This differs from the current approach where handoffs are 1:1 (agent A → agent B) rather than broadcast (agent A → any interested agent).

### The Schema Mismatch

`context-publisher.ts` writes decisions as `Record<string, DecisionEntry>` (object keyed by agent name). But `subagent-context-stager.ts` reads decisions filtered by category. The schemas technically work together but the 200-character truncation in context-publisher means the downstream stager gets almost no useful content.

## Research C: Skill Pipelines + Hook Intelligence

### What We Found — Pipelines Are 80% Built

The `multi-agent-coordinator.ts` has complete pipeline infrastructure:
- 5 pipeline definitions with dependency DAGs
- Pipeline detection from natural language triggers
- Task creation with `blockedBy` ordering
- Pipeline execution tracking with status
- Markdown rendering for user-facing plans

What's missing for production:
1. **No YAML loader** — pipelines are hardcoded in TypeScript, not user-configurable
2. **No dynamic generation** — can't create pipelines on the fly based on the task
3. **Agent Teams kill switch** — `isAgentTeamsActive()` disables pipeline detection entirely
4. **No metrics** — no timing, token usage, or quality tracking per pipeline step

### Hook Intelligence Loops

The feedback-loop.ts captures agent output and routes to downstream agents. But the routing is informational only — it writes handoff files and returns a `systemMessage` like "routed to frontend-ui-developer". It doesn't actually spawn the next agent.

The actual agent spawning still depends on the main Claude conversation loop. The hooks can suggest what should happen next, but they can't make it happen.

### Error Pattern Analysis

No hook currently aggregates error patterns across sessions. If `test-generator` fails 60% of the time on React component tests, no one knows. Each session starts fresh without learning from past failures.

A Model Velocity Calibrator could track:
- Average tokens per agent type
- Success/failure rates by agent
- Common error patterns
- Quality scores over time

### Quality Regression Detection

The `code-quality-reviewer` agent runs as part of pipelines but its findings aren't persisted as baselines. There's no way to detect if code quality degrades over time — each review is isolated.

## Research D: Org-Level Agent Patterns

### What We Found

OrchestKit has NO concept of organizational scope. Everything is either:
- **Global** — plugin-level agents/skills shared by all users
- **Project** — `.claude/agents/` custom agents per repo

There's no middle layer for team or org patterns. When 5 developers all use Celery + FastAPI + Alembic, each one independently discovers the same patterns.

### The Custom Agent Gap

Users can create `.claude/agents/my-agent.md` for project-specific agents. But:
- These don't inherit knowledge from the generic ork agents they're based on
- There's no sharing mechanism between projects
- The setup wizard doesn't detect or recommend custom agents
- No template system — users start from scratch

### Org Agent Registry Concept

An org-level registry could let teams share:
- Stack-specific agent configurations (e.g., "our-celery-agent" that knows the company's task queue patterns)
- Cross-project memory (patterns that work across all microservices)
- Shared skill configurations (e.g., "our-deploy" skill customized for the company's CI/CD)

### The Template Bridge

Instead of generic ork agents or fully custom project agents, there could be "template agents" that are pre-configured for common stacks:

- `ork-template:fastapi-postgres` — FastAPI + SQLAlchemy + Alembic + pytest best practices
- `ork-template:react-nextjs` — Next.js 16 + React 19 + TanStack + Zustand patterns
- `ork-template:celery-redis` — Celery 5.4 + Redis + task patterns + monitoring

These would be maintained by OrchestKit but parameterized for the user's specific project.

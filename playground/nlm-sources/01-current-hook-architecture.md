# OrchestKit Hook Architecture: Current State (February 2026)

This document describes how OrchestKit's 55 hooks currently handle agent collaboration, context sharing, and pipeline coordination. It covers the actual TypeScript implementation — what works, what's broken, and where the gaps are.

## Overview: 18 Event Types

OrchestKit hooks fire on 18 different Claude Code events:

- **UserPromptSubmit** — when the user sends a message (11 hooks)
- **SubagentStart** — when a sub-agent spawns (4 hooks)
- **SubagentStop** — when a sub-agent finishes (4 hooks)
- **TeammateIdle** — when an Agent Teams teammate goes idle (1 hook)
- **TaskCompleted** — when a task finishes (1 hook)
- **PreToolUse / PostToolUse** — before/after tool calls (various)
- **Stop** — when the session ends (3 hooks)
- **Notification** — for sounds and alerts (3 hooks)

## The Context Sharing System

### How Agents Get Context Today (SubagentStart)

When a sub-agent spawns, the `subagent-context-stager` hook assembles a `systemMessage` from:

1. **Critical rules from CLAUDE.md** — scans both global (~/.claude/CLAUDE.md) and project CLAUDE.md for lines containing "always", "never", "must", "don't". Caps at 12 rules (~150 tokens).
2. **Pending tasks** — reads from `.claude/context/session/state.json`
3. **Relevant decisions** — reads from `.claude/context/knowledge/decisions/active.json`, filtered by category (backend/frontend) based on regex matching the task description
4. **Testing reminders** — hardcoded text if task mentions "test"
5. **Issue documentation** — looks up docs/issues/ if task mentions "#123"

**Critical gap**: The stager never reads the agent's own .md file. It doesn't know what skills the agent has, what tools it can use, or what its domain expertise is. It matches context by simple regex on the task description string, not by understanding the agent's capabilities.

### How Agent Output Gets Captured (SubagentStop)

Three hooks fire when an agent completes:

1. **feedback-loop.ts** — Captures output, writes to `decision-log.json`, creates handoff files for downstream agents. Has pipeline-aware routing via `getDownstreamAgents()`.
2. **context-publisher.ts** — Writes to `active.json` (decisions) and `state.json` (session). Truncates output to 200 characters.
3. **handoff-preparer.ts** — Writes JSON handoff files to `.claude/context/handoffs/` with suggestions for the next agent.

**Critical bug**: feedback-loop.ts silences itself when Agent Teams is active (`isAgentTeamsActive()` returns true → `outputSilentSuccess()`). This means during the most collaborative mode (Agent Teams), the feedback loop is completely disabled. No decisions logged, no handoffs created.

**Dead code**: Both feedback-loop.ts and handoff-preparer.ts write handoff files to `.claude/context/handoffs/`. But NO hook in SubagentStart reads from this directory. The handoffs are written and never consumed.

## The Pipeline System

### 5 Predefined Pipelines (multi-agent-coordinator.ts)

OrchestKit defines 5 agent pipelines:

1. **Product Thinking** — market-intelligence → ux-researcher → product-strategist → prioritization-analyst → business-case-builder → requirements-translator (6 steps)
2. **Full-Stack Feature** — backend-system-architect → frontend-ui-developer → test-generator → security-auditor (4 steps)
3. **AI Integration** — workflow-architect → llm-integrator → data-pipeline-engineer → test-generator (4 steps)
4. **Security Audit** — security-auditor → security-layer-auditor → ai-safety-auditor (3 steps)
5. **Frontend Compliance** — frontend-ui-developer → frontend-performance-engineer → accessibility-specialist (3 steps)

Each pipeline has trigger phrases (e.g., "should we build", "full-stack feature"), dependency ordering, estimated token budgets, and associated skills.

### Pipeline Detection

`detectPipeline()` matches user prompt against trigger phrases. Like the feedback loop, it also silences itself during Agent Teams mode.

### What's 80% Built

The pipeline infrastructure is surprisingly complete:
- Pipeline definitions with dependencies ✓
- Task creation with `blockedBy` ordering ✓
- Pipeline execution tracking ✓
- Markdown rendering of pipeline plans ✓

What's missing:
- No YAML-based user-defined pipelines (hardcoded in TypeScript)
- No dynamic pipeline generation based on context
- No pipeline metrics or timing data
- Silenced during Agent Teams (the mode where pipelines matter most)

## The 800-Token Bottleneck

The `unified-dispatcher.ts` (UserPromptSubmit) enforces an `MAX_OUTPUT_TOKENS = 800` cap on `additionalContext`. This is the combined budget for ALL hooks that want to inject context into the user's prompt.

However, `systemMessage` has NO cap. This is the key insight: hooks can inject unlimited context via systemMessage (used by SubagentStart hooks), but the per-turn context from UserPromptSubmit is capped at 800 tokens shared across all hooks.

## Agent Teams Integration

Agent Teams (CC 2.1.33+) adds peer-to-peer messaging between agents. But OrchestKit's hooks largely disable themselves when Agent Teams is active:

- feedback-loop.ts → silent
- multi-agent-coordinator.ts → silent
- pipeline detection → disabled

The rationale (Issue #362) is that Teams has native task tracking. But this means ALL of OrchestKit's intelligence (decision logging, handoff prep, pipeline routing) goes dark during collaborative sessions.

## The Knowledge Graph Connection

`graph-memory-inject.ts` (SubagentStart) has a hardcoded `AGENT_DOMAINS` map for 15 of 38 agents. It reads from `knowledge-graph.jsonl` and injects relevant entities via systemMessage.

The remaining 23 agents get no knowledge graph context — they start with a blank slate every time.

## Summary of Gaps

1. **Handoff files never read** — Written by 2 hooks, consumed by 0
2. **Agent Teams silences hooks** — Most intelligence disabled in collaborative mode
3. **200-char truncation** — Agent output summaries too short to be useful
4. **No agent frontmatter reading** — Hooks don't know agent capabilities
5. **15/38 agents have knowledge graph** — 23 agents start cold
6. **800-token shared budget** — All per-turn context competes for same pool
7. **Static pipeline mappings** — No user-defined or dynamic pipelines
8. **No quality baselines** — Agent output quality not tracked over time

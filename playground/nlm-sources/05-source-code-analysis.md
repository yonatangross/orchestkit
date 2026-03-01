# OrchestKit Source Code Analysis: Key Files for Collaboration

This document walks through the actual TypeScript source code of OrchestKit's collaboration-related hooks, explaining what each file does, how they interact, and where they fail.

## File 1: feedback-loop.ts (SubagentStop hook)

**Purpose**: Captures agent completion output, logs decisions, creates handoff contexts for downstream agents.

**Key function**: `feedbackLoop(input: HookInput): HookResult`

**What it does**:
1. Checks if Agent Teams is active — if so, returns silently (line 302-306). This is the critical bug: the entire feedback system goes dark during collaborative sessions.
2. Extracts the agent type from `tool_input.subagent_type` or `input.subagent_type`
3. Generates a decision ID like `DEC-20260227-4821`
4. Looks up the CC 2.1.16 task ID associated with this agent
5. Calls `getDownstreamAgents()` — first checks active pipeline for dependency-based routing, falls back to static mapping (14 agent pairs)
6. Categorizes the agent into feedback categories: product-thinking, architecture, frontend, quality, security, ai-integration, debugging
7. Extracts a 500-character summary of the agent output
8. Writes to `decision-log.json` with full context
9. Creates handoff files at `.claude/context/handoffs/{from}_to_{to}_{date}.json`
10. Returns `systemMessage: "Feedback loop: routed to {downstream}"` if there are downstream agents

**The static routing map** defines these chains:
- market-intelligence → product-strategist → prioritization-analyst → business-case-builder → requirements-translator → metrics-architect → backend-system-architect
- backend-system-architect → frontend-ui-developer → test-generator → security-auditor
- workflow-architect → llm-integrator → data-pipeline-engineer → test-generator
- rapid-ui-designer → frontend-ui-developer
- ux-researcher → rapid-ui-designer

**Bug**: The `getDownstreamAgents()` function first checks the active pipeline (from multi-agent-coordinator), then falls back to static mapping. But since pipeline detection is also disabled during Agent Teams, both paths fail during collaborative mode.

## File 2: handoff-preparer.ts (SubagentStop hook)

**Purpose**: Creates handoff context files with suggestions for the next agent in the pipeline.

**Key function**: `handoffPreparer(input: HookInput): HookResult`

**What it does**:
1. Checks if the agent is in `VALID_AGENTS` set (19 agents) — silently exits for others
2. Uses `NEXT_AGENT_MAP` to find the next agent (same mappings as feedback-loop, duplicated)
3. Uses `SUGGESTIONS_MAP` for human-readable handoff suggestions like "Next: frontend-ui-developer should build UI components"
4. Writes handoff JSON to `.claude/context/handoffs/{from}_to_{to}_{date}.json`
5. Writes a log file to `.claude/logs/agent-handoffs/`
6. Returns `outputSilentSuccess()` — never injects anything into the conversation

**Problem**: This file duplicates the routing logic from feedback-loop.ts. Both write to the same handoffs directory. The difference is that handoff-preparer includes human-readable suggestions while feedback-loop includes decision IDs and task IDs.

**Dead code**: The handoff files written here are NEVER read by any SubagentStart hook.

## File 3: subagent-context-stager.ts (SubagentStart hook)

**Purpose**: Assembles context for new sub-agents by reading project state and injecting it via systemMessage.

**Key function**: `subagentContextStager(input: HookInput): HookResult`

**What it does**:
1. Extracts `subagent_type` and `task_description` from tool_input
2. **Injects CLAUDE.md rules**: Reads both global (~/.claude/CLAUDE.md) and project CLAUDE.md. Scans for lines with "always", "never", "must", "don't". Caps at 12 rules (~150 tokens).
3. **Checks pending tasks**: Reads `.claude/context/session/state.json` for tasks_pending array. Shows up to 5.
4. **Stages relevant decisions**: Reads `.claude/context/knowledge/decisions/active.json`. Filters by category (backend/frontend) based on REGEX matching the task description.
5. **Testing reminders**: If task description mentions "test", adds hardcoded testing tips
6. **Issue docs**: If task mentions "#123", looks for matching file in docs/issues/
7. Returns `systemMessage` with all assembled context

**What it DOESN'T do**:
- Never reads `.claude/context/handoffs/` (the handoff files from SubagentStop hooks)
- Never reads the agent's .md file (doesn't know its skills/tools/capabilities)
- Never reads the stack profile (doesn't know the project's tech stack)
- Never reads the blackboard (doesn't exist yet)
- Uses regex on task description for category matching — fragile and imprecise

## File 4: context-publisher.ts (SubagentStop hook)

**Purpose**: Publishes agent decisions to the Context Protocol 2.0 files.

**Key function**: `contextPublisher(input: HookInput): HookResult`

**What it does**:
1. Extracts agent output, truncates to 200 characters
2. Writes to `active.json` decisions file as `Record<string, DecisionEntry>` keyed by agent name (underscored)
3. Updates `state.json` session state: adds to tasks_completed array, caps at 50 entries, updates last_activity
4. Writes detailed log file

**Problems**:
- 200-character truncation loses almost all useful content
- The `DecisionEntry` type in this file uses `Record<string, DecisionEntry>` (object) but the schema used by the stager reads it as an array-like structure. They work together but the coupling is fragile.
- No quality scoring — just records completion, not quality

## File 5: multi-agent-coordinator.ts (Library)

**Purpose**: Pipeline definitions and detection logic.

**What it defines**:
- `PIPELINES` — 5 pipeline definitions with agents, dependencies, trigger phrases
- `detectPipeline()` — matches user prompt against triggers
- `createPipelineExecution()` — generates task instructions with blockedBy ordering
- `registerPipelineExecution()` — tracks pipeline state
- `formatPipelinePlan()` — renders markdown for user

**The 5 pipelines**:
1. Product Thinking: 6 steps, ~13,500 tokens
2. Full-Stack Feature: 4 steps, ~10,000 tokens
3. AI Integration: 4 steps, ~8,500 tokens
4. Security Audit: 3 steps, ~5,500 tokens
5. Frontend Compliance: 3 steps, ~6,500 tokens

**What's missing**:
- YAML loader for user-defined pipelines
- Dynamic pipeline generation
- Pipeline metrics (actual vs estimated tokens)
- Active during Agent Teams (currently disabled)

## How These Files Interact (or Don't)

```
SubagentStart:
  subagent-context-stager.ts → reads state.json, active.json, CLAUDE.md
  graph-memory-inject.ts → reads knowledge-graph.jsonl (15/38 agents only)

SubagentStop:
  feedback-loop.ts → writes decision-log.json, writes handoffs/
  handoff-preparer.ts → writes handoffs/ (duplicate)
  context-publisher.ts → writes active.json, state.json

The Loop Gap:
  SubagentStop writes → handoffs/
  SubagentStart reads → state.json, active.json
  SubagentStart NEVER reads → handoffs/

  Result: Handoff files accumulate on disk with no consumer.
  The "feedback loop" is actually a "feedback dead end."
```

## The Agent Teams Paradox

When Agent Teams is active (collaborative mode with peer messaging):
- feedback-loop.ts → SILENT (no decisions logged)
- detectPipeline() → DISABLED (no pipeline routing)
- All handoff preparation → SKIPPED

The rationale: "Teams has native task tracking and peer messaging, making custom decision-log redundant." (Issue #362)

But this also means:
- No decision history for post-session review
- No downstream routing suggestions
- No handoff context for the next agent
- No quality metrics captured

The hooks yield to Agent Teams' capabilities but don't replace them with anything. It's not that Agent Teams does what the hooks do — it does DIFFERENT things (peer messaging). The hooks' capabilities (decision logging, routing, handoff prep) simply vanish.

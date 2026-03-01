# 22 Brainstormed Ideas: Clustered by Theme

This document lists all 22 ideas that emerged from the brainstorming session, organized into 7 thematic clusters. Each idea is scored on feasibility (how hard to build), effort (how long), and impact (how much it improves collaboration).

## Cluster 1: Context Sharing (5 ideas)

These ideas address the fundamental problem: agents start with no knowledge of each other's work.

### 1.1 Stack Profile Files
**Feasibility: 9/10 | Effort: Low | Impact: High**
Persist the setup wizard's scan results as `.claude/stack-profile.json`. Every agent reads this on spawn to understand the project's technology choices. Currently, this data is computed, shown to the user, and discarded.

### 1.2 Context Packs
**Feasibility: 7/10 | Effort: Medium | Impact: High**
Pre-assembled context bundles for different agent types (backend-pack, frontend-pack, security-pack). Built during setup, loaded during SubagentStart. Replaces the current regex-based matching in subagent-context-stager.

### 1.3 Living Agent Brief
**Feasibility: 8/10 | Effort: Low | Impact: Medium**
Read the agent's .md frontmatter on spawn. Match `skills` and `tools` fields against the stack profile to select relevant context. Closes the gap where hooks know the agent type string but not its capabilities.

### 1.4 Session Knowledge Persistence
**Feasibility: 6/10 | Effort: High | Impact: High**
Extract structured decisions from agent output and persist as knowledge graph entities. Currently output is truncated to 200 characters — most information is lost between sessions.

### 1.5 Graph Memory for All Agents
**Feasibility: 8/10 | Effort: Medium | Impact: Medium**
Extend the `AGENT_DOMAINS` map from 15 agents to all 38. Currently 23 agents start without any knowledge graph context because they're not in the hardcoded map.

## Cluster 2: Handoff System (4 ideas)

These ideas fix the broken handoff pipeline where files are written but never read.

### 2.1 Typed Artifact Blackboard
**Feasibility: 7/10 | Effort: Medium | Impact: Very High**
Replace point-to-point handoffs with a typed artifact store. Agents publish structured artifacts (api-schema, component-tree, test-plan) that any interested agent can consume. Broadcast model instead of 1:1.

### 2.2 Agent Capability Manifests (provides/requires)
**Feasibility: 8/10 | Effort: Low | Impact: High**
Add `provides:` and `requires:` fields to agent frontmatter. The stager reads these to pre-load required artifacts from the blackboard before the agent starts. Makes dependencies explicit rather than inferred.

### 2.3 Connect Handoff Reader
**Feasibility: 9/10 | Effort: Very Low | Impact: High**
The simplest fix: make `subagent-context-stager.ts` read from `.claude/context/handoffs/` directory. Two hooks already write there — just add a reader. Could ship in v7.1 as a quick win.

### 2.4 Agent Handoff Bus
**Feasibility: 7/10 | Effort: Medium | Impact: High**
When an agent completes, the SubagentStop hook publishes its output to the blackboard AND includes artifact summaries in the systemMessage for the next agent. Closes the write-but-never-read loop.

## Cluster 3: Pipeline Intelligence (3 ideas)

These ideas make the existing pipeline system smarter and more flexible.

### 3.1 Pipeline YAML Loader
**Feasibility: 8/10 | Effort: Medium | Impact: High**
Move pipeline definitions from hardcoded TypeScript to user-editable YAML files in `.claude/pipelines/`. The execution engine already exists — just needs a YAML front-end. Lets users define custom workflows for their specific processes.

### 3.2 Fix Agent Teams Kill Switch
**Feasibility: 10/10 | Effort: Very Low | Impact: Very High**
Remove or make conditional the `isAgentTeamsActive()` guards that disable feedback-loop, pipeline detection, and handoff preparation during Agent Teams mode. This is arguably a bug — it silences all orchestration intelligence during the most collaborative mode.

### 3.3 Dynamic Pipeline Generation
**Feasibility: 5/10 | Effort: High | Impact: Medium**
Auto-generate pipelines based on the user's prompt and detected stack. Instead of matching against trigger phrases, use LLM to compose a pipeline from available agents. More flexible but harder to predict.

## Cluster 4: Hook Learning (3 ideas)

These ideas add intelligence to the hook system — learning from patterns over time.

### 4.1 Model Velocity Calibrator
**Feasibility: 7/10 | Effort: Medium | Impact: High**
Track agent performance metrics: tokens consumed, completion time, success rate. Store in `.claude/hooks/metrics/velocity.json`. Use data for model routing suggestions (Haiku vs Sonnet vs Opus), pipeline time estimates, and identifying underperforming agents.

### 4.2 Error Pattern Router
**Feasibility: 6/10 | Effort: Medium | Impact: High**
Aggregate error patterns across sessions. If an agent type consistently fails on certain tasks, inject warnings or alternative approaches into its systemMessage. Surface persistent issues via `/ork:doctor`.

### 4.3 Quality Regression Detector
**Feasibility: 6/10 | Effort: Medium | Impact: Medium**
Persist quality baselines (lint scores, test coverage, security findings) per project. Alert when scores decline across sessions. Currently each code review is isolated — no trend detection.

## Cluster 5: Skill Chain Optimization (2 ideas)

These ideas optimize the sequence of skill and agent invocations.

### 5.1 Skill Chain Anticipator
**Feasibility: 5/10 | Effort: High | Impact: Medium**
Predict what the user needs next based on current skill invocation. Pre-warm context for anticipated agents. Example: after `/ork:implement`, pre-load test patterns for the likely `/ork:verify` invocation.

### 5.2 Cross-Skill State Sharing
**Feasibility: 6/10 | Effort: Medium | Impact: High**
Let skills share state via a typed registry. When `/ork:implement` creates an API endpoint, `/ork:verify` automatically knows what to test without re-scanning. Currently each skill invocation starts from scratch.

## Cluster 6: Organization Patterns (3 ideas)

These ideas add team/org-level agent sharing.

### 6.1 Org Agent Registry
**Feasibility: 5/10 | Effort: High | Impact: Very High**
Central registry where teams share agent configurations, skill customizations, and cross-project patterns. Like npm for agent configs. Teams converge on shared best practices instead of each developer maintaining their own.

### 6.2 Template Agents
**Feasibility: 7/10 | Effort: Medium | Impact: High**
Pre-configured agent templates for common stacks: `ork-template:fastapi-postgres`, `ork-template:react-nextjs`, `ork-template:celery-redis`. Maintained by OrchestKit, parameterized for the user's project. Bridges the gap between generic ork agents and fully custom project agents.

### 6.3 Cross-Project Memory Sync
**Feasibility: 4/10 | Effort: Very High | Impact: High**
Sync patterns and decisions across projects. When you learn that cursor pagination works better than offset in project A, that knowledge should be available in project B. Requires a sync mechanism and conflict resolution.

## Cluster 7: Setup Integration (2 ideas)

These ideas extend the setup wizard to close collaboration gaps.

### 7.1 CC Infrastructure Scan (Phase 1b)
**Feasibility: 9/10 | Effort: Low | Impact: High**
Extend setup to scan Claude Code's own configuration: custom agents, user skills, path-scoped rules, memory graph depth, MCP servers. Feeds into readiness score and improvement plan. Currently setup only scans the tech stack, not the CC tooling.

### 7.2 Collaboration Readiness Dimension
**Feasibility: 8/10 | Effort: Low | Impact: Medium**
Add a "Collaboration" dimension to the readiness score that measures: handoff connectivity, knowledge graph depth, pipeline coverage, agent capability manifests. Currently the 6 dimensions don't measure collaboration health.

---

## Impact vs Effort Summary

| Quick Wins (ship in v7.1) | Impact |
|----------------------------|--------|
| Fix Agent Teams kill switch (3.2) | Very High |
| Connect handoff reader (2.3) | High |
| Stack profile persistence (1.1) | High |
| CC infrastructure scan (7.1) | High |

| Foundation (v7.2) | Impact |
|---------------------|--------|
| Typed artifact blackboard (2.1) | Very High |
| Pipeline YAML loader (3.1) | High |
| Agent capability manifests (2.2) | High |
| Velocity calibrator (4.1) | High |

| Strategic (v8.0) | Impact |
|--------------------|--------|
| Org agent registry (6.1) | Very High |
| Error pattern router (4.2) | High |
| Template agents (6.2) | High |
| Cross-project memory (6.3) | High |

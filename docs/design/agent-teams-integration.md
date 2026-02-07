# Agent Teams Integration Design Doc

**Issue:** [#334 — Redesign /ork:implement to use native Agent Teams](https://github.com/yonatangross/orchestkit/issues/334)
**Status:** Draft / Prototype
**Author:** OrchestKit Core
**CC Version:** >= 2.1.33 (Agent Teams research preview)
**Date:** 2026-02-06

---

## 1. Problem Statement

OrchestKit's `/ork:implement` currently orchestrates up to 17 parallel agents across 10 phases using the `Task` tool with `subagent_type`. This works but has a fundamental limitation: **agents cannot talk to each other**. Every agent reports back to the lead, which becomes a bottleneck for cross-cutting work.

CC 2.1.32 introduces Agent Teams — multi-agent collaboration with mailbox messaging, shared task lists, and peer-to-peer communication. This design doc defines how OrchestKit adopts Agent Teams while preserving its hook lifecycle, quality gates, skill injection, and pipeline orchestration.

---

## 2. Architecture Comparison

### Current: Task Tool Subagents (Star Topology)

```
                  ┌──────────┐
                  │   Lead   │
                  │ (caller) │
                  └────┬─────┘
           ┌──────┬────┼────┬──────┐
           ▼      ▼    ▼    ▼      ▼
        ┌─────┐┌─────┐┌──┐┌─────┐┌─────┐
        │FE   ││BE   ││QA││Sec  ││Perf │
        │Dev  ││Arch ││  ││Audit││Eng  │
        └─────┘└─────┘└──┘└─────┘└─────┘
          ↑      ↑    ↑    ↑      ↑
          └──────┴────┴────┴──────┘
              All report to Lead only
```

**Characteristics:**
- Each agent gets isolated context via `subagent_type`
- Results return to caller only — no cross-talk
- Lead manages all coordination, becomes bottleneck
- Hooks fire: SubagentStart (7) + SubagentStop (11) = 18 hooks per agent lifecycle
- Skills auto-injected from agent frontmatter
- Cost: lower (results summarized back)

### Target: Agent Teams (Mesh Topology)

```
                  ┌──────────┐
                  │   Lead   │ ← Delegate mode (coordination only)
                  │(orchestr)│
                  └────┬─────┘
           ┌──────┬────┼────┬──────┐
           ▼      ▼    ▼    ▼      ▼
        ┌─────┐┌─────┐┌──┐┌─────┐┌─────┐
        │FE   ││BE   ││QA││Sec  ││Perf │
        │Dev  ││Arch ││  ││Audit││Eng  │
        └──┬──┘└──┬──┘└──┘└─────┘└─────┘
           │◄────►│  Peer-to-peer
           │      │  messaging
           └──────┘
```

**Characteristics:**
- Each teammate is a full CC session with own context
- Teammates message each other directly (mailbox)
- Shared task list with self-claiming and dependency management
- Lead uses delegate mode — coordination only, no code
- Teammates load CLAUDE.md, MCP servers, skills automatically
- Cost: higher (each teammate = full Claude instance)

---

## 3. Integration Design

### 3.1 Dual-Mode Orchestration

OrchestKit supports both modes. The decision is based on task complexity:

```
┌─────────────────────────────────────────────────────┐
│              Complexity Assessment                    │
│  (assess-complexity score: 1-5 across 7 dimensions)  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Average < 3.0    → Task Tool subagents (current)    │
│  Average 3.0-3.5  → User choice (recommend Teams)    │
│  Average > 3.5    → Agent Teams (if enabled)         │
│                                                       │
│  Override: ORCHESTKIT_PREFER_TEAMS=1 forces Teams    │
│  Fallback: Teams disabled → always use Task tool     │
└─────────────────────────────────────────────────────┘
```

**Selection criteria for Agent Teams:**
- Cross-cutting changes (frontend + backend + tests need to agree on API shape)
- Research/debugging with competing hypotheses
- Tasks with > 3 agents that need inter-agent coordination
- Level 4-5 complexity with high unknowns

**Selection criteria for Task tool (keep current):**
- Focused, independent tasks (security audit, test generation)
- Sequential pipelines with clear handoffs
- Low-complexity tasks (single agent sufficient)
- Cost-sensitive scenarios

### 3.2 Agent-to-Teammate Mapping

OrchestKit's 36 agents become **teammate templates**. The lead selects which specialists to spawn based on the task:

```yaml
# Agent frontmatter (src/agents/backend-system-architect.md)
---
name: backend-system-architect
model: opus
tools: [Read, Edit, MultiEdit, Write, Bash, Grep, Glob]
skills: [api-design-framework, database-schema-designer, ...]
team-role: implementer        # NEW: teammate role hint
team-capabilities:            # NEW: what this agent can coordinate on
  - api-contract-definition
  - database-schema-review
  - integration-endpoint-handoff
---
```

**Spawn prompt template:**

```
Spawn a teammate named "{agent-name}" with the prompt:

"You are the {agent-name} specialist on this team.

## Your Role
{agent description from frontmatter}

## Your Task
{specific task from pipeline step}

## Coordination Protocol
- When you define an API contract, message the frontend-ui-developer teammate
- When you need a schema review, message the database-engineer teammate
- Update the shared task list when you complete work
- If blocked, message the lead with what you need

## Quality Requirements
- All code must pass linting
- Include tests for new functionality
- Document API changes in OpenAPI format"
```

### 3.3 Pipeline Migration

The 5 predefined pipelines migrate from sequential Task spawning to team formations:

#### Pipeline 2: Full-Stack Feature (current → Agent Teams)

**Current (Task tool):**
```
Step 1: backend-system-architect    → Task(subagent_type="backend-system-architect")
Step 2: frontend-ui-developer       → Task(subagent_type="frontend-ui-developer")  [blocked by 1]
Step 3: test-generator              → Task(subagent_type="test-generator")          [blocked by 1,2]
Step 4: security-auditor            → Task(subagent_type="security-auditor")        [blocked by 1,2]
```

**Agent Teams:**
```
Lead creates team "full-stack-{feature-slug}":

Spawn backend-system-architect:
  "Design and implement the API. When the endpoint contract is ready,
   message frontend-ui-developer with the types and routes."

Spawn frontend-ui-developer:
  "Wait for API contract from backend-system-architect, then build
   the React components. Share component interfaces with test-generator."

Spawn test-generator:
  "Monitor backend and frontend progress. Write tests as contracts
   stabilize. Don't wait for completion — test incrementally."

Spawn security-auditor:
  "Review code as it's committed. Flag issues to the relevant teammate
   directly. Require plan approval before making any changes."

Lead (delegate mode):
  "Wait for all teammates to complete. Synthesize any conflicts.
   Run final quality gate."
```

**Key difference:** Steps 2-4 no longer wait for step 1 to fully complete. The backend teammate shares the API contract as soon as it's defined (not after all implementation is done), and the frontend teammate starts building immediately.

#### Pipeline 1: Product Thinking (6 steps)

```
Team "product-{feature}":

market-intelligence:     "Research competitive landscape. Share findings with all."
ux-researcher:           "Create personas. Wait for market data, then map journeys."
product-strategist:      "Validate value prop after market + UX data. Challenge ux-researcher."
prioritization-analyst:  "Score using RICE/ICE after strategist validates."
business-case-builder:   "Build ROI after prioritization. Challenge assumptions."
requirements-translator: "Write PRD after all above converge."
```

#### Pipeline 3: AI Integration (4 steps)

```
Team "ai-{feature}":

workflow-architect:      "Design LangGraph workflow. Share state schema with all."
llm-integrator:          "Connect APIs based on workflow design. Share prompt templates."
data-pipeline-engineer:  "Build embeddings pipeline. Coordinate chunk strategy with llm-integrator."
test-generator:          "Write LLM tests incrementally. Use VCR.py for deterministic replays."
```

### 3.4 The `/ork:implement` 10-Phase Migration

| Phase | Current | Agent Teams | Change |
|-------|---------|-------------|--------|
| 0. User Intent | AskUserQuestion | AskUserQuestion | None |
| 1. Discovery | WebSearch + Context7 | Same | None |
| 2. Micro-Planning | Lead plans tasks | Lead plans + **team formation** | Team composition decided here |
| 3. Worktree Setup | Optional git worktree | **Each teammate gets worktree** | Prevent file conflicts |
| 4. Architecture | 5 parallel Task spawns | **5-member team** with messaging | Cross-talk enabled |
| 5. Implementation | 8 parallel Task spawns | **Team expands** (add members) | Incremental, not batch |
| 6. Integration | 4 parallel Task spawns | **Team members coordinate** | Peer verification |
| 7. Scope Creep | 1 agent | Lead evaluates | Team disbanded |
| 8. E2E Verification | Browser testing | Same | None |
| 9. Documentation | mem0 save | Same | None |
| 10. Reflection | 1 agent | Lead reflects | None |

**Phase 4 + 5 merge opportunity:** With Agent Teams, architecture and implementation can overlap. The workflow-architect designs while the backend-system-architect starts building foundations.

---

## 4. Hook Compatibility

### 4.1 Hook Behavior with Agent Teams

Agent Teams teammates are full CC sessions. They load CLAUDE.md and hooks independently. This means:

| Hook Category | Fires for Lead? | Fires for Teammates? | Notes |
|---|---|---|---|
| **SessionStart** | Yes | Yes (each teammate) | Teammates get full startup sequence |
| **UserPromptSubmit** | Yes | Yes (on teammate messages) | Messages from lead/peers trigger this |
| **SubagentStart** | Lead only (for Task spawns) | N/A — teammates are sessions, not subagents | **Gap: need new hook** |
| **SubagentStop** | Lead only | N/A | **Gap: need new hook** |
| **PreToolUse** | Yes | Yes | Security hooks work per-teammate |
| **PostToolUse** | Yes | Yes | Quality hooks work per-teammate |
| **PreCompact** | Yes | Yes (independent compaction) | Each teammate manages own context |

### 4.2 Hook Gaps and Solutions

**Gap 1: No SubagentStart/Stop for teammates**

Teammates are sessions, not subagents. The `task-linker` and `task-completer` hooks don't fire.

**Solution — Team Lifecycle Hooks (new):**

```typescript
// src/hooks/src/team/team-member-start.ts
// Fires: When lead detects a new teammate has been spawned
// Trigger: SessionStart hook on teammate, which messages lead

export function teamMemberStart(input: HookInput): HookResult {
  // Equivalent to task-linker but for teammates
  const memberName = input.teammate_name;
  const teamId = input.team_id;

  // Link to orchestration task
  linkTeamMemberToTask(memberName, teamId);

  // Inject team-specific context
  return {
    continue: true,
    context: formatTeamContext(teamId, memberName),
  };
}
```

```typescript
// src/hooks/src/team/team-member-complete.ts
// Fires: When a teammate sends idle notification to lead
// Trigger: Teammate finishes all tasks and stops

export function teamMemberComplete(input: HookInput): HookResult {
  const memberName = input.teammate_name;
  const teamId = input.team_id;

  // Mark task completed (equivalent to task-completer)
  completeTeamMemberTask(memberName, teamId);

  // Check if all members done → trigger synthesis
  const teamStatus = getTeamStatus(teamId);
  if (teamStatus.allComplete) {
    return {
      continue: true,
      context: '## All teammates complete — synthesize results and run quality gate',
    };
  }

  return { continue: true };
}
```

**Gap 2: context-gate limits don't apply to teammates**

The context-gate hook limits concurrent subagents (max 4 background, max 6 per response). Teammates bypass this.

**Solution — Team Size Gate:**

```typescript
// src/hooks/src/team/team-size-gate.ts
// Inject into lead's context when team is being formed

const TEAM_LIMITS = {
  maxMembers: 6,            // Hard cap on team size
  maxOpsPerTeammate: 3,     // Opus teammates (expensive)
  recommendedMembers: 4,    // Optimal team size
};

export function teamSizeGate(input: HookInput): HookResult {
  const proposedSize = input.proposed_team_size;

  if (proposedSize > TEAM_LIMITS.maxMembers) {
    return {
      continue: false,
      reason: `Team size ${proposedSize} exceeds max ${TEAM_LIMITS.maxMembers}. Split into sub-teams.`,
    };
  }

  if (proposedSize > TEAM_LIMITS.recommendedMembers) {
    return {
      continue: true,
      context: `WARNING: ${proposedSize} members exceeds recommended ${TEAM_LIMITS.recommendedMembers}. Consider splitting.`,
    };
  }

  return { continue: true };
}
```

**Gap 3: quality-gate and evidence-verification need team aggregation**

Individual teammate quality is validated by PreToolUse/PostToolUse hooks. But team-level quality (all members produced consistent, tested code) needs synthesis.

**Solution — Team Quality Gate:**

```typescript
// src/hooks/src/team/team-quality-gate.ts
// Runs when lead receives all-complete signal

interface TeamEvidence {
  memberResults: Map<string, MemberEvidence>;
  conflicts: Conflict[];
  aggregateScore: number;
}

export function teamQualityGate(teamEvidence: TeamEvidence): HookResult {
  // 1. Check each member passed their quality gate
  const failedMembers = [...teamEvidence.memberResults.entries()]
    .filter(([_, evidence]) => !evidence.passed);

  if (failedMembers.length > 0) {
    return {
      continue: false,
      reason: `Members failed quality gate: ${failedMembers.map(([n]) => n).join(', ')}`,
    };
  }

  // 2. Check for cross-member conflicts
  if (teamEvidence.conflicts.length > 0) {
    return {
      continue: false,
      reason: `Unresolved conflicts: ${teamEvidence.conflicts.map(c => c.description).join('; ')}`,
    };
  }

  // 3. Run integration tests across all member outputs
  // (delegated to test-generator if present on team)

  return { continue: true };
}
```

### 4.3 Hook Migration Summary

| Current Hook | Agent Teams Equivalent | Migration |
|---|---|---|
| `subagent-start/task-linker` | `team/team-member-start` | New hook, same logic |
| `subagent-stop/task-completer` | `team/team-member-complete` | New hook, adds synthesis trigger |
| `subagent-start/context-gate` | `team/team-size-gate` | New hook, team-aware limits |
| `subagent-stop/subagent-quality-gate` | `team/team-quality-gate` | New hook, aggregate validation |
| `subagent-start/subagent-validator` | N/A — teammates validate via CLAUDE.md | Already handled |
| `subagent-start/graph-memory-inject` | N/A — teammates load MCP servers | Already handled |
| `subagent-start/mem0-memory-inject` | N/A — teammates load MCP servers | Already handled |
| `subagent-stop/retry-handler` | Lead manages retries via messaging | Pattern change (see 4.4) |
| `subagent-stop/handoff-preparer` | Teammates message directly | No longer needed |

### 4.4 Retry Pattern Change

**Current:** `retry-handler` hook catches agent failure, respawns with backoff.

**Agent Teams:** Lead detects teammate failure via idle notification. Lead either:
1. Messages teammate to retry
2. Shuts down teammate and spawns replacement
3. Reassigns task to another available teammate

```
Lead receives: "backend-system-architect stopped with errors"

Lead decision tree:
  ├─ Transient error? → Message teammate: "Retry the database migration step"
  ├─ Persistent error? → Shut down + spawn replacement
  └─ Alternative agent? → Spawn database-engineer as replacement
```

---

## 5. Skill Injection for Teammates

### 5.1 How It Works Today (Subagents)

When the Task tool spawns a subagent with `subagent_type="frontend-ui-developer"`, CC loads the agent definition and auto-injects all skills from the agent's frontmatter. The `subagent-context-stager` hook adds additional context.

### 5.2 How It Works with Agent Teams

Teammates are full CC sessions. They load project context (CLAUDE.md, MCP, plugins) at startup. **This means:**

- OrchestKit plugin is already installed → teammates get all 199 skills
- Agent-scoped hooks fire based on teammate behavior
- Skills auto-suggest via UserPromptSubmit hooks

**But teammates don't have an `agent_type`** — they're generic CC sessions, not typed subagents.

### 5.3 Solution: Teammate CLAUDE.md Injection

The lead's spawn prompt should include the agent's directive and skill list:

```
Spawn a teammate named "backend-architect" with the prompt:

"## Your Agent Profile
You are the backend-system-architect. {full agent directive from frontmatter}

## Your Skills
You have expertise in: api-design-framework, database-schema-designer,
error-handling-rfc9457, rate-limiting, auth-patterns, ...

## Your Task
Design the API for user profile management.

## Coordination
Message frontend-ui-developer when API contract is ready."
```

The teammate's own hooks will further enrich context via skill auto-suggestion.

### 5.4 Future: Agent Teams + Agent Types

If CC adds `agent_type` support for teammates (spawn a teammate AS a specific agent), the mapping becomes direct:

```
Spawn teammate backend-system-architect using agent src/agents/backend-system-architect.md
```

This would be the ideal integration point. Track CC changelog for this capability.

---

## 6. Worktree Strategy for Teams

Agent Teams docs warn: "Two teammates editing the same file leads to overwrites."

### 6.1 Proposed: Per-Teammate Worktrees

```bash
# Lead sets up worktrees during Phase 3
git worktree add ../orchestkit-backend feat/profile-backend
git worktree add ../orchestkit-frontend feat/profile-frontend
git worktree add ../orchestkit-tests feat/profile-tests

# Each teammate works in its own worktree
backend-system-architect → ../orchestkit-backend/
frontend-ui-developer    → ../orchestkit-frontend/
test-generator           → ../orchestkit-tests/
```

### 6.2 Merge Strategy

After all teammates complete:

```bash
# Lead merges worktrees back
git checkout feat/profile
git merge feat/profile-backend
git merge feat/profile-frontend
git merge feat/profile-tests
# Resolve conflicts if any
git worktree remove ../orchestkit-backend
git worktree remove ../orchestkit-frontend
git worktree remove ../orchestkit-tests
```

### 6.3 When Worktrees Aren't Needed

- Teammates working on non-overlapping files (security audit reads only)
- Research/review tasks (no file writes)
- Single-file ownership is clear from task description

---

## 7. Cost Model

### 7.1 Token Cost Comparison

| Scenario | Task Tool (subagents) | Agent Teams |
|---|---|---|
| Simple feature (3 agents) | ~150K tokens | ~400K tokens |
| Full-stack feature (8 agents) | ~500K tokens | ~1.2M tokens |
| Product thinking (6 agents) | ~300K tokens | ~800K tokens |

Agent Teams cost ~2.5-3x more because each teammate is a full CC session with its own context window, CLAUDE.md loading, and hook execution.

### 7.2 When the Cost Is Justified

- Cross-agent communication saves rework (frontend doesn't build wrong API shape)
- Parallel exploration reduces wall-clock time
- Competing hypotheses in debugging find root cause faster
- Team evidence is higher quality than individual agent evidence

### 7.3 Cost Controls

```typescript
const COST_CONTROLS = {
  // Use haiku for simple teammates (test runner, linter)
  modelByRole: {
    'architect': 'opus',
    'implementer': 'sonnet',
    'reviewer': 'haiku',
    'tester': 'sonnet',
  },

  // Limit teammate lifetime
  maxTurnsPerTeammate: 50,

  // Encourage early completion
  idleTimeoutMs: 300_000, // 5 min idle → suggest shutdown
};
```

---

## 8. Prototype Plan

### Phase 1: Foundation (P3-A.1)

**Goal:** Prove Agent Teams works with OrchestKit's simplest pipeline.

**Target pipeline:** Pipeline 4 — Security Audit (3 agents, read-only, no file conflicts)

```
Team "security-audit-{timestamp}":

  security-auditor:
    "Run OWASP Top 10 scan on src/. Share critical findings with
     security-layer-auditor and ai-safety-auditor immediately."

  security-layer-auditor:
    "Verify defense-in-depth across 8 layers. When security-auditor
     shares findings, validate whether layers contain the threat."

  ai-safety-auditor:
    "Audit LLM integration security. Cross-reference with
     security-auditor findings for prompt injection risks."

  Lead (delegate mode):
    "Wait for all three auditors. Synthesize into unified report.
     Highlight any disagreements between auditors."
```

**Deliverables:**
- [x] Enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in dev (`.claude/settings.json` → `env`)
- [x] Create `src/skills/implement/references/agent-teams-security-audit.md` with team prompt template
- [x] Test: team forms, members communicate, results synthesize (2026-02-06: 3-agent audit of src/hooks/)
- [ ] Measure: token cost vs 3x Task tool spawns (audit report saved to docs/audits/)
- [x] Validate: PreToolUse hooks fire for each teammate (confirmed: all hooks active per-teammate)

### Phase 2: Hooks (P3-A.2)

**Goal:** Build team lifecycle hooks.

**Deliverables:**
- [x] `src/hooks/src/posttool/task/team-member-start.ts` — link teammates to tasks (PostToolUse[Task])
- [x] `src/hooks/src/teammate-idle/team-synthesis-trigger.ts` — detect all-idle + suggest synthesis (TeammateIdle)
- [x] `src/hooks/src/pretool/task/team-size-gate.ts` — enforce team limits (PreToolUse[Task])
- [x] `src/hooks/src/teammate-idle/team-quality-gate.ts` — aggregate quality signals (TeammateIdle)
- [x] Register in `hooks.json`, rebuild bundles (91 global, 119 total)
- [x] Tests for all new hooks (36 tests across 4 files)

### Phase 3: Full-Stack Pipeline (P3-A.3)

**Goal:** Migrate Pipeline 2 (Full-Stack Feature) to Agent Teams.

**Deliverables:**
- [ ] Per-teammate worktree setup
- [ ] Cross-agent messaging for API contract handoff
- [ ] Integration testing across worktrees
- [ ] Lead synthesis and merge
- [ ] Cost comparison report

### Phase 4: `/ork:implement` Integration (P3-A.4)

**Goal:** Dual-mode orchestration in the implement skill.

**Deliverables:**
- [ ] Complexity-based routing (Task tool vs Agent Teams)
- [ ] Update `src/skills/implement/SKILL.md` with team formation phases
- [ ] Update `src/skills/multi-agent-orchestration/SKILL.md` with Agent Teams patterns
- [ ] User override: `ORCHESTKIT_PREFER_TEAMS=1`
- [ ] Graceful fallback when Agent Teams is disabled

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent Teams API changes (research preview) | High | High | Dual-mode — Task tool always available as fallback |
| Teammates don't fire OrchestKit hooks correctly | Medium | High | Phase 1 validates hook behavior before building on it |
| File conflicts between teammates | Medium | Medium | Worktree strategy; read-only roles for reviewers |
| Token cost explosion | High | Medium | Cost controls, model routing by role, team size limits |
| Teammates ignore coordination protocol | Medium | Medium | Spawn prompt includes explicit protocol; lead monitors |
| Team cleanup failures (orphaned sessions) | Medium | Low | Session cleanup hook; tmux session monitoring |
| Skill injection incomplete for teammates | Low | Medium | Teammates load full plugin; spawn prompt adds agent directive |

---

## 10. Success Metrics

| Metric | Current (Task tool) | Target (Agent Teams) |
|---|---|---|
| Cross-agent rework rate | ~15% (wrong API shapes) | < 5% |
| Wall-clock time (full-stack feature) | Phases sequential | 30-40% faster |
| Quality gate pass rate (first attempt) | ~70% | > 85% |
| Token cost | Baseline | < 3x baseline |
| Developer satisfaction | Good | Better (less rework) |

---

## 11. Dependencies

- **Hard:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be available and stable
- **Hard:** Teammates must load CLAUDE.md and OrchestKit plugin
- **Soft:** CC support for `agent_type` on teammates (ideal but not required)
- **Soft:** CC support for teammate-scoped hooks (currently all hooks fire globally)
- **Related:** #336 (Cross-tool knowledge distribution) — Agent HQ compatibility

---

## 12. Decision Log

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Dual-mode (not replace) | Keep Task tool + add Teams | Replace Task tool entirely | Teams is research preview; fallback essential |
| Complexity-based routing | Auto-select mode by score | Always ask user | Reduces friction; user can override |
| Worktrees for file isolation | Per-teammate worktrees | File locking; directory ownership | Git-native; clean merge path |
| Delegate mode for lead | Always delegate | Lead implements too | Prevents lead/teammate conflicts |
| Start with security audit | Pipeline 4 first | Pipeline 2 (full-stack) first | Read-only = no file conflicts = safest prototype |

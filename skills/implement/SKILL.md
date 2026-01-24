---
name: implement
description: Full-power feature implementation with parallel subagents, skills, and MCPs. Use when implementing features, building features, creating features, or developing features.
context: fork
version: 2.0.0
author: OrchestKit
tags: [implementation, feature, full-stack, parallel-agents, reflection, worktree]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__context7__query-docs, mcp__mem0__add-memory, mcp__memory__search_nodes]
skills: [api-design-framework, react-server-components-framework, type-safety-validation, unit-testing, integration-testing, explore, verify, recall, worktree-coordination]
---

# Implement Feature

Maximum utilization of parallel subagent execution for feature implementation with built-in scope control and reflection.

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main implementation task IMMEDIATELY
TaskCreate(
  subject="Implement: {feature}",
  description="Full-stack implementation with parallel agents",
  activeForm="Implementing {feature}"
)

# 2. Create subtasks for each phase (10-phase process)
TaskCreate(subject="Research best practices", activeForm="Researching best practices")
TaskCreate(subject="Design architecture", activeForm="Designing architecture")
TaskCreate(subject="Micro-plan each task", activeForm="Creating micro-plans")
TaskCreate(subject="Setup git worktree (optional)", activeForm="Setting up worktree")
TaskCreate(subject="Implement backend", activeForm="Implementing backend")
TaskCreate(subject="Implement frontend", activeForm="Implementing frontend")
TaskCreate(subject="Write tests", activeForm="Writing tests")
TaskCreate(subject="Integration verification", activeForm="Verifying integration")
TaskCreate(subject="Scope creep check", activeForm="Checking for scope creep")
TaskCreate(subject="Post-implementation reflection", activeForm="Reflecting on implementation")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Discovery & Planning** | Research, break into tasks | Task list |
| **2. Micro-Planning** | Detailed plan per task | Micro-plans |
| **3. Worktree Setup** | Isolate in git worktree (optional) | Clean workspace |
| **4. Architecture Design** | 5 parallel agents | Design specs |
| **5. Implementation** | 8 parallel agents | Working code |
| **6. Integration & Validation** | 4 parallel agents | Tested code |
| **7. Scope Creep Check** | Compare vs original scope | Scope report |
| **8. E2E Verification** | Browser testing | Evidence |
| **9. Documentation** | Save decisions to memory | Persisted knowledge |
| **10. Reflection** | What worked, what didn't | Lessons learned |

---

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

---

## Phase 2: Micro-Planning Per Task (NEW)

**Goal:** Create detailed mini-plans for each task BEFORE implementation.

### Micro-Plan Template

For each task from Phase 1, create a micro-plan:

```markdown
## Micro-Plan: [Task Name]

### Scope (What's IN)
- [ ] Specific change 1
- [ ] Specific change 2
- [ ] Test for change 1
- [ ] Test for change 2

### Out of Scope (What's NOT in this task)
- Feature X (separate task)
- Optimization Y (future task)

### Files to Touch
| File | Change Type | Description |
|------|-------------|-------------|
| path/file.py | CREATE | New service class |
| path/test.py | CREATE | Tests for service |
| path/api.py | MODIFY | Add endpoint |

### Acceptance Criteria
- [ ] Tests pass
- [ ] Lint clean
- [ ] Types valid
- [ ] Manually verified

### Estimated Time
[X] minutes / hours
```

### Why Micro-Planning Matters

| Without Micro-Plan | With Micro-Plan |
|-------------------|-----------------|
| Scope expands mid-task | Clear boundaries upfront |
| "While I'm here..." syndrome | Disciplined focus |
| Unclear completion criteria | Defined acceptance |
| Time estimates way off | Realistic estimates |

---

## Phase 3: Git Worktree Isolation (Optional but Recommended)

**Goal:** Isolate feature work in a dedicated worktree to avoid polluting main workspace.

### When to Use Worktrees

| Scenario | Use Worktree? |
|----------|---------------|
| Large feature (5+ files) | YES |
| Experimental/risky changes | YES |
| Quick bug fix (1-2 files) | No |
| Hotfix to production | YES |
| Parallel feature development | YES |

### Worktree Setup

```bash
# Create feature worktree
git worktree add ../project-feature-name feature/feature-name

# Navigate to worktree
cd ../project-feature-name

# Work in isolation...

# When done, merge and cleanup
git checkout main
git merge feature/feature-name
git worktree remove ../project-feature-name
```

### Worktree Benefits

- **Isolation:** Changes don't affect main workspace
- **Parallel work:** Multiple features simultaneously
- **Clean rollback:** Easy to discard entire feature
- **Context switching:** Instant switch between features

---

## Phase 4: Parallel Architecture Design (5 Agents)

Launch ALL 5 agents in ONE Task message with `run_in_background: true`:

| Agent | Focus |
|-------|-------|
| workflow-architect | Architecture planning, dependency graph |
| backend-system-architect | API, services, database |
| frontend-ui-developer | Components, state, hooks |
| llm-integrator | LLM integration (if needed) |
| ux-researcher | User experience, accessibility |

```python
# PARALLEL - All agents in ONE message
Task(
  subagent_type="workflow-architect",
  prompt="""ARCHITECTURE DESIGN for: $ARGUMENTS

  Design system architecture:
  1. Component breakdown and boundaries
  2. Data flow between components
  3. Integration points and dependencies
  4. Implementation order (dependency graph)

  SUMMARY: End with: "RESULT: [N] components, [M] integrations - [key pattern]"
  """,
  run_in_background=True
)
# ... (other agents as in original)
```

## Phase 5: Parallel Implementation (8 Agents)

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

## Phase 6: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| security-auditor | Security audit |

---

## Phase 7: Scope Creep Detector (NEW)

**Goal:** Compare implementation against original scope to catch unplanned additions.

### Scope Creep Check Process

```python
Task(
  subagent_type="workflow-architect",
  prompt="""SCOPE CREEP DETECTION for: $ARGUMENTS

  Compare implementation against original micro-plans:

  1. PLANNED vs ACTUAL FILES
     - Files that were planned
     - Files actually modified
     - Unplanned file changes?

  2. PLANNED vs ACTUAL FEATURES
     - Features in original scope
     - Features actually implemented
     - Unplanned features added?

  3. SCOPE CREEP INDICATORS
     - "While I'm here..." changes
     - Premature optimization
     - Goldplating (unnecessary polish)
     - Refactoring outside scope

  4. IMPACT ASSESSMENT
     - Time spent on unplanned work
     - Risk introduced by unplanned changes
     - Testing gaps from scope expansion

  Output:
  {
    "planned_files": N,
    "actual_files": M,
    "unplanned_changes": ["file - change type - justification needed"],
    "scope_creep_score": 0-10 (0=perfect, 10=major creep),
    "recommendations": ["action"]
  }

  SUMMARY: End with: "SCOPE: [score]/10 creep - [N] unplanned changes - [key issue]"
  """,
  run_in_background=True
)
```

### Scope Creep Response

| Score | Level | Action |
|-------|-------|--------|
| 0-2 | Minimal | Proceed to reflection |
| 3-5 | Moderate | Document unplanned changes, justify or revert |
| 6-8 | Significant | Review with user, potentially split into separate PR |
| 9-10 | Major | Stop, reassess, likely need to split work |

---

## Phase 8: E2E Verification

If UI changes, verify with agent-browser:

```bash
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot /tmp/feature.png
agent-browser close
```

## Phase 9: Documentation

Save implementation decisions to memory MCP for future reference:

```python
mcp__mem0__add-memory(content="Implementation decisions...", userId="project-decisions")
```

---

## Phase 10: Post-Implementation Reflection (NEW)

**Goal:** Capture lessons learned while context is fresh.

### Reflection Questions

After implementation is complete and verified, answer these questions:

```python
Task(
  subagent_type="workflow-architect",
  prompt="""POST-IMPLEMENTATION REFLECTION for: $ARGUMENTS

  Reflect on the implementation process:

  1. WHAT WENT WELL
     - Approaches that worked smoothly
     - Good decisions made
     - Time-saving patterns used

  2. WHAT COULD BE IMPROVED
     - Pain points encountered
     - Decisions that had to be revised
     - Time sinks

  3. ESTIMATION ACCURACY
     - Original estimate: [X]
     - Actual time: [Y]
     - Variance reason: [why]

  4. REUSABLE PATTERNS
     - Patterns worth extracting to skills
     - Code worth making into utilities
     - Documentation worth adding

  5. TECHNICAL DEBT
     - Shortcuts taken (with justification)
     - TODOs left behind
     - Known limitations

  6. KNOWLEDGE GAPS DISCOVERED
     - Things we didn't know at start
     - Research needed mid-implementation
     - Skills/tools to learn for future

  Output:
  {
    "went_well": ["item"],
    "improvements": ["item"],
    "estimate_accuracy": "X%",
    "reusable_patterns": ["pattern - where to use"],
    "tech_debt": ["debt - priority - plan"],
    "knowledge_gaps": ["gap - how filled"]
  }

  SUMMARY: End with: "REFLECTION: [estimate accuracy]% accuracy - [key lesson]"
  """,
  run_in_background=True
)
```

### Persist Lessons Learned

```python
# Store in memory for future implementations
mcp__memory__create_entities(entities=[{
  "name": "{feature}-lessons-learned",
  "entityType": "Reflection",
  "observations": [
    "Lesson 1: ...",
    "Lesson 2: ...",
    "Pattern to reuse: ..."
  ]
}])
```

---

## Continuous Feedback Loop (NEW)

Throughout implementation, maintain a feedback loop:

### After Each Task Completion

```python
# Quick checkpoint after each task
print(f"""
TASK CHECKPOINT: {task_name}
- Completed: {what_was_done}
- Tests: {pass/fail}
- Time: {actual} vs {estimated}
- Blockers: {any issues}
- Scope changes: {any deviations}
""")

# Update task status
TaskUpdate(taskId=task_id, status="completed")
```

### Feedback Triggers

| Trigger | Action |
|---------|--------|
| Task takes 2x estimated time | Pause, reassess scope |
| Test keeps failing | Consider design issue, not just implementation |
| Scope creep detected | Stop, discuss with user |
| Blocker found | Create blocking task, switch to parallel work |

---

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
- Micro-plan before implementing
- Detect and address scope creep
- Reflect and capture lessons learned

---

**Version:** 2.0.0 (January 2026)

**v2.0.0 Enhancements:**
- Added **Micro-Planning Per Task**: Detailed scope and acceptance criteria before implementation
- Added **Git Worktree Isolation**: Optional clean workspace for feature development
- Added **Scope Creep Detector**: Compare implementation vs original scope (0-10 score)
- Added **Continuous Feedback Loop**: Checkpoints after each task completion
- Added **Post-Implementation Reflection**: Capture lessons learned, estimate accuracy, reusable patterns
- Expanded from 7-phase to 10-phase process

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Micro-planning | Required per task | Prevents scope creep, improves estimates |
| Worktree isolation | Optional, recommended for large features | Clean workspace, easy rollback |
| Scope creep scoring | 0-10 scale with action thresholds | Quantifiable, actionable |
| Reflection phase | Required, not optional | Learning compounds over time |
| Continuous feedback | Checkpoint after each task | Early detection of issues |

## Related Skills
- explore: Explore codebase before implementing
- verify: Verify implementations work correctly
- worktree-coordination: Git worktree management patterns

## References

- [Agent Phases](references/agent-phases.md)

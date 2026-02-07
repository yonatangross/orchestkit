# Agent Teams Phase Alternatives

This reference consolidates Agent Teams mode instructions for Phases 4, 5, 6, and 6b of the implement workflow.

## Phase 4 — Agent Teams Architecture Design

In Agent Teams mode, form a team instead of spawning 5 independent Tasks. Teammates message architecture decisions to each other in real-time:

```python
TeamCreate(team_name="implement-{feature-slug}", description="Architecture for {feature}")

# Spawn 4 teammates (5th role — UX — is lead-managed or optional)
Task(subagent_type="backend-system-architect", name="backend-architect",
     team_name="implement-{feature-slug}",
     prompt="Design backend architecture. Message frontend-dev when API contract ready.")

Task(subagent_type="frontend-ui-developer", name="frontend-dev",
     team_name="implement-{feature-slug}",
     prompt="Design frontend architecture. Wait for API contract from backend-architect.")

Task(subagent_type="test-generator", name="test-engineer",
     team_name="implement-{feature-slug}",
     prompt="Plan test strategy. Start fixtures immediately, tests as contracts stabilize.")

Task(subagent_type="code-quality-reviewer", name="code-reviewer",
     team_name="implement-{feature-slug}",
     prompt="Review architecture decisions as they're shared. Flag issues to author directly.")
```

See [Agent Teams Full-Stack Pipeline](agent-teams-full-stack.md) for complete spawn prompts and messaging templates.

> **Fallback:** If team formation fails, fall back to 5 independent Task spawns (standard Phase 4).

---

## Phase 5 — Agent Teams Implementation

In Agent Teams mode, teammates are already formed from Phase 4. They transition from architecture to implementation and message contracts to each other:

- **backend-architect** implements the API and messages `frontend-dev` with the contract (types + routes) as soon as endpoints are defined — not after full implementation.
- **frontend-dev** starts building UI layout immediately, then integrates API hooks once the contract arrives.
- **test-engineer** writes tests incrementally as contracts stabilize. Reports failing tests directly to the responsible teammate.
- **code-reviewer** reviews code as it lands. Flags issues to the author directly.

Optionally set up per-teammate worktrees to prevent file conflicts:

```python
# Lead sets up worktrees (for features with > 5 files)
Bash("git worktree add ../{project}-backend feat/{feature}/backend")
Bash("git worktree add ../{project}-frontend feat/{feature}/frontend")
Bash("git worktree add ../{project}-tests feat/{feature}/tests")

# Include worktree path in teammate messages
SendMessage(type="message", recipient="backend-architect",
    content="Work in ../{project}-backend/. Commit to feat/{feature}/backend.")
```

See [Team Worktree Setup](team-worktree-setup.md) for complete worktree guide.

> **Fallback:** If teammate coordination breaks down, shut down the team and fall back to 5 independent Task spawns (standard Phase 5).

---

## Phase 6 — Agent Teams Integration

In Agent Teams mode, the code-reviewer teammate has already been reviewing code during implementation (Phase 5). Integration verification is lighter:

- **code-reviewer** produces final APPROVE/REJECT verdict based on cumulative review.
- **Lead** runs integration tests across the merged codebase (or merged worktrees).
- No need for separate security-auditor spawn — code-reviewer covers security checks. For high-risk features, spawn a `security-auditor` teammate in Phase 4.

```python
# Lead runs integration after merging worktrees
Bash("npm test && npm run typecheck && npm run lint")

# Collect code-reviewer verdict
SendMessage(type="message", recipient="code-reviewer",
    content="All code merged. Please provide final APPROVE/REJECT verdict.")
```

> **Fallback:** If code-reviewer verdict is unclear, fall back to 4 independent Task spawns (standard Phase 6).

---

## Phase 6b — Team Teardown (Agent Teams Only)

After Phase 6 completes in Agent Teams mode, tear down the team:

### 1. Merge Worktrees (if used)

```bash
git checkout feat/{feature}
git merge --squash feat/{feature}/backend && git commit -m "feat({feature}): backend"
git merge --squash feat/{feature}/frontend && git commit -m "feat({feature}): frontend"
git merge --squash feat/{feature}/tests && git commit -m "test({feature}): test suite"
```

### 2. Shut Down Teammates

```python
SendMessage(type="shutdown_request", recipient="backend-architect",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="frontend-dev",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="test-engineer",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="code-reviewer",
    content="Implementation complete, shutting down team.")
```

### 3. Clean Up

```python
TeamDelete()  # Remove team and shared task list

# Clean up worktrees (if used)
Bash("git worktree remove ../{project}-backend")
Bash("git worktree remove ../{project}-frontend")
Bash("git worktree remove ../{project}-tests")
Bash("git branch -d feat/{feature}/backend feat/{feature}/frontend feat/{feature}/tests")
```

> Phases 7-10 (Scope Creep, E2E Verification, Documentation, Reflection) are the same in both modes — the team is already disbanded.

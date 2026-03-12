---
title: Subagents must only modify files within their assigned scope — prevent cross-agent conflicts
impact: HIGH
impactDescription: "When parallel agents modify overlapping files, one agent's writes silently overwrite another's — causing lost implementation work and merge conflicts"
tags: [agents, scope, parallel, containment, isolation, conflicts]
---

## Agent Scope Containment

Each subagent spawned in Phase 4-5 must receive an explicit file scope boundary in its prompt. Agents must NOT modify files outside their assigned scope. This prevents parallel agents from overwriting each other's work.

### Problem

Claude spawns parallel agents (backend, frontend, test-generator) without defining which files each agent owns. Two agents edit the same file — the last one to finish silently overwrites the first. This is especially dangerous without worktree isolation.

### Scope Assignment

Define non-overlapping scopes in Phase 2 (Micro-Planning):

```python
scopes = {
    "backend-system-architect": {
        "owns": ["src/api/", "src/services/", "src/models/"],
        "reads": ["src/types/", "src/config/"],
        "forbidden": ["src/components/", "src/pages/", "tests/"]
    },
    "frontend-ui-developer": {
        "owns": ["src/components/", "src/pages/", "src/hooks/"],
        "reads": ["src/types/", "src/api/client.ts"],
        "forbidden": ["src/api/routes/", "src/services/", "src/models/"]
    },
    "test-generator": {
        "owns": ["tests/", "__tests__/", "*.test.*", "*.spec.*"],
        "reads": ["src/"],
        "forbidden": []  # Can read everything, writes only to test dirs
    }
}
```

**Incorrect — no scope boundaries in agent prompts:**
```python
# Phase 5: Agents with overlapping scope
Agent(subagent_type="backend-system-architect",
  prompt="Implement the user auth feature",
  run_in_background=True)
Agent(subagent_type="frontend-ui-developer",
  prompt="Implement the user auth feature",
  run_in_background=True)
# Both agents edit src/types/user.ts — last write wins, first is lost
# Both create src/utils/validation.ts — silent overwrite
```

**Correct — explicit scope in every agent prompt:**
```python
# Phase 5: Agents with strict scope boundaries
Agent(subagent_type="backend-system-architect",
  prompt="""Implement backend for user auth.
  YOUR SCOPE (only modify these): src/api/, src/services/, src/models/
  SHARED TYPES (read-only): src/types/
  DO NOT TOUCH: src/components/, src/pages/, tests/
  If you need a shared type, create it in src/types/auth.types.ts""",
  run_in_background=True)

Agent(subagent_type="frontend-ui-developer",
  prompt="""Implement frontend for user auth.
  YOUR SCOPE (only modify these): src/components/, src/pages/, src/hooks/
  SHARED TYPES (read-only): src/types/
  DO NOT TOUCH: src/api/routes/, src/services/, src/models/
  Import API client from src/api/client.ts — do not modify it""",
  run_in_background=True)
```

### Shared File Protocol

For files both agents need (e.g., shared types):

1. Assign ONE agent as the owner of each shared file
2. Other agents may only read it
3. If both need to add types, use separate files: `auth.types.ts` (backend), `auth-ui.types.ts` (frontend)

### Key Rules

- Include explicit scope boundaries in every subagent prompt
- Log scope assignments in `02-plan.json` handoff for traceability
- After all agents complete, check for conflicting writes to the same file
- Prefer worktree isolation (`isolation: "worktree"`) to eliminate conflicts entirely
- If an agent violates scope, discard its out-of-scope changes and re-run

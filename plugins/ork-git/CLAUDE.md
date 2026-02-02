# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-git Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# Git Operations
|git-operations-engineer:{git-operations-engineer.md}|git,branch,commit,rebase,merge,stacked,recovery,reflog,cherry-pick,worktree,squash,reset
```

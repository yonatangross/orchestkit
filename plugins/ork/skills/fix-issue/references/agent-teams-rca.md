# Agent Teams RCA Workflow

In Agent Teams mode, form an investigation team where RCA agents share hypotheses and evidence in real-time:

```python
# CC 2.1.178+: one implicit team per session — no TeamCreate.
# Spawn teammates directly via Agent(name=...). Requires
# CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (set in ork.settings.json).

Agent(subagent_type="ork:debug-investigator", name="root-cause-tracer",
     team_name="fix-issue-{number}",
     prompt="""Trace the root cause for issue #{number}: {issue description}
     Hypotheses: {hypothesis list from Phase 3}
     Test each hypothesis. When you find evidence supporting or refuting a hypothesis,
     message impact-analyst and the relevant domain expert (backend-expert or frontend-expert).
     If you find conflicting evidence, share it with ALL teammates for debate.""")

Agent(subagent_type="ork:debug-investigator", name="impact-analyst",
     team_name="fix-issue-{number}",
     prompt="""Analyze the impact and blast radius for issue #{number}.
     When root-cause-tracer shares evidence, assess how many code paths are affected.
     Message test-planner with affected paths so they can plan regression tests.
     If the impact is larger than expected, message the lead immediately.""")

Agent(subagent_type="ork:backend-system-architect", name="backend-expert",
     team_name="fix-issue-{number}",
     prompt="""Investigate backend aspects of issue #{number}.
     When root-cause-tracer shares backend-related hypotheses, design the fix approach.
     Message frontend-expert if the fix affects API contracts.
     Share fix design with test-planner for test requirements.""")

Agent(subagent_type="ork:frontend-ui-developer", name="frontend-expert",
     team_name="fix-issue-{number}",
     prompt="""Investigate frontend aspects of issue #{number}.
     When root-cause-tracer shares frontend-related hypotheses, design the fix approach.
     If backend-expert changes API contracts, adapt the frontend fix accordingly.
     Share component changes with test-planner.""")

Agent(subagent_type="ork:test-generator", name="test-planner",
     team_name="fix-issue-{number}",
     prompt="""Plan regression tests for issue #{number}.
     When root-cause-tracer confirms the root cause, write a failing test that reproduces it.
     When backend-expert or frontend-expert share fix designs, plan verification tests.
     Start with the regression test BEFORE the fix is applied (TDD approach).""")
```

**Team teardown** after fix is implemented and validated:
```python
# CC 2.1.178+: no TeamDelete — teammates wind down at turn end
# (press Ctrl+F twice to stop lingering background teammates).

# Worktree cleanup (CC 2.1.72)
ExitWorktree(action="keep")
```

> **Fallback:** If team formation fails, use standard Phase 4 Task spawns.

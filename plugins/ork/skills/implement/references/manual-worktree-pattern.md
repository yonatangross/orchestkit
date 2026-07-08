# Manual Pre-Create Worktree Pattern

> **⚠ SUPERSEDED — CC 2.1.154, completed in CC 2.1.203.** Upstream fixed the root
> cause: *"subagents in background sessions bypassing the worktree-isolation guard
> and writing to the shared checkout"* (CC 2.1.154 changelog). On CC ≥ 2.1.154 you
> can use `Agent(isolation="worktree")` directly — parallel spawns each get a real
> isolated worktree, no HEAD thrash. 2.1.154 also fixed `worktree.baseRef:"head"`
> resolving to the main checkout's HEAD instead of the current worktree's when
> spawning from inside a linked worktree. **The 2.1.154 fix was partial:** a
> residual leak — isolated subagents *sometimes running shell commands in the
> parent checkout* (the exact symptom in "The bug" below: `git checkout` firing on
> the primary tree) — persisted through CC 2.1.202 and was closed in **CC 2.1.203**.
> **Prefer `isolation="worktree"` now;** the manual pre-create pattern below is
> retained for CC ≤ 2.1.153, as a partial mitigation on 2.1.154–2.1.202, and as a
> record of the original failure.

**Original context — workaround for the broken `Agent(isolation="worktree")`
behavior in CC ≤ 2.1.153.** Tracked at
[Yonatan-HQ/platform#3224](https://github.com/Yonatan-HQ/platform/issues/3224).

## TL;DR

Don't use `isolation="worktree"` on parallel agent spawns. Instead:

1. The **lead** creates one worktree per agent BEFORE spawning, using
   `git worktree add -b <branch> <path> origin/main`.
2. Each agent prompt starts with `FIRST: cd <worktree-path>. THEN ...`.
3. Each agent commits + pushes + opens a PR from its own worktree.

Result: 4-22 tool-uses per agent (vs 60-86 with broken isolation),
one-run completion, zero HEAD thrash.

## The bug

Spawned 4 parallel background agents on 2026-05-11 22:30 IDT with:

```python
Agent(subagent_type="<agent-a>", isolation="worktree", run_in_background=true)
Agent(subagent_type="<agent-b>", isolation="worktree", run_in_background=true)
Agent(subagent_type="<agent-c>", isolation="worktree", run_in_background=true)
Agent(subagent_type="<agent-d>", isolation="worktree", run_in_background=true)
```

**Expected:** Each agent operates in its own isolated worktree.

**Actual:** `git reflog` on the primary worktree showed:

```
checkout: moving from <branch-a> to <branch-b>
checkout: moving from <branch-b> to <branch-c>
checkout: moving from <branch-c> to <branch-d>
```

Sequential `git checkout` calls on the PRIMARY worktree. Each agent's
untracked files got auto-stashed when the next agent's checkout fired.
Three of four agents hit the ~60-tool-use cliff before push because
their `pnpm install` / `pre-push` hooks failed against thrashed
`node_modules`.

## The fix (Wave 2 / 3 pattern from M164)

Pre-creating worktrees from the LEAD context, before the agents start:

```python
backend_wt = setup_agent_worktree(REPO, SLUG, f"feat/{SLUG}-backend")
frontend_wt = setup_agent_worktree(REPO, SLUG, f"feat/{SLUG}-frontend")
tests_wt = setup_agent_worktree(REPO, SLUG, f"feat/{SLUG}-tests")
```

Then spawning with **no** `isolation` param, but with an explicit `cd`
as the first instruction:

```python
Agent(subagent_type="ork:backend-system-architect",
  prompt=f"FIRST: cd {backend_wt}. THEN implement backend: {feature}. "
         f"Commit + push + open PR from {backend_wt} when done.",
  run_in_background=true)
```

Result: M164 Wave 2/3 agents finished in 4-22 tool-uses each, one-run.
M164 Wave 1 (broken pattern) needed 60-86 tool-uses per agent and 3 of
4 hit cutoffs.

## Helper

```python
import subprocess

def setup_agent_worktree(repo_root: str, slug: str, branch: str) -> str:
    """Pre-create a worktree off origin/main; return absolute path."""
    path = f"{repo_root}/../{slug}-{branch.split('/')[-1]}"
    subprocess.run(
        ["git", "-C", repo_root, "worktree", "add",
         "-b", branch, path, "origin/main"],
        check=True,
    )
    return path
```

## Why this works

The bug appears to be in CC's `isolation` param handling — the param is
accepted but the worktree may not actually be created (or `cd`'d into)
before the agent's first Bash call fires. By the time the agent runs,
its CWD is still the primary tree. Manual pre-creation moves the
`worktree add` into the deterministic lead context BEFORE the agent
starts; the agent's prompt then explicitly `cd`s into the prepared
worktree.

## Constraints on the agent prompt

To make the pattern reliable:

1. **`cd` must be the FIRST Bash call.** Wrap it in a header like
   `FIRST: cd <path>. THEN: ...` so the agent can't skip it.
2. **Forbid touching the primary tree.** Add to the prompt: "Do not
   `cd` out of this worktree. All commits, pushes, and PRs originate
   from {worktree-path}."
3. **Push early.** Add: "As soon as you have a minimal working file +
   1 reference doc, commit + push + open PR. Iterate via follow-up
   commits." This converts the 60-tool cliff into an 18-22 first
   checkpoint.
4. **Explicit branch.** Always pass `-b feat/<slug>-<role>` to the
   `git worktree add` — never let the agent decide its own branch
   (collisions cause the original thrash).

## What this DOESN'T fix

- **Single-agent isolation:** if you only spawn ONE agent with
  `isolation="worktree"`, it MAY work — the bug surfaces under parallel
  spawns. Use the manual pattern anyway for consistency.
- **EnterWorktree (operator-level):** This is the model-managed,
  not-agent-managed worktree tool. It works fine and is unrelated.
- **The root-cause CC bug:** Filed as `#3224 Path A` if a fix is found
  upstream, this whole reference becomes deletable.

## Cleanup

After agents finish + PRs merge:

```bash
git worktree remove ../<slug>-backend --force
git worktree remove ../<slug>-frontend --force
git worktree remove ../<slug>-tests --force
git worktree prune
```

If a worktree has uncommitted local state when removing, capture or
discard explicitly — don't blindly `--force` away unmerged work.

## References

- `feedback_agent_worktree_isolation_unreliable.md` — original incident
- `Yonatan-HQ/platform#3224` — upstream tracking issue
- `Yonatan-HQ/platform#3132` — companion worktree-audit cron script

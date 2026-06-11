---
title: Cap changes per agent batch to prevent cascade failures
impact: HIGH
impactDescription: "Large sweeping changes (50+ files) hide which specific change broke what; small batches stay reversible"
tags: implement, batching, refactor, agents, cascade-prevention
---

## When This Rule Applies

Large refactors, sweeping renames, signature migrations, or any `ork:implement` run that will modify **more than 10 files**. Also applies when spawning subagents for tasks with broad scope.

## The Rule

**Default batch size: 5 files.** Configurable via `--batch-size N` argument to `/ork:implement`.

For every batch:

1. **Make the change** (Agent edits up to `N` files).
2. **Run the relevant tests** (`npm test -- <scope>` or framework equivalent).
3. **If green**: commit the batch with a descriptive message, proceed to next batch.
4. **If red**: stop. Do not proceed to the next batch. Debug with the failing batch still uncommitted. Fix the issue before touching more files.
5. **Never skip step 4** with `// TODO`, `# type: ignore`, or `eslint-disable` — those suppress the signal the batch was too large.

## Why

From usage analytics across 126 sessions: large one-shot refactors (176-file migrations, 91 exception narrowings) consistently produced cascade failures where one bad change created 50+ test regressions. Sessions that used small batches (≤5 files per cycle) had measurably better outcomes — faster root cause identification, fewer rollbacks, lower turn counts.

## Recognizing the Trigger

Before starting an implementation that touches multiple files, run a quick scope estimate:

```bash
# Estimate affected files
grep -rl "<pattern-to-replace>" src/ | wc -l
```

If count > 10, engage batch governance. If > 50, also consider whether the operation needs a pre-written migration script rather than agent-driven edits — at that scale, a scripted `sed` or `codemod` with a single careful review is usually cheaper than 10+ agent batches.

## Incorrect Pattern

```python
# Don't: one Agent call to rewrite 176 files
Agent(subagent_type="ork:backend-system-architect",
      prompt="Migrate all repository.py files to the new RepositoryBase pattern")
# Result: agent edits all 176, tests fail in 40 places, no clean rollback target
```

## Correct Pattern

```python
# Do: loop with tests between batches
files = find_affected_files(pattern)  # 176 files
for batch in chunks(files, size=5):
    Agent(subagent_type="ork:backend-system-architect",
          prompt=f"Migrate these 5 files to the new RepositoryBase pattern: {batch}")
    result = Bash("npm test -- src/repositories")
    if result.failed:
        break  # Stop. Debug with current batch uncommitted.
    Bash(f"git commit -am 'refactor: migrate batch {batch_num} to RepositoryBase'")
```

## Interaction With Effort Levels

- `low` / `medium`: batch size 3–5 (default).
- `high`: batch size 5.
- `xhigh` (Opus 4.8): batch size 5 with an extra validation pass per batch — re-read the just-edited files and verify the change matches the migration intent before running tests. Catches LLM-introduced inconsistencies the linter doesn't see.

## Argument

`/ork:implement --batch-size 3 migrate all repositories to RepositoryBase` overrides the default when a particularly risky operation warrants smaller steps.

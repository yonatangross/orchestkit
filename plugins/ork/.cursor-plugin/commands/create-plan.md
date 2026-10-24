---
description: "Writes an implementation plan as a file artifact in the task directory (.ork/tasks/TASK/NN-plan-SLUG.md) with phases, exact file changes and runnable success criteria, so reviewers comment on the file instead of in chat. Use when a task has its research done and needs a reviewable plan before code; pair with iterate-plan for revisions and review-artifact-comments for feedback."
argument-hint: "<task> [slug]"
user-invocable: true
name: create-plan
allowed-tools: "Bash Read Write Grep Glob"
---

# Auto-generated from skills/create-plan/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# create-plan

Turn what is known about a task into one plan file that a person can review line by line. The plan
lives in the task directory, and comments are written into the file, so the review history stays
with the plan and survives a new session.

The layout (path, file name, front matter, comment block, the "done" signal) is fixed in
[skills/create-plan/references/artifact-layout.md](skills/create-plan/references/artifact-layout.md). Only `skills/create-plan/scripts/artifact.mjs` writes
the front matter.

## Steps

1. **Find the task directory.** Ask for the task name if it was not given (kebab-case, one per
   branch, issue or lane). List what is already there:

   ```bash
   node "skills/create-plan/scripts/artifact.mjs" status --task-dir .ork/tasks/<task>
   ```

2. **Read every artifact in it in full**, in NN order: research, earlier plans, and their comment
   blocks. Open comments on an earlier artifact are requirements unless they were resolved.
3. **Read the code the research points at.** Every file the plan changes must be opened, so file
   paths and code in the plan are real.
4. **Write the body** to a scratch file, using
   [skills/create-plan/references/plan-template.md](skills/create-plan/references/plan-template.md). Each phase is testable on its own,
   names the files it changes, and ends with runnable automated checks.
5. **Create the artifact** through the script (never write the file directly):

   ```bash
   node "skills/create-plan/scripts/artifact.mjs" create \
     --task <task> --kind plan --slug <slug> --title "<title>" --author <your seat> --body /tmp/plan-body.md
   # prints .ork/tasks/<task>/NN-plan-<slug>.md
   ```

6. **Reply with the path and stop.** Ask the reviewer to comment in the file (or run
   `/ork:review-artifact-comments` after they do). Do not start implementing.

## Rules

- When documents disagree, the newest wins: plan over research over the original ask.
- Out of scope is a section, not an afterthought: list what the plan will not do.
- Manual checks only where a person really has to look; do not pad phases with them.
- A second plan for the same task is a new artifact (new NN), not an edit of the old one. Revising
  the same plan is `iterate-plan`.

## Related

- `iterate-plan`: revise this plan from review comments, keeping every comment.
- `create-research`: the research artifact this plan should read first.
- `review-artifact-comments`: read, answer and resolve comments on any artifact.

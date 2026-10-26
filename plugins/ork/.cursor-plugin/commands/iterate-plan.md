---
description: "Revises a plan written by create-plan from its review comments or new instructions: rewrites the plan body, leaves each comment intact and bumps the revision. Use when a plan file got feedback or its scope changed; never to start a new plan."
argument-hint: "<plan file> [instructions]"
user-invocable: true
name: iterate-plan
allowed-tools: "Bash Read Write Grep Glob"
---

# Auto-generated from skills/iterate-plan/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# iterate-plan

Revise one plan file. The body is rewritten; the comment block is kept byte for byte, because the
review record must outlive every revision. Layout: the create-plan skill's
`references/artifact-layout.md`.

## Steps

1. **Read the plan in full**, then the rest of its task directory in NN order (research, earlier
   plans). List the open comments:

   ```bash
   node "skills/iterate-plan/scripts/artifact.mjs" list --file <plan> --open
   ```

2. **Check each comment against the code before acting on it.** Open the files it names. A comment
   can be wrong; if so, say so in a reply instead of changing the plan.
3. **Write the revised body** to a scratch file: start from the current body (everything between the
   front matter and `<!-- ork:comments -->`), apply the changes, keep the phase structure. Do not
   copy the comment block into it; the script refuses a body that carries one.
4. **Write it back through the script**, which bumps `revision`, refreshes `sha` and `updated`, and
   keeps the comments:

   ```bash
   node "skills/iterate-plan/scripts/artifact.mjs" iterate --file <plan> --body /tmp/plan-body.md
   # prints <plan> revision N
   ```

5. **Answer each comment you addressed** with a reply saying what changed. Resolve only when the
   reviewer asked you to, or when the comment is a factual fix you made:

   ```bash
   node "skills/iterate-plan/scripts/artifact.mjs" reply   --file <plan> --id c1 --author Claude --text "Phase 1 now names src/x.ts:40."
   node "skills/iterate-plan/scripts/artifact.mjs" resolve --file <plan> --id c2 --author Claude --text "Rollback step added to phase 2."
   ```

6. **Reply with the path, the new revision and which comments are still open.** Do not implement.

## Rules

- Never edit the plan file with Write or Edit: one stray write can drop the comment block.
- Never delete or rewrite a comment, even a wrong one. Reply to it.
- Iterating an approved plan moves it back to `in-review`; it needs a new approval.

## Related

- `/ork:create-plan` writes the first revision. `/ork:review-artifact-comments` works through comments
  without rewriting the body.

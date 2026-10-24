---
description: "Works through the review comments written into a task artifact (plan or research under .ork/tasks/TASK/): lists the open ones, asks how to proceed, then replies, resolves or hands off to iterate-plan or iterate-research, and approves the artifact once nothing is open. Use when a reviewer has commented on an artifact file or asks to address, resolve or approve its comments."
argument-hint: "[artifact file]"
user-invocable: true
name: review-artifact-comments
allowed-tools: "Bash Read Grep Glob AskUserQuestion"
---

# Auto-generated from skills/review-artifact-comments/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# review-artifact-comments

Comments live inside the artifact, in the block at its end (format: the create-plan skill's
`references/artifact-layout.md`). A reviewer adds one with the script or types it into the block by
hand; both are read the same way. Nothing here deletes a comment.

## Steps

1. **Pick the artifact.** Use the file given. Otherwise list the task directory and ask which one:

   ```bash
   node "skills/review-artifact-comments/scripts/artifact.mjs" status --task-dir .ork/tasks/<task>
   ```

2. **Read the artifact in full, then its open comments:**

   ```bash
   node "skills/review-artifact-comments/scripts/artifact.mjs" list --file <artifact> --open
   ```

3. **Ask how to proceed** unless the user already said (AskUserQuestion), for example:
   - revise the artifact from the comments (hand off to `iterate-plan` or `iterate-research`)
   - revise and resolve the comments it settles
   - investigate the comments and reply with findings, no revision
4. **Work one comment at a time.** Check the claim in the code before answering. Reply with what you
   found or changed:

   ```bash
   node "skills/review-artifact-comments/scripts/artifact.mjs" reply   --file <artifact> --id c1 --author Claude --text "..."
   node "skills/review-artifact-comments/scripts/artifact.mjs" resolve --file <artifact> --id c1 --author Claude --text "..."
   ```

   Resolve only when told to, or when the reply records a fix already made.
5. **Approve only for the reviewer, never for the author.** The approver is the reviewing seat, and
   `--ref` names the LAND message or comment id the approval rests on. The script refuses while a
   comment is open or when `--by` is the artifact's `author` (exit 1), and without `--by` or `--ref`
   (exit 2):

   ```bash
   node "skills/review-artifact-comments/scripts/artifact.mjs" approve --file <artifact> --by <reviewer seat> --ref <LAND or comment id>
   ```

   An approved artifact with no open comment is the "phase done" signal other tools read.

## Adding a comment as a reviewer

```bash
node "skills/review-artifact-comments/scripts/artifact.mjs" comment --file <artifact> \
  --author "<name>" --quote "<the line it is about>" --text "<the comment>"
```

## Rules

- Never resolve or approve on your own initiative; those are the reviewer's calls.
- Never edit the comment block with Write or Edit.

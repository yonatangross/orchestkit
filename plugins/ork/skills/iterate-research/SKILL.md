---
name: iterate-research
description: "Revises an existing research artifact (.ork/tasks/TASK/NN-research-SLUG.md) from review comments or follow-up questions, re-checking the code, rewriting the body in place and keeping every earlier review comment. Use when a research file from create-research got comments, a claim was challenged, or the question widened; it stays descriptive and never proposes changes."
argument-hint: "<research file> [follow-up]"
user-invocable: true
allowed-tools: "Bash Read Write Grep Glob Agent"
compatibility: "Claude Code 2.1.277+. Node 22+."
metadata:
  version: "1.0.0"
  author: "OrchestKit"
  complexity: "medium"
  tags: "research, artifacts, review, iteration, workflow"
---

# iterate-research

Revise one research file. The body is rewritten from fresh reading of the code; the comment block is
kept byte for byte. Layout: the create-plan skill's `references/artifact-layout.md`.

## Steps

1. **Read the research in full** and list its open comments:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/artifact.mjs" list --file <research> --open
   ```

2. **Re-check every challenged claim in the code**, at the current commit. If the code moved since
   the artifact's `sha`, say which findings changed.
3. **New questions** get the same method as create-research: parallel `Explore` agents by area,
   citations checked by you.
4. **Write the revised body** to a scratch file (no comment block in it) and write it back:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/artifact.mjs" iterate --file <research> --body /tmp/research-body.md
   ```

5. **Reply to each comment you addressed** (`reply`, or `resolve` when the reviewer asked or the
   comment was a factual correction you made), then answer with the path, the revision and the
   comments still open.

## Rules

- Same rules as create-research: describe, cite, no recommendations.
- Never edit the file with Write or Edit, and never delete a comment.

## Related

- `create-research` writes the first revision. `review-artifact-comments` handles comments without a
  rewrite.

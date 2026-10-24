---
name: create-research
description: "Documents how the codebase works today for a task's research questions and saves it as a file artifact (.ork/tasks/TASK/NN-research-SLUG.md) with file:line citations, so the plan and reviewers build on a reviewable record. Use before planning a change in unfamiliar code; describes what exists only, never proposes changes. Pair with iterate-research."
argument-hint: "<task> <question or questions file>"
user-invocable: true
allowed-tools: "Bash Read Write Grep Glob Agent"
compatibility: "Claude Code 2.1.277+. Node 22+."
metadata:
  version: "1.0.0"
  author: "OrchestKit"
  complexity: "medium"
  tags: "research, artifacts, codebase, documentation, workflow"
---

# create-research

Answer the task's questions about the code as it is, and save the answer as one research file. It is
a map, not a proposal: no recommendations, no fixes, no critique. Layout: the create-plan skill's
`references/artifact-layout.md`.

## Steps

1. **Get the questions.** From the user, or from a questions file they name. Read any file they
   mention in full before anything else.
2. **Do not read the task's ticket or plans.** Research describes the code; a ticket that wants a
   change biases it. Earlier research artifacts in the task directory may be read.
3. **Split the questions into areas** and research them in parallel with `Explore` agents (two to
   six, grouped by area, not one per question). Ask each for `file:line` evidence.
4. **Check the agents' claims** that the document will rest on: open the cited lines yourself. An
   agent's summary is a claim, not evidence.
5. **Write the body** to a scratch file using
   [references/research-template.md](references/research-template.md), then create the artifact:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/artifact.mjs" create \
     --task <task> --kind research --slug <slug> --title "<question>" --author <your seat> --body /tmp/research-body.md
   # prints .ork/tasks/<task>/NN-research-<slug>.md
   ```

6. **Reply with the path and the open questions**, and stop.

## Rules

- Describe, never prescribe: no "should", no "we could", no diff blocks.
- Every finding cites `path:line` or a line range.
- Say when a list is complete and when it is a sample.
- Open questions are about what was not traced ("how does X reach Y?"), not about what to build.

## Related

- `iterate-research` revises it from comments. `create-plan` reads it next.

---
description: "Documents how code works today for a task's questions, with file:line citations. Use before planning a change; describes, never proposes. NOT for mapping a repo (use explore)."
argument-hint: "<task> <question or questions file>"
user-invocable: true
name: create-research
allowed-tools: "Bash Read Write Grep Glob Agent"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run skill scripts only from the installed plugin directory, never by a relative `skills/...` path.

Ask the user for the absolute path of the installed OrchestKit plugin, put it in place of `PASTE_PATH_HERE`, and run:

```bash
( ork_dir='PASTE_PATH_HERE'; ork_ws="$(pwd -P)"; ork_home="$(cd "$HOME" && pwd -P)"; case "$ork_dir" in /*) ;; *) echo "REFUSED: not an absolute path"; exit 3 ;; esac; case "/$ork_dir/" in */../*|*/./*) echo "REFUSED: path traversal"; exit 3 ;; esac; [ -d "$ork_dir" ] || { echo "REFUSED: not a directory"; exit 3; }; ork_real="$(cd "$ork_dir" && pwd -P)"; case "$ork_real/" in "$ork_ws"/*) echo "REFUSED: inside the workspace"; exit 3 ;; esac; case "$ork_real/" in "$ork_home"/.cursor/plugins/*) ;; *) echo "REFUSED: not an installed Cursor plugin (outside ~/.cursor/plugins)"; exit 3 ;; esac; [ -f "$ork_real/.cursor-plugin/plugin.json" ] && [ -d "$ork_real/skills/create-research" ] || { echo "REFUSED: not an OrchestKit plugin root"; exit 3; }; echo "ORK_PLUGIN_DIR=$ork_real" )
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/create-research/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


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
   [skills/create-research/references/research-template.md](skills/create-research/references/research-template.md), then create the artifact:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/create-research/scripts/artifact.mjs" create \
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

- `/ork:iterate-research` revises it from comments. `/ork:create-plan` reads it next.

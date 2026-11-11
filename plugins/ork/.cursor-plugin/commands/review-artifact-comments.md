---
description: "Works through review comments in a plan or research artifact: replies, resolves, hands off to iterate-plan or iterate-research, approves when none are open. Use when an artifact file has reviewer comments."
argument-hint: "[artifact file]"
user-invocable: true
name: review-artifact-comments
allowed-tools: "Bash Read Grep Glob AskUserQuestion"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run skill scripts only from the installed plugin directory, never by a relative `skills/...` path.

Ask the user for the absolute path of the installed OrchestKit plugin, put it in place of `PASTE_PATH_HERE`, and run:

```bash
( ork_dir='PASTE_PATH_HERE'; ork_ws="$(pwd -P)"; ork_home="$(cd "$HOME" && pwd -P)"; case "$ork_dir" in /*) ;; *) echo "REFUSED: not an absolute path"; exit 3 ;; esac; case "/$ork_dir/" in */../*|*/./*) echo "REFUSED: path traversal"; exit 3 ;; esac; [ -d "$ork_dir" ] || { echo "REFUSED: not a directory"; exit 3; }; ork_real="$(cd "$ork_dir" && pwd -P)"; case "$ork_real/" in "$ork_ws"/*) echo "REFUSED: inside the workspace"; exit 3 ;; esac; case "$ork_real/" in "$ork_home"/.cursor/plugins/*) ;; *) echo "REFUSED: not an installed Cursor plugin (outside ~/.cursor/plugins)"; exit 3 ;; esac; [ -f "$ork_real/.cursor-plugin/plugin.json" ] && [ -d "$ork_real/skills/review-artifact-comments" ] || { echo "REFUSED: not an OrchestKit plugin root"; exit 3; }; echo "ORK_PLUGIN_DIR=$ork_real" )
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/review-artifact-comments/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# review-artifact-comments

Comments live inside the artifact, in the block at its end (format: the create-plan skill's
`references/artifact-layout.md`). A reviewer adds one with the script or types it into the block by
hand; both are read the same way. Nothing here deletes a comment.

## Steps

1. **Pick the artifact.** Use the file given. Otherwise list the task directory and ask which one:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" status --task-dir .ork/tasks/<task>
   ```

2. **Read the artifact in full, then its open comments:**

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" list --file <artifact> --open
   ```

3. **Ask how to proceed** unless the user already said (AskUserQuestion), for example:
   - revise the artifact from the comments (hand off to `/ork:iterate-plan` or `/ork:iterate-research`)
   - revise and resolve the comments it settles
   - investigate the comments and reply with findings, no revision
4. **Work one comment at a time.** Check the claim in the code before answering. Reply with what you
   found or changed:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" reply   --file <artifact> --id c1 --author Claude --text "..."
   node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" resolve --file <artifact> --id c1 --author Claude --text "..."
   ```

   Resolve only when told to, or when the reply records a fix already made.
5. **Approve only for the reviewer, never for the author.** The approver is the reviewing seat, and
   `--ref` names the LAND message or comment id the approval rests on. The script refuses while a
   comment is open or when `--by` is the artifact's `author` (exit 1), and without `--by` or `--ref`
   (exit 2):

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" approve --file <artifact> --by <reviewer seat> --ref <LAND or comment id>
   ```

   An approved artifact with no open comment is the "phase done" signal other tools read.

## Adding a comment as a reviewer

```bash
node "<ORK_PLUGIN_DIR>/skills/review-artifact-comments/scripts/artifact.mjs" comment --file <artifact> \
  --author "<name>" --quote "<the line it is about>" --text "<the comment>"
```

## Rules

- Never resolve or approve on your own initiative; those are the reviewer's calls.
- Never edit the comment block with Write or Edit.

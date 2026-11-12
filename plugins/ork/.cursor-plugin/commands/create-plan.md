---
description: "Writes an implementation plan file (.ork/tasks/TASK/NN-plan-SLUG.md) with phases, file changes and runnable success criteria. Use when research is done and a reviewable plan is needed before code."
argument-hint: "<task> [slug]"
user-invocable: true
name: create-plan
allowed-tools: "Bash Read Write Grep Glob"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run plugin scripts only from the installed plugin directory, never by a relative `skills/...` or `hooks/...` path.

Find the installed plugin directory first:

```bash
(
  ork_ws="$(pwd -P)"
  ork_base="$(cd "$HOME/.cursor/plugins" 2>/dev/null && pwd -P)"
  ork_above=""
  case "$ork_base/" in "$ork_ws"/*) ork_above=1 ;; esac
  ork_real=""
  if [ -n "$ork_base" ]; then
    ork_real="$(find "$ork_base" -maxdepth 6 -type f -path '*/.cursor-plugin/plugin.json' 2>/dev/null | sort | while IFS= read -r ork_pj; do
      ork_r="$(cd "${ork_pj%/.cursor-plugin/plugin.json}" && pwd -P)" || continue
      case "$ork_r/" in "$ork_base"/*) ;; *) continue ;; esac
      if [ -z "$ork_above" ]; then case "$ork_r/" in "$ork_ws"/*) continue ;; esac; fi
      case "$ork_ws/" in "$ork_r"/*) continue ;; esac
      grep -Eq '"name"[[:space:]]*:[[:space:]]*"ork"' "$ork_pj" || continue
      [ -d "$ork_r/skills/create-plan" ] || continue
      printf '%s\n' "$ork_r"
      break
    done)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/create-plan/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# create-plan

Turn what is known about a task into one plan file that a person can review line by line. The plan
lives in the task directory, and comments are written into the file, so the review history stays
with the plan and survives a new session.

The layout (path, file name, front matter, comment block, the "done" signal) is fixed in
[skills/create-plan/references/artifact-layout.md](skills/create-plan/references/artifact-layout.md). Only `<ORK_PLUGIN_DIR>/skills/create-plan/scripts/artifact.mjs` writes
the front matter.

## Steps

1. **Find the task directory.** Ask for the task name if it was not given (kebab-case, one per
   branch, issue or lane). List what is already there:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/create-plan/scripts/artifact.mjs" status --task-dir .ork/tasks/<task>
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
   node "<ORK_PLUGIN_DIR>/skills/create-plan/scripts/artifact.mjs" create \
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

- `/ork:iterate-plan`: revise this plan from review comments, keeping every comment.
- `/ork:create-research`: the research artifact this plan should read first.
- `/ork:review-artifact-comments`: read, answer and resolve comments on any artifact.

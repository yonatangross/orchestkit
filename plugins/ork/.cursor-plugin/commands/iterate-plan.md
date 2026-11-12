---
description: "Revises a create-plan file from its review comments or new instructions, keeping comments and bumping the revision. Use when a plan got feedback; never to start one."
argument-hint: "<plan file> [instructions]"
user-invocable: true
name: iterate-plan
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
      [ -d "$ork_r/skills/iterate-plan" ] || continue
      printf '%s\n' "$ork_r"
      break
    done)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

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
   node "<ORK_PLUGIN_DIR>/skills/iterate-plan/scripts/artifact.mjs" list --file <plan> --open
   ```

2. **Check each comment against the code before acting on it.** Open the files it names. A comment
   can be wrong; if so, say so in a reply instead of changing the plan.
3. **Write the revised body** to a scratch file: start from the current body (everything between the
   front matter and `<!-- ork:comments -->`), apply the changes, keep the phase structure. Do not
   copy the comment block into it; the script refuses a body that carries one.
4. **Write it back through the script**, which bumps `revision`, refreshes `sha` and `updated`, and
   keeps the comments:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/iterate-plan/scripts/artifact.mjs" iterate --file <plan> --body /tmp/plan-body.md
   # prints <plan> revision N
   ```

5. **Answer each comment you addressed** with a reply saying what changed. Resolve only when the
   reviewer asked you to, or when the comment is a factual fix you made:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/iterate-plan/scripts/artifact.mjs" reply   --file <plan> --id c1 --author Claude --text "Phase 1 now names src/x.ts:40."
   node "<ORK_PLUGIN_DIR>/skills/iterate-plan/scripts/artifact.mjs" resolve --file <plan> --id c2 --author Claude --text "Rollback step added to phase 2."
   ```

6. **Reply with the path, the new revision and which comments are still open.** Do not implement.

## Rules

- Never edit the plan file with Write or Edit: one stray write can drop the comment block.
- Never delete or rewrite a comment, even a wrong one. Reply to it.
- Iterating an approved plan moves it back to `in-review`; it needs a new approval.

## Related

- `/ork:create-plan` writes the first revision. `/ork:review-artifact-comments` works through comments
  without rewriting the body.

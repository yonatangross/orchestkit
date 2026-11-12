---
description: "Re-checks a create-research file when a claim is challenged or the question widens, citing file:line afresh. Use after review comments on research."
argument-hint: "<research file> [follow-up]"
user-invocable: true
name: iterate-research
allowed-tools: "Bash Read Write Grep Glob Agent"
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
      [ -d "$ork_r/skills/iterate-research" ] || continue
      printf '%s\n' "$ork_r"
      break
    done)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/iterate-research/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# iterate-research

Revise one research file. The body is rewritten from fresh reading of the code; the comment block is
kept byte for byte. Layout: the create-plan skill's `references/artifact-layout.md`.

## Steps

1. **Read the research in full** and list its open comments:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/iterate-research/scripts/artifact.mjs" list --file <research> --open
   ```

2. **Re-check every challenged claim in the code**, at the current commit. If the code moved since
   the artifact's `sha`, say which findings changed.
3. **New questions** get the same method as create-research: parallel `Explore` agents by area,
   citations checked by you.
4. **Write the revised body** to a scratch file (no comment block in it) and write it back:

   ```bash
   node "<ORK_PLUGIN_DIR>/skills/iterate-research/scripts/artifact.mjs" iterate --file <research> --body /tmp/research-body.md
   ```

5. **Reply to each comment you addressed** (`reply`, or `resolve` when the reviewer asked or the
   comment was a factual correction you made), then answer with the path, the revision and the
   comments still open.

## Rules

- Same rules as create-research: describe, cite, no recommendations.
- Never edit the file with Write or Edit, and never delete a comment.

## Related

- `/ork:create-research` writes the first revision. `/ork:review-artifact-comments` handles comments without a
  rewrite.

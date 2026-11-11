---
description: "Confines file edits to one directory until lifted: an Edit, Write, MultiEdit and NotebookEdit hook refuses any path whose real location, symlinks followed, falls outside the frozen dir. Argument: the dir, or off. Use when a change must stay inside one package, module or worktree."
argument-hint: "<dir> | off"
disable-model-invocation: true
context: inherit
user-invocable: true
name: freeze
allowed-tools: "Bash(node *freeze-guard.mjs arm *) Read"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run skill scripts only from the installed plugin directory, never by a relative `skills/...` path.

Ask the user for the absolute path of the installed OrchestKit plugin, put it in place of `PASTE_PATH_HERE`, and run:

```bash
( ork_dir='PASTE_PATH_HERE'; ork_ws="$(pwd -P)"; ork_home="$(cd "$HOME" && pwd -P)"; case "$ork_dir" in /*) ;; *) echo "REFUSED: not an absolute path"; exit 3 ;; esac; case "/$ork_dir/" in */../*|*/./*) echo "REFUSED: path traversal"; exit 3 ;; esac; [ -d "$ork_dir" ] || { echo "REFUSED: not a directory"; exit 3; }; ork_real="$(cd "$ork_dir" && pwd -P)"; case "$ork_real/" in "$ork_ws"/*) echo "REFUSED: inside the workspace"; exit 3 ;; esac; case "$ork_real/" in "$ork_home"/.cursor/plugins/*) ;; *) echo "REFUSED: not an installed Cursor plugin (outside ~/.cursor/plugins)"; exit 3 ;; esac; [ -f "$ork_real/.cursor-plugin/plugin.json" ] && [ -d "$ork_real/skills/freeze" ] || { echo "REFUSED: not an OrchestKit plugin root"; exit 3; }; echo "ORK_PLUGIN_DIR=$ork_real" )
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/freeze/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# freeze, keep edits inside one directory

State for this session:

!`node "<ORK_PLUGIN_DIR>/skills/freeze/scripts/freeze-guard.mjs" arm "${CLAUDE_PROJECT_DIR}" "${CLAUDE_SESSION_ID}" "$ARGUMENTS"`

The line above ran when the skill was invoked: it resolved the argument against the
project dir, followed symlinks, and recorded the real path for this session in
`.claude/state/freeze/<session-id>.json`. The argument is double-quoted, so a name with
spaces or an apostrophe arrives as typed; a `$`, backtick or double quote in a dir
name would be interpreted by the shell and is not supported. Report that line to the operator as it reads. If it says NOT changed,
the freeze did not move; say so and stop.

## How it works

Invoking this skill also registers a PreToolUse hook on `Edit|Write|MultiEdit|NotebookEdit`
(the `hooks:` block above). Claude Code keeps a skill's hooks registered for the rest
of the session, so the fence holds on every later turn. For each edit the hook
resolves where the write would actually land and denies it (exit 2) when that is
outside the frozen dir:

| Target | Verdict |
|--------|---------|
| `<frozen>/a.ts`, or a new file in a new subdir of `<frozen>` | allowed |
| `<frozen>/../other/b.ts` | denied |
| `<frozen>-evil/x.ts` (a prefix sibling) | denied |
| `<frozen>/link/b.ts` where `link` points outside | denied, symlinks are followed |
| `<frozen>/dangling.ts`, a link to a missing file outside | denied, the link is chased |
| an edit call with no path | denied |

## Usage

```
/ork:freeze src/hooks        # fence edits to src/hooks
/ork:freeze                  # show the current fence
/ork:freeze off              # lift it
```

Invoking again with another dir moves the fence; a dir that does not exist is
refused and the previous fence stays.

## When an edit is blocked

The deny reason names the target and the frozen dir. Stop and ask the operator to
widen or lift the freeze. Do not route the change through Bash (`sed -i`, `cat >`,
`cp`) instead: the fence covers the edit tools only, and using Bash to get around it
defeats the reason it was turned on.

## Limits

- Edit tools only. Bash, MCP tools and subprocesses can still write anywhere. Pair
  with careful for destructive shell commands, or with a worktree for real isolation.
- One fence per session, stored under the project's `.claude/state/freeze/`.
- If the hook cannot read its input or the state file it blocks rather than guess.

The fence is `<ORK_PLUGIN_DIR>/skills/freeze/scripts/freeze-guard.mjs` (Node, no dependencies); its cases live in
`tests/unit/test-freeze-guard.mjs`.

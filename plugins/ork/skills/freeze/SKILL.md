---
name: freeze
license: MIT
compatibility: "Claude Code 2.1.277+."
description: "Confines file edits to one directory until lifted: an Edit, Write, MultiEdit and NotebookEdit hook refuses any path whose real location, symlinks followed, falls outside the frozen dir. Argument: the dir, or off. Use when a change must stay inside one package, module or worktree."
argument-hint: "<dir> | off"
context: inherit
user-invocable: true
disable-model-invocation: true
allowed-tools: "Bash(node *freeze-guard.mjs arm *) Read"
hooks:
  PreToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/freeze/scripts/freeze-guard.mjs"'
metadata:
  category: workflow-automation
  version: "1.0.0"
  author: "OrchestKit"
  complexity: "low"
  tags: "freeze, guard, scope, edit-fence, hooks, skill-scoped-hooks, symlink"
---

# freeze, keep edits inside one directory

State for this session:

!`node "${CLAUDE_SKILL_DIR}/scripts/freeze-guard.mjs" arm "${CLAUDE_PROJECT_DIR}" "${CLAUDE_SESSION_ID}" '$ARGUMENTS'`

The line above ran when the skill was invoked: it resolved the argument against the
project dir, followed symlinks, and recorded the real path for this session in
`.claude/state/freeze/<session-id>.json`. The argument is single-quoted so the shell
passes it as typed, spaces and `$` included; a dir name containing a single quote is
not supported. Report that line to the operator as it reads. If it says NOT changed,
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

The fence is `scripts/freeze-guard.mjs` (Node, no dependencies); its cases live in
`tests/unit/test-freeze-guard.mjs`.

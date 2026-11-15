---
description: "Blocks destructive shell commands once invoked: a PreToolUse Bash guard denies rm -rf outside temp dirs, force pushes and remote branch deletes, git reset --hard, DROP TABLE / DROP DATABASE / TRUNCATE, kubectl delete and terraform or tofu destroy, including inside ssh remote commands, and makes Claude ask the operator. Use before touching production, a shared branch, a live database or a cluster."
argument-hint: ""
disable-model-invocation: true
context: inherit
user-invocable: true
name: careful
allowed-tools: "Read"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run plugin scripts only from the installed plugin directory, never by a relative `skills/...` or `hooks/...` path.

Find the installed plugin directory first:

```bash
(
  ork_ws="$(pwd -P)"
  ork_home="$(cd "$HOME" 2>/dev/null && pwd -P)"
  ork_base="$(cd "$HOME/.cursor/plugins" 2>/dev/null && pwd -P)"
  ork_above=""
  case "$ork_home/" in ("$ork_ws"/*) ork_above=1 ;; esac
  ork_pick() {
    ork_best=""
    ork_best_pj=""
    while IFS= read -r ork_pj; do
      ork_r="$(cd "${ork_pj%/.cursor-plugin/plugin.json}" && pwd -P)" || continue
      case "$ork_r/" in ("$ork_base"/*) ;; (*) continue ;; esac
      if [ -z "$ork_above" ]; then
        case "$ork_r/" in ("$ork_ws"/*) continue ;; esac
      fi
      case "$ork_ws/" in ("$ork_r"/*) continue ;; esac
      grep -Eq '^  "name"[[:space:]]*:[[:space:]]*"ork"' "$ork_pj" || continue
      [ -d "$ork_r/skills/careful" ] || continue
      if [ -z "$ork_best" ] || [ "$ork_pj" -nt "$ork_best_pj" ]; then
        ork_best="$ork_r"
        ork_best_pj="$ork_pj"
      fi
    done
    [ -n "$ork_best" ] && printf '%s\n' "$ork_best"
  }
  ork_real=""
  if [ -n "$ork_base" ]; then
    ork_real="$(find "$ork_base" -maxdepth 6 -type f -path '*/.cursor-plugin/plugin.json' 2>/dev/null | ork_pick)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/careful/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# careful, block destructive commands for this session

Invoking this skill registers a PreToolUse hook on Bash (the `hooks:` block above).
Claude Code keeps a skill's hooks registered for the rest of the session, on every
later turn, so careful stays on until the session ends. There is no off switch:
start a new session to work without it.

## What it blocks

| Rule | Blocks | Still allowed |
|------|--------|---------------|
| `rm-rf` | `rm` with recursive and force flags (`-rf`, `-fr`, `-r -f`, `--recursive --force`), `xargs rm -rf`, and any target the shell expands: `$TMPDIR/x`, `$TMP`, `$TEMP`, `$X`, `$( )`, globs, braces, `~` | the same command when every target is a LITERAL absolute path that lands, after following existing symlinks, strictly inside `/tmp`, `/private/tmp` or the configured TMPDIR (trusted only when it is two or more levels deep); write `/tmp/build`, not `$TMPDIR/build`, because a command can reassign TMPDIR first (`TMPDIR=/ ; rm -rf $TMPDIR/usr`); `rm -r`; `rm -f file` |
| `git-push-force` | `git push --force`, `-f` (also inside `-uf`), `--force-with-lease[=...]`, a `+branch` refspec, to any branch | `git push`, `git push -u origin <branch>` |
| `git-push-delete` | `git push origin --delete <b>`, `-d <b>`, `:<b>` | `git push origin <b>:<b>` |
| `git-reset-hard` | `git reset --hard` | `git reset --soft`, `git reset HEAD <file>` |
| `sql-drop` | `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA` anywhere in the command, heredocs included | a `SELECT` that mentions drop |
| `sql-truncate` | `TRUNCATE TABLE`, or a `TRUNCATE <name>` statement sent to a SQL client | `truncate -s 0 file.log` |
| `kubectl-delete` | `kubectl ... delete` | `kubectl get`, `kubectl logs` |
| `terraform-destroy` | `terraform destroy`, `terraform apply -destroy`, the same with `tofu` | `terraform plan`, `terraform apply` |

Matching is on shell words, not substrings: a commit message or grep pattern that
quotes `git push --force` is text, not a push. Compound commands are split on
`;`, `&&`, `|` and newlines, and the bodies of `bash -c`, `eval`, `$( )` and the
remote command of `ssh host '...'` are checked as well.

## When a command is blocked

The hook exits 2 and Claude sees the reason, for example:

```
[ork:careful] blocked by rule git-push-force: git push with --force-with-lease.
careful mode is on for this session, so destructive commands do not run unattended.
To proceed, ask the operator: they can run the command themselves, or confirm it and run it outside careful mode.
```

Then stop and ask. Do not rewrite the command to slip past the matcher (a
different flag spelling, a script file, an alias): the operator turned careful on
to be asked, and a workaround defeats that even when the matcher misses it.

## Limits

careful is a pattern matcher on the text of each Bash call. It is a seatbelt, not a
sandbox. It does NOT see:

- shell aliases and functions (`alias nuke='rm -rf'`, then `nuke src`);
- scripts, Makefiles, npm scripts or binaries that run these commands inside
  (`./deploy.sh`, `make clean`, `npm run reset-db`);
- `eval` or `bash -c` built from variables, base64 or other indirection it cannot
  read as text; it only reads literal strings;
- interpreters and other shells running the same thing (`python -c "shutil.rmtree(...)"`,
  `node -e`, `fish -c`, `pwsh`), or a remote shell other than plain `ssh host '...'`;
- a link created in the same command (`ln -s / /tmp/r9 && rm -rf /tmp/r9/usr`): the
  guard follows links that already exist when it runs (a temp path through a link to
  `/usr` is denied), but one made by the command itself is out of reach for a text
  check, like `python -c "shutil.rmtree(...)"`;
- MCP tools, file edits, and anything outside the Bash tool.

- If the hook cannot read its input it blocks (exit 2) rather than guess.
- To also fence file edits to one directory, use the freeze skill.

The guard is `<ORK_PLUGIN_DIR>/skills/careful/scripts/careful-guard.mjs` (Node, no dependencies); its matcher
cases live in `tests/unit/test-careful-guard.mjs`.

## Related Skills

- `ork:freeze`: fence file edits to one directory; careful covers shell commands, freeze covers the edit tools.
- `ork:security-patterns`: defense in depth, the wider picture a text matcher is one layer of.
- `ork:commit`: history hygiene and branch protection for the force pushes careful asks about.

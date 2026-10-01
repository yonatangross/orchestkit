---
description: "Blocks destructive shell commands once invoked: a PreToolUse Bash guard denies rm -rf outside temp dirs, force pushes and remote branch deletes, git reset --hard, DROP TABLE / DROP DATABASE / TRUNCATE, kubectl delete and terraform or tofu destroy, including inside ssh remote commands, and makes Claude ask the operator. Use before touching production, a shared branch, a live database or a cluster."
argument-hint: ""
disable-model-invocation: true
context: inherit
user-invocable: true
name: careful
allowed-tools: "Read"
---

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
| `rm-rf` | `rm` with recursive and force flags (`-rf`, `-fr`, `-r -f`, `--recursive --force`), `xargs rm -rf`, a computed target like `"$(pwd)"` | the same command when every target is strictly inside `/tmp`, `/private/tmp` or `$TMPDIR`, and names something even with its variables empty (`/tmp/build-$ID` yes, `/tmp/$X` no); `$TMPDIR` counts only when TMPDIR is an absolute path other than `/` (unset, `rm -rf $TMPDIR/*` is `rm -rf /*`); `$TMP`, `$TEMP`, `~` and relative paths never count; `rm -r`; `rm -f file` |
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
- MCP tools, file edits, and anything outside the Bash tool.

- If the hook cannot read its input it blocks (exit 2) rather than guess.
- To also fence file edits to one directory, use the freeze skill.

The guard is `skills/careful/scripts/careful-guard.mjs` (Node, no dependencies); its matcher
cases live in `tests/unit/test-careful-guard.mjs`.

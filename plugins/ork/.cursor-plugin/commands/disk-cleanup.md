---
description: "Frees the disk that agents and worktrees leave behind: caches, merged worktrees, Docker build cache, old logs. Dry run lists safe, regenerable and ask-first items with sizes; --apply after you confirm. Use when the disk is nearly full. Never deletes branches."
argument-hint: "[--apply] [--only ID] [--tier safe|regenerable] [--root DIR] [--json]"
disable-model-invocation: false
effort: low
user-invocable: true
name: disk-cleanup
allowed-tools: Bash, Read, AskUserQuestion
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
      [ -d "$ork_r/skills/disk-cleanup" ] || continue
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

# Auto-generated from skills/disk-cleanup/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# disk-cleanup, get the disk back from your agents

Running many agents and worktrees fills a disk fast: a fresh `node_modules` per
worktree, a build cache per tool, Docker layers, browser downloads, session logs.
This skill finds all of it, sorts it by how safe it is to remove, and removes only
what is provably safe, after you confirm.

## Critical rules

1. **Dry run first, always.** Run the script without `--apply`, show the inventory, and
   get an explicit yes from the user in the conversation before any `--apply`.
2. **`--apply` touches two tiers only.** SAFE (caches that refill on their own) and
   REGENERABLE (merged, clean, idle worktrees; rebuildable stores). ASK FIRST items are
   listed with the command to run. The script never runs them and neither do you without
   the user naming the item.
3. **Unreadable is KEEP.** A failed `git`, `gh`, `lsof` or `docker` call keeps the item and says why.
   Never remove on a guess.
4. **A worktree is removed only when all of these hold:** its tip is on the default branch
   (or equals the head of a merged PR), the tree is clean, it holds no ignored file outside
   a rebuildable folder (`node_modules`, `.venv`, `dist`, `build`, `.next`, `__pycache__` and
   the like; an ignored `.env.local` keeps the tree), it is not locked, no process has
   its working directory inside, nothing in it changed for 60 minutes, and it sits under
   the home directory. Removal is `git worktree remove` without force. The branch stays.
5. **Report the measured number.** The freed total is free space before versus after. The
   inventory total is an estimate and is labelled as one.

## Instructions

1. Dry run. From a repo you work in (the script scans its worktrees) or with `--root DIR`
   for a folder that holds several repos:

   ```bash
   python3 "<ORK_PLUGIN_DIR>/skills/disk-cleanup/scripts/disk_cleanup.py"
   python3 "<ORK_PLUGIN_DIR>/skills/disk-cleanup/scripts/disk_cleanup.py" --root ~/code
   ```

   Exit 0 means nothing to clean, 3 means findings, 2 means it could not look.
2. Show the user the inventory as printed. Lead with the verdict line, then name the three
   biggest rows and any KEEP lines that explain why a worktree was left alone.
3. Ask the user to confirm. Offer the narrower forms when they hesitate:
   `--tier safe` (caches only) or `--only npm-cache` (one item id, or a section such as `docker`).
4. Apply with the command the dry run printed under "To act on exactly this list". It
   pins `--only` to the ids the user just saw, so anything that became removable after
   the dry run (a worktree that merged or went idle meanwhile) is left alone:

   ```bash
   python3 "<ORK_PLUGIN_DIR>/skills/disk-cleanup/scripts/disk_cleanup.py" --apply --only npm-cache --only 'worktree:/path/to/tree'
   python3 "<ORK_PLUGIN_DIR>/skills/disk-cleanup/scripts/disk_cleanup.py" --apply --tier safe
   ```

   Expected: one line per action (done or failed), then `freed (measured, before and after)`.
5. For ASK FIRST rows, read the user the printed command and what it removes. Run it only
   when they confirm that specific row.
6. Optional: `--json` for a machine-readable inventory, `--report FILE` to save it. The report
   starts with a marker line and the script refuses to overwrite a file without it.

## What counts as what

| Tier | Meaning | Examples |
|---|---|---|
| 🟢 SAFE | Pure cache, the tool refills it | npm, pip, uv, Cargo, Go caches, Homebrew downloads, Xcode DerivedData, browser caches, Docker build cache and dangling images, agent debug logs older than 14 days |
| 🟡 REGENERABLE | Rebuilds, but costs time or bandwidth | merged worktrees, pnpm store, Playwright browsers, unused Docker images |
| 🔴 ASK FIRST | Might be someone's work | unmerged or detached worktrees, session transcripts, Downloads, Trash, Docker volumes, orphan agent processes |

Full path list per OS and the evidence behind each gate: `skills/disk-cleanup/references/catalog.md`.

## Example output

```text
disk-cleanup dry run: 47.1 G reclaimable, 24.0 G more needs you

DISK  ~  (macOS)
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░]
 used 355.0 G    free 73.0 G    83 % full · 460.0 G total
────────────────────────────────────────────────────────────────────────
🟢 SAFE  caches that refill on their own
────────────────────────────────────────────────────────────────────────
🐳 Docker build cache                 ▓▓▓▓▓▓▓ 14.5 G  prune
🌐 Browser caches                     ▓▓▓▓░░░  8.9 G  clear
📦 npm cache                          ▓▓▓░░░░  6.2 G  clear
                                         ── 29.6 G
────────────────────────────────────────────────────────────────────────
🟡 REGENERABLE  merged worktrees and rebuildable stores
────────────────────────────────────────────────────────────────────────
🗂️ app/fix-login  merged PR #412      ▓▓▓▓░░░  3.9 G  remove
        KEEP  app/hotfix-7  dirty (3 files)
        KEEP  app/agent-3  process cwd inside (pid 4121)
🟢 29.6 G + 🟡 3.9 G = 33.5 G estimated  →  free 73.0 G → ~106.5 G
ℹ️  Sizes are allocated blocks, so sparse files read small.
```

## Examples

User says: "my disk is almost full, I run a lot of agents".
Actions: run the dry run, show the inventory, ask to confirm, run `--apply`.
Result: SAFE and REGENERABLE items removed, a measured freed total, ASK FIRST rows left for the user.

User says: "clean up old worktrees only".
Actions: dry run, then `--apply --only worktrees` after confirmation.
Result: merged clean worktrees removed, everything else untouched.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every worktree reads KEEP "process list unreadable" | `lsof` missing or blocked (some sandboxes) | Run the script outside the sandbox, or install `lsof`. Never skip the check. |
| Squash-merged worktrees read as unmerged | `gh` missing or not logged in | `gh auth login`, then rerun. They stay ASK FIRST until then. |
| Docker items missing | Docker daemon not running | Start Docker and rerun. The caveat line says so. |
| Freed total is smaller than the estimate | Docker Desktop keeps its disk image at full size, APFS snapshots hold blocks | Trust the measured number. Compact Docker Desktop's disk image from its settings. |
| `git worktree remove` refused | The tree changed between the dry run and `--apply` | Rerun the dry run. It will classify the tree again. |

## Audit trail

Every applied action appends one JSON line to `~/.local/state/ork/disk-cleanup-ledger.jsonl`
(override with `--ledger`), plus one summary line per run.

## Scope

macOS first, Linux second. Windows is not supported. The skill frees disk space only:
it does not stop sessions, delete branches, or touch anything outside the home directory.

## Related Skills

- `ork:dev`: stop a branch's dev loop before its worktree is removed.
- `ork:doctor`: project and plugin health, the other maintenance check next to disk space.
- `ork:careful`: guard destructive shell commands while a cleanup runs.

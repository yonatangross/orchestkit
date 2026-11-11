---
description: "Frees the disk that AI agents and git worktrees leave behind: package and build caches, merged worktrees, Docker build cache, old agent logs. Prints a safe, regenerable and ask-first inventory with sizes, dry run by default, --apply after confirmation. Use when the disk is nearly full, free space keeps shrinking, or after many agents or worktrees ran. Disk space only: it never closes sessions or deletes branches."
argument-hint: "[--apply] [--only ID] [--tier safe|regenerable] [--root DIR] [--json]"
disable-model-invocation: false
effort: low
user-invocable: true
name: disk-cleanup
allowed-tools: Bash, Read
---

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
   (or equals the head of a merged PR), the tree is clean, it is not locked, no process has
   its working directory inside, nothing in it changed for 60 minutes, and it sits under
   the home directory. Removal is `git worktree remove` without force. The branch stays.
5. **Report the measured number.** The freed total is free space before versus after. The
   inventory total is an estimate and is labelled as one.

## Instructions

1. Dry run. From a repo you work in (the script scans its worktrees) or with `--root DIR`
   for a folder that holds several repos:

   ```bash
   python3 "skills/disk-cleanup/scripts/disk_cleanup.py"
   python3 "skills/disk-cleanup/scripts/disk_cleanup.py" --root ~/code
   ```

   Exit 0 means nothing to clean, 3 means findings, 2 means it could not look.
2. Show the user the inventory as printed. Lead with the verdict line, then name the three
   biggest rows and any KEEP lines that explain why a worktree was left alone.
3. Ask the user to confirm. Offer the narrower forms when they hesitate:
   `--tier safe` (caches only) or `--only npm-cache` (one item id, or a section such as `docker`).
4. Apply:

   ```bash
   python3 "skills/disk-cleanup/scripts/disk_cleanup.py" --apply
   python3 "skills/disk-cleanup/scripts/disk_cleanup.py" --apply --tier safe
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

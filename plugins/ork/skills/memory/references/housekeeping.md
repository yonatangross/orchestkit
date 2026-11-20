# Dream housekeeping (STEP 7 and STEP 8)

## STEP 7: Plugin Housekeeping (CC 2.1.121+, #1544)

After memory consolidation, check for orphaned auto-installed plugin dependencies and offer to prune them:

```bash
# Detect orphans
claude plugin list --json | jq '[.[] | select(.auto_installed == true and .reason_kept == "orphaned")] | length'

# If > 0 and last prune > 7 days ago (track in .claude/state/last-prune.txt):
claude plugin prune  # interactive — confirms before removing
```

Skip this step on CC < 2.1.121. The state file `.claude/state/last-prune.txt` records the last successful prune date so we don't run it on every dream invocation.

---

## STEP 8: Stale Project State Hint (CC 2.1.126+, #1582, fixed in #1587)

After plugin housekeeping, surface a non-blocking suggestion when stale project state exists. Never execute the purge — only preview it.

```bash
# Skip on CC < 2.1.126 (no `claude project purge` available)

# Detect stale projects via the authoritative source: `claude project purge --dry-run --all`
# emits `config: projects["<canonical-path>"]` lines that come straight from ~/.claude.json.
# Parsing these is lossless; the directory-name encoding under ~/.claude/projects/ is NOT
# (both `/` and `.` collapse to `-`, so it cannot be reversed deterministically).
stale_count=$(claude project purge --dry-run --all 2>/dev/null \
  | grep -oE 'projects\["[^"]+"\]' \
  | sed -E 's/^projects\["//; s/"\]$//' \
  | while IFS= read -r p; do
      [ -n "$p" ] && [ ! -d "$p" ] && echo "$p"
    done | wc -l)

# If > 0, surface the hint in the dream summary (never auto-execute)
if [ "$stale_count" -gt 0 ]; then
  echo "ℹ $stale_count stale project state entries detected."
  echo "   Preview cleanup with: claude project purge --dry-run --all"
fi
```

**Strict rules:** always `--dry-run`, never `--yes`. Users who moved (not deleted) a project need to keep the directory; the purge is irreversible. Surface the suggestion, let the user decide.

**Why parse `claude project purge --dry-run --all` instead of `~/.claude/projects/`:** the directory naming under `~/.claude/projects/` is a lossy collapse of the original path (`/` and `.` both become `-`). A naive `sed 's|-|/|g'` decode misidentifies any path containing `-` (e.g. `my-project` → `/my/project`). The CLI's dry-run output reads canonical paths from `~/.claude.json` and is the only reliable source.

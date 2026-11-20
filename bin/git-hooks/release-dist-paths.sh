#!/usr/bin/env bash
# Print staged release bundles that are feature edits, not inherited from main.
set -euo pipefail
incoming_main=false
# silent: merge-ref-probe
if git rev-parse --verify MERGE_HEAD >/dev/null 2>&1 \
  && git merge-base --is-ancestor MERGE_HEAD refs/remotes/origin/main 2>/dev/null; then  # silent: merge-ref-probe
  incoming_main=true
fi
while IFS= read -r path; do
  case "$path" in
    src/hooks/dist/*|plugins/ork/hooks/dist/*)
      # Compare the index, not the worktree: a local build may have run already.
      if "$incoming_main" && git diff --cached --quiet MERGE_HEAD -- "$path"; then
        continue
      fi
      # Plain restore to the origin/main tip (no MERGE_HEAD) is inherited too.
      # Matches ci.yml's release-owned gate: equals the base tip, not mid-merge.
      if git diff --cached --quiet refs/remotes/origin/main -- "$path"; then
        continue
      fi
      printf '%s\n' "$path"
      ;;
  esac
done

#!/usr/bin/env bash
set -euo pipefail

# Diff Scanner for /ork:expect (#1166)
# Usage: bash diff-scan.sh [changes|unstaged|branch|commit] [commit-hash]
# Output: JSON with 3 data levels — files, stats, preview
#
# Target modes:
#   changes  (default) — committed + uncommitted combined
#   unstaged           — only uncommitted changes (git diff)
#   branch             — full branch diff vs main
#   commit [hash]      — single commit diff

TARGET="${1:-changes}"
COMMIT_HASH="${2:-}"
MAX_FILES=12
MAX_PREVIEW_CHARS=12000

# ── Resolve diff base ──────────────────────────────────────
case "$TARGET" in
  changes)
    # Committed (branch) + uncommitted combined
    BASE=$(git merge-base main HEAD 2>/dev/null || echo "HEAD~1")
    DIFF_ARGS="${BASE}"
    ;;
  unstaged)
    DIFF_ARGS=""  # git diff (working tree vs index)
    ;;
  branch)
    BASE=$(git merge-base main HEAD 2>/dev/null || echo "HEAD~1")
    DIFF_ARGS="${BASE}...HEAD"
    ;;
  commit)
    if [[ -n "$COMMIT_HASH" ]]; then
      DIFF_ARGS="${COMMIT_HASH}^..${COMMIT_HASH}"
    else
      DIFF_ARGS="HEAD~1..HEAD"
    fi
    ;;
  *)
    echo "Unknown target: $TARGET (use: changes|unstaged|branch|commit)" >&2
    exit 1
    ;;
esac

# ── Level 1: Changed files with status ─────────────────────
FILES_RAW=$(git diff ${DIFF_ARGS} --name-only --diff-filter=AMDRC 2>/dev/null || true)

if [[ -z "$FILES_RAW" ]]; then
  echo '{"target":"'"$TARGET"'","files":[],"stats":[],"preview":"","context":[],"summary":{"total":0}}'
  exit 0
fi

# Build files JSON with status detection
FILE_JSON="["
FIRST=true
FILE_COUNT=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  # Skip non-source files
  if echo "$file" | grep -qE '\.(lock|log|map)$|node_modules/|\.git/|dist/|build/'; then
    continue
  fi

  # Get status from diff-filter
  STATUS=$(git diff ${DIFF_ARGS} --name-status --diff-filter=AMDRC 2>/dev/null | grep -F "$file" | cut -f1 | head -1 || echo "M")
  case "$STATUS" in
    A) STATUS_LABEL="added" ;;
    D) STATUS_LABEL="deleted" ;;
    R*) STATUS_LABEL="renamed" ;;
    C) STATUS_LABEL="copied" ;;
    *) STATUS_LABEL="modified" ;;
  esac

  # Detect file type
  case "$file" in
    *.tsx|*.jsx) TYPE="component" ;;
    *.ts|*.js)   TYPE="logic" ;;
    *.css|*.scss|*.tailwind*) TYPE="style" ;;
    *.md|*.mdx)  TYPE="docs" ;;
    *.json|*.yaml|*.yml|*.toml) TYPE="config" ;;
    *.test.*|*.spec.*|*__tests__*) TYPE="test" ;;
    *.sh) TYPE="script" ;;
    *.py) TYPE="python" ;;
    *) TYPE="other" ;;
  esac

  if [[ "$FIRST" == "true" ]]; then
    FIRST=false
  else
    FILE_JSON+=","
  fi
  FILE_JSON+='{"path":"'"$file"'","status":"'"$STATUS_LABEL"'","type":"'"$TYPE"'"}'
  FILE_COUNT=$((FILE_COUNT + 1))
done <<< "$FILES_RAW"
FILE_JSON+="]"

# ── Level 2: File stats (lines added/removed) ──────────────
STATS_JSON="["
STATS_FIRST=true
STAT_ENTRIES=0

while IFS=$'\t' read -r added removed file; do
  [[ -z "$file" ]] && continue
  [[ "$added" == "-" ]] && added="0"
  [[ "$removed" == "-" ]] && removed="0"

  # Skip non-source
  echo "$file" | grep -qE '\.(lock|log|map)$|node_modules/' && continue

  MAGNITUDE=$((added + removed))

  if [[ "$STATS_FIRST" == "true" ]]; then
    STATS_FIRST=false
  else
    STATS_JSON+=","
  fi
  STATS_JSON+='{"path":"'"$file"'","added":'"$added"',"removed":'"$removed"',"magnitude":'"$MAGNITUDE"'}'
  STAT_ENTRIES=$((STAT_ENTRIES + 1))
done < <(git diff ${DIFF_ARGS} --numstat 2>/dev/null || true)
STATS_JSON+="]"

# ── Level 3: Diff preview (truncated to MAX_PREVIEW_CHARS) ──
# Prioritize files by magnitude (most changed first), limit to MAX_FILES
TOP_FILES=$(echo "$STATS_JSON" | python3 -c "
import sys, json
stats = json.load(sys.stdin)
sorted_stats = sorted(stats, key=lambda x: x.get('magnitude', 0), reverse=True)
for s in sorted_stats[:${MAX_FILES}]:
    print(s['path'])
" 2>/dev/null || echo "$FILES_RAW" | head -"$MAX_FILES")

PREVIEW=""
for file in $TOP_FILES; do
  CHUNK=$(git diff ${DIFF_ARGS} -- "$file" 2>/dev/null | head -80 || true)
  if [[ -n "$CHUNK" ]]; then
    PREVIEW+="--- $file ---"$'\n'"$CHUNK"$'\n\n'
  fi
  # Truncate if over limit
  if [[ ${#PREVIEW} -gt $MAX_PREVIEW_CHARS ]]; then
    PREVIEW="${PREVIEW:0:$MAX_PREVIEW_CHARS}...[truncated at ${MAX_PREVIEW_CHARS} chars]"
    break
  fi
done

# Escape preview for JSON
PREVIEW_ESCAPED=$(echo "$PREVIEW" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')

# ── Context: recent commits ────────────────────────────────
CONTEXT_JSON="["
CONTEXT_FIRST=true
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  ESCAPED=$(echo "$line" | sed 's/"/\\"/g')
  if [[ "$CONTEXT_FIRST" == "true" ]]; then
    CONTEXT_FIRST=false
  else
    CONTEXT_JSON+=","
  fi
  CONTEXT_JSON+='"'"$ESCAPED"'"'
done < <(git log --oneline -5 2>/dev/null || true)
CONTEXT_JSON+="]"

# ── Output ──────────────────────────────────────────────────
cat <<ENDJSON
{
  "target": "$TARGET",
  "files": $FILE_JSON,
  "stats": $STATS_JSON,
  "preview": $PREVIEW_ESCAPED,
  "context": $CONTEXT_JSON,
  "summary": {
    "total": $FILE_COUNT,
    "top_files_in_preview": $MAX_FILES,
    "preview_chars": ${#PREVIEW},
    "max_preview_chars": $MAX_PREVIEW_CHARS
  }
}
ENDJSON

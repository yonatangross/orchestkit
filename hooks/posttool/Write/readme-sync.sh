#!/bin/bash
set -euo pipefail
# README Sync Hook for Claude Code
# After significant code changes, suggests README updates
# Tracks: new exports, API changes, config changes
# Hook: PostToolUse (Write)
# Issue: #140

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Get file path from tool output
FILE_PATH=$(get_field '.tool_input.file_path // ""')

# Skip if no file path
if [[ -z "$FILE_PATH" ]]; then
  output_silent_success
  exit 0
fi

# Skip internal files
case "$FILE_PATH" in
  */.claude/*|*/node_modules/*|*/.git/*|*/dist/*|*.lock|*.log)
    output_silent_success
    exit 0
    ;;
esac

# Skip test files - they don't typically require README updates
case "$FILE_PATH" in
  *test*|*spec*|*__tests__*)
    output_silent_success
    exit 0
    ;;
esac

# Get project directory
PROJ_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJ_DIR" 2>/dev/null || {
  output_silent_success
  exit 0
}

# Track what kind of change this is
CHANGE_TYPE=""
README_SECTION=""
SUGGESTION=""

# File extension
FILE_EXT="${FILE_PATH##*.}"
FILE_EXT_LOWER=$(printf '%s' "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

# Get just the filename
FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")

# Check for significant file types that typically need README updates

# 1. Package configuration files
case "$FILENAME" in
  package.json)
    # Check if this adds new scripts or dependencies
    if [[ -f "$FILE_PATH" ]]; then
      NEW_SCRIPTS=$(jq -r '.scripts | keys[]' "$FILE_PATH" 2>/dev/null | wc -l | tr -d ' ')
      if [[ "$NEW_SCRIPTS" -gt 5 ]]; then
        CHANGE_TYPE="scripts"
        README_SECTION="Available Scripts"
        SUGGESTION="Update README with new npm scripts"
      fi
    fi
    ;;
  pyproject.toml|setup.py|setup.cfg)
    CHANGE_TYPE="python-config"
    README_SECTION="Installation"
    SUGGESTION="Verify README installation instructions match project config"
    ;;
  Dockerfile|docker-compose.yml|docker-compose.yaml)
    CHANGE_TYPE="docker"
    README_SECTION="Docker / Deployment"
    SUGGESTION="Update README Docker instructions"
    ;;
  .env.example|.env.template)
    CHANGE_TYPE="env"
    README_SECTION="Environment Variables"
    SUGGESTION="Update README environment variable documentation"
    ;;
esac

# 2. API routes and endpoints
if [[ -z "$CHANGE_TYPE" ]]; then
  case "$FILE_PATH" in
    */api/*|*/routes/*|*/endpoints/*)
      CHANGE_TYPE="api"
      README_SECTION="API Endpoints"
      SUGGESTION="Update README API documentation or OpenAPI spec"
      ;;
  esac
fi

# 3. Configuration directories
if [[ -z "$CHANGE_TYPE" ]]; then
  case "$DIRNAME" in
    */config*|*/settings*)
      CHANGE_TYPE="config"
      README_SECTION="Configuration"
      SUGGESTION="Document new configuration options in README"
      ;;
  esac
fi

# 4. Main entry points / index files
if [[ -z "$CHANGE_TYPE" ]]; then
  case "$FILENAME" in
    index.ts|index.js|main.py|app.py|__init__.py)
      # Check if this is a top-level or important module
      DEPTH=$(echo "$FILE_PATH" | tr '/' '\n' | wc -l | tr -d ' ')
      if [[ "$DEPTH" -le 4 ]]; then
        CHANGE_TYPE="entry-point"
        README_SECTION="Getting Started"
        SUGGESTION="Review README getting started section for accuracy"
      fi
      ;;
  esac
fi

# 5. CLI tools and bin scripts
if [[ -z "$CHANGE_TYPE" ]]; then
  case "$FILE_PATH" in
    */bin/*|*/cli/*|*/scripts/*)
      if [[ "$FILE_EXT_LOWER" == "sh" || "$FILE_EXT_LOWER" == "py" || "$FILE_EXT_LOWER" == "ts" ]]; then
        CHANGE_TYPE="cli"
        README_SECTION="CLI / Commands"
        SUGGESTION="Update README CLI usage documentation"
      fi
      ;;
  esac
fi

# 6. Public exports (index files with exports)
if [[ -z "$CHANGE_TYPE" && "$FILENAME" == "index.ts" || "$FILENAME" == "index.js" ]]; then
  # Check if file has exports
  if [[ -f "$FILE_PATH" ]] && grep -q "^export" "$FILE_PATH" 2>/dev/null; then
    EXPORT_COUNT=$(grep -c "^export" "$FILE_PATH" 2>/dev/null || echo "0")
    if [[ "$EXPORT_COUNT" -gt 5 ]]; then
      CHANGE_TYPE="exports"
      README_SECTION="API Reference"
      SUGGESTION="Consider updating API reference with new exports"
    fi
  fi
fi

# If no significant change detected, exit silently
if [[ -z "$CHANGE_TYPE" ]]; then
  output_silent_success
  exit 0
fi

# Check if README exists
README_PATH=""
for readme in "README.md" "Readme.md" "readme.md" "README.rst" "README"; do
  if [[ -f "$PROJ_DIR/$readme" ]]; then
    README_PATH="$PROJ_DIR/$readme"
    break
  fi
done

# Build suggestion message
if [[ -n "$README_PATH" ]]; then
  # Check when README was last modified
  README_MOD=$(stat -f%m "$README_PATH" 2>/dev/null || stat -c%Y "$README_PATH" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  DAYS_OLD=$(( (NOW - README_MOD) / 86400 ))

  if [[ "$DAYS_OLD" -gt 30 ]]; then
    SUGGESTION="$SUGGESTION (README last updated ${DAYS_OLD}+ days ago)"
  fi

  CONTEXT_MSG="README sync: $CHANGE_TYPE change in $FILENAME. Section: '$README_SECTION'. $SUGGESTION"
else
  CONTEXT_MSG="README sync: $CHANGE_TYPE change detected but no README.md found. Consider creating one."
fi

# Truncate if too long
if [[ ${#CONTEXT_MSG} -gt 200 ]]; then
  CONTEXT_MSG="README sync: $CHANGE_TYPE change detected. Consider updating '$README_SECTION' section."
fi

# Log the suggestion
LOG_DIR="$PROJ_DIR/.claude/hooks/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "[$(date -Iseconds)] README_SYNC: $CHANGE_TYPE change in $FILE_PATH -> $README_SECTION" >> "$LOG_DIR/readme-sync.log" 2>/dev/null || true

log_hook "README_SYNC: $CHANGE_TYPE change suggests README update"

# Output using CC 2.1.9 additionalContext format
output_with_context "$CONTEXT_MSG"
output_silent_success
exit 0

#!/bin/bash
# Common utilities for Claude Code hooks
# Source this file: source "$(dirname "$0")/../_lib/common.sh"

# Colors for output (only if stderr is a terminal)
if [[ -t 2 ]]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'
  CYAN=$'\033[0;36m'
  NC=$'\033[0m' # No Color
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Log directory
HOOK_LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$HOOK_LOG_DIR" 2>/dev/null

# Hook input caching
# IMPORTANT: Scripts must call init_hook_input BEFORE any $(get_field ...) calls
# because command substitution runs in subshells that can't share variables.
_HOOK_INPUT="${_HOOK_INPUT:-}"

# Initialize hook input - MUST be called at top of script before any get_field calls
# Usage: init_hook_input (reads from stdin)
# Usage: init_hook_input "$existing_data" (uses provided data)
init_hook_input() {
  if [[ -n "${1:-}" ]]; then
    # Use provided data
    _HOOK_INPUT="$1"
  elif [[ -z "$_HOOK_INPUT" ]]; then
    # Read from stdin with timeout
    if ! IFS= read -r -t 2 -d '' _HOOK_INPUT 2>/dev/null; then
      # Timeout or EOF reached - that's fine, use what we got
      :
    fi
  fi
  export _HOOK_INPUT
}

# Legacy function - now just returns cached input
read_hook_input() {
  # If not initialized, try to initialize (backwards compatibility)
  if [[ -z "$_HOOK_INPUT" ]]; then
    init_hook_input
  fi
  echo "$_HOOK_INPUT"
}

# Extract field from hook input using jq
# Usage: get_field '.tool_input.command'
#
# SECURITY (ME-002): This function passes the first argument directly to jq.
# ONLY pass STATIC filter strings - never pass user-controlled input!
#
# Safe:   get_field '.tool_input.file_path'
# Safe:   get_field '.session_id'
# UNSAFE: get_field "$USER_INPUT"  # NEVER DO THIS - jq filter injection risk
#
get_field() {
  local filter="$1"
  # SEC-006 fix: Validate filter contains only safe jq characters
  # Allow: . a-z A-Z 0-9 _ (covers 99% of legitimate jq filters)
  # Note: This is intentionally restrictive. If brackets are needed,
  # use a different approach or extend the pattern carefully.
  case "$filter" in
    *[!.a-zA-Z0-9_]*)
      log_hook "ERROR: Invalid jq filter pattern rejected: $filter"
      echo ""
      return 1
      ;;
  esac
  local input=$(read_hook_input)
  echo "$input" | jq -r "$filter // \"\"" 2>/dev/null
}

# Get tool name
get_tool_name() {
  get_field '.tool_name'
}

# Get session ID
get_session_id() {
  get_field '.session_id'
}

# Rotate log file if it exceeds size limit (with lazy checking and file locking)
# Usage: rotate_log_file "logfile" "max_size_kb"
# Only checks file size every 100 writes to reduce file system operations
rotate_log_file() {
  local logfile="$1"
  local max_size_kb="${2:-200}"  # Default 200KB
  local max_size_bytes=$((max_size_kb * 1024))
  local rotation_check_interval=100  # Check every 100 writes

  # Use file-based counter for thread-safe lazy checking
  local count_file="${logfile}.count"
  # Read only last line and strip non-digits to handle corrupted files
  local prev_count=$(tail -1 "$count_file" 2>/dev/null | tr -cd '0-9')
  prev_count=${prev_count:-0}
  local count=$((prev_count + 1))
  echo "$count" > "$count_file" 2>/dev/null || true

  # Only check file size every N writes (lazy rotation)
  if [[ $((count % rotation_check_interval)) -ne 0 ]]; then
    return 0
  fi

  # Use file locking to prevent concurrent rotations
  local lockfile="${logfile}.lock"
  if ! [[ -f "$logfile" ]]; then
    return 0
  fi

  # Try to acquire lock (non-blocking)
  (
    if command -v flock >/dev/null 2>&1; then
      # Use flock for atomic locking (preferred)
      flock -n 9 || return 0  # Non-blocking, skip if locked

      # Check file size inside the lock
      local size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
      if [[ $size -gt $max_size_bytes ]]; then
        # Rotate: compress old log and truncate
        local rotated="${logfile}.old.$(date +%Y%m%d-%H%M%S)"
        mv "$logfile" "$rotated" 2>/dev/null || return 0

        # Compress if gzip available
        if command -v gzip >/dev/null 2>&1; then
          gzip "$rotated" 2>/dev/null || true
          rotated="${rotated}.gz"
        fi

        # Optimized cleanup: use find -delete instead of xargs rm
        local logdir=$(dirname "$logfile")
        local logbase=$(basename "$logfile")

        # Keep only last 5 rotated logs (more efficient: delete oldest first)
        find "$logdir" -maxdepth 1 -name "${logbase}.old.*" -type f 2>/dev/null | \
          sort -r | tail -n +6 | while IFS= read -r oldfile; do
            rm -f "$oldfile" 2>/dev/null || true
          done
      fi
    else
      # Fallback: simple lock file check (less reliable but works without flock)
      if [[ -f "$lockfile" ]]; then
        # Lock exists, skip rotation
        return 0
      fi

      # Create lock file
      echo "$$" > "$lockfile" 2>/dev/null || return 0

      # Check file size
      local size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
      if [[ $size -gt $max_size_bytes ]]; then
        local rotated="${logfile}.old.$(date +%Y%m%d-%H%M%S)"
        mv "$logfile" "$rotated" 2>/dev/null || {
          rm -f "$lockfile" 2>/dev/null
          return 0
        }

        if command -v gzip >/dev/null 2>&1; then
          gzip "$rotated" 2>/dev/null || true
          rotated="${rotated}.gz"
        fi

        local logdir=$(dirname "$logfile")
        local logbase=$(basename "$logfile")
        find "$logdir" -maxdepth 1 -name "${logbase}.old.*" -type f 2>/dev/null | \
          sort -r | tail -n +6 | while IFS= read -r oldfile; do
            rm -f "$oldfile" 2>/dev/null || true
          done
      fi

      # Remove lock file
      rm -f "$lockfile" 2>/dev/null || true
    fi
  ) 9>"$lockfile" 2>/dev/null || {
    # If flock fails or lockfile creation fails, skip rotation (fail-safe)
    return 0
  }
}

# Log to hook log file with automatic rotation
# Usage: log_hook "message"
log_hook() {
  local msg="$1"
  local logfile="$HOOK_LOG_DIR/hooks.log"

  # Rotate if needed (200KB limit)
  rotate_log_file "$logfile" 200

  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local hook_name=$(basename "${BASH_SOURCE[1]:-$0}" .sh)
  echo "[$timestamp] [$hook_name] $msg" >> "$logfile"
}

# Print info message to stderr
info() {
  echo -e "${BLUE}ℹ${NC} $1" >&2
}

# Print success message to stderr
success() {
  echo -e "${GREEN}✓${NC} $1" >&2
}

# Print warning message to stderr
warn() {
  echo -e "${YELLOW}⚠${NC} $1" >&2
}

# Print error message to stderr
error() {
  echo -e "${RED}✗${NC} $1" >&2
}

# Block with formatted error box
# Usage: block_with_error "Title" "Message"
block_with_error() {
  local title="$1"
  local message="$2"
  cat >&2 << ERREOF
╔══════════════════════════════════════════════════════════════════════════════╗
║  🚫 BLOCKED: $title
╚══════════════════════════════════════════════════════════════════════════════╝

$message

ERREOF
  exit 2
}

# Warn with formatted warning box (doesn't block)
# Usage: warn_with_box "Title" "Message"
warn_with_box() {
  local title="$1"
  local message="$2"
  cat >&2 << WARNEOF
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  WARNING: $title
╚══════════════════════════════════════════════════════════════════════════════╝

$message

WARNEOF
}

# Check if command matches a pattern
# Usage: command_matches "git commit"
command_matches() {
  local pattern="$1"
  local cmd=$(get_field '.tool_input.command')
  [[ "$cmd" =~ $pattern ]]
}

# Get current git branch
get_current_branch() {
  cd "$CLAUDE_PROJECT_DIR" && git branch --show-current 2>/dev/null
}

# Check if on protected branch
is_protected_branch() {
  local branch=$(get_current_branch)
  [[ "$branch" == "dev" || "$branch" == "main" || "$branch" == "master" ]]
}

# Metrics file path
METRICS_FILE="/tmp/claude-session-metrics.json"

# Update metrics counter
# Usage: increment_metric "tool_name"
# SEC-007 fix: Use jq --arg for safe variable interpolation
increment_metric() {
  local tool="$1"
  local session_id=$(get_session_id)

  if [[ ! -f "$METRICS_FILE" ]]; then
    echo '{"tools":{},"sessions":{}}' > "$METRICS_FILE"
  fi

  # SEC-007 fix: Use jq --arg for safe variable interpolation (prevents injection)
  local current=$(jq -r --arg t "$tool" '.tools[$t] // 0' "$METRICS_FILE")
  jq --arg t "$tool" --argjson v "$((current + 1))" '.tools[$t] = $v' "$METRICS_FILE" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}


# Export functions for subshells
export -f init_hook_input read_hook_input get_field get_tool_name get_session_id log_hook rotate_log_file info success warn error

# -----------------------------------------------------------------------------
# Configuration-aware hook enablement
# -----------------------------------------------------------------------------

# Config loader path
CONFIG_LOADER="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/config-loader.sh"

# Check if hook is enabled based on config
# Usage: is_hook_enabled_by_config "hook-name.sh"
# Returns 0 if enabled, 1 if disabled
is_hook_enabled_by_config() {
  local hook_name="$1"

  # If config loader doesn't exist, assume enabled (backwards compatibility)
  if [[ ! -x "$CONFIG_LOADER" ]]; then
    return 0
  fi

  local result
  result=$("$CONFIG_LOADER" is-hook-enabled "$hook_name" 2>/dev/null)
  [[ "$result" == "true" ]]
}

# Early exit if hook is disabled
# Usage: exit_if_disabled (call at top of hook script)
# This checks the current script's name against the config
exit_if_disabled() {
  local hook_name=$(basename "${BASH_SOURCE[1]:-$0}")

  if ! is_hook_enabled_by_config "$hook_name"; then
    # Output continue: true so Claude Code proceeds without this hook
    echo '{"continue": true}'
    exit 0
  fi
}

# Export config-aware functions
export -f is_hook_enabled_by_config exit_if_disabled

# -----------------------------------------------------------------------------
# Silent output helpers for hooks
# -----------------------------------------------------------------------------

# Output silent success - hook completed without errors, no user-visible output
# Usage: output_silent_success
output_silent_success() {
  echo '{"continue": true, "suppressOutput": true}'
}

# Output silent allow - permission hook approves silently
# Usage: output_silent_allow
output_silent_allow() {
  echo '{"decision":{"behavior":"allow"}, "continue": true, "suppressOutput": true}'
}

# Output error message - only use when there's an actual problem
# Usage: output_error "Error message"
output_error() {
  local msg="$1"
  jq -n --arg msg "$msg" '{continue: true, systemMessage: $msg}'
}

# Output block - stops the operation with an error
# Usage: output_block "Reason"
output_block() {
  local reason="$1"
  jq -n --arg r "$reason" '{continue: false, stopReason: $r}'
}

# Export output helpers
export -f output_silent_success output_silent_allow output_error output_block

# -----------------------------------------------------------------------------
# Safe Grep Utilities - Prevent shell injection from dynamic patterns
# -----------------------------------------------------------------------------
# These functions prevent the bug where code content (with backticks, braces,
# etc.) gets passed to grep and causes shell parsing errors.
#
# BACKGROUND: When searching for code patterns dynamically extracted from files,
# the content may contain regex metacharacters or shell special characters:
#   - Backticks ` trigger command substitution
#   - Braces {} are regex quantifiers
#   - Parentheses () are regex groups
#   - Brackets [] are character classes
#   - $, *, ?, +, ^, |, \ are all special
#
# Using these utilities ensures safe searching regardless of content.
# -----------------------------------------------------------------------------

# Escape a string for use as a grep regex pattern
# Usage: escaped=$(escape_grep_pattern "$raw_string")
# Returns: String with all regex metacharacters escaped
escape_grep_pattern() {
  local raw="$1"
  # Escape BRE metacharacters: \ . * ^ $ [ ]
  # Also escape ERE metacharacters for -E mode: + ? { } | ( )
  printf '%s' "$raw" | sed -e 's/[[\.*^$()+?{|\\]/\\&/g'
}

# Search for a literal string (no regex interpretation)
# Usage: grep_literal "search_string" file1 file2 ...
# Usage: echo "$content" | grep_literal "search_string"
# Options: Pass grep options BEFORE the search string
#   grep_literal -l "string" files...   # list matching files
#   grep_literal -c "string" files...   # count matches
#   grep_literal -q "string" files...   # quiet mode (for conditionals)
grep_literal() {
  local opts=()

  # Collect options (arguments starting with -)
  while [[ $# -gt 0 && "$1" == -* ]]; do
    opts+=("$1")
    shift
  done

  local pattern="$1"
  shift

  # Use grep -F for fixed-string (literal) matching
  # This completely avoids regex interpretation
  if [[ $# -eq 0 ]]; then
    # Reading from stdin
    grep -F "${opts[@]}" -- "$pattern"
  else
    # Reading from files
    grep -F "${opts[@]}" -- "$pattern" "$@"
  fi
}

# Search with a safely escaped regex pattern
# Usage: grep_escaped "pattern_with_special_chars" file1 file2 ...
# Usage: echo "$content" | grep_escaped "pattern"
# Note: This escapes the pattern, so regex features won't work.
# For regex features with safe content, use standard grep.
grep_escaped() {
  local opts=()

  while [[ $# -gt 0 && "$1" == -* ]]; do
    opts+=("$1")
    shift
  done

  local pattern="$1"
  shift

  local escaped_pattern
  escaped_pattern=$(escape_grep_pattern "$pattern")

  if [[ $# -eq 0 ]]; then
    grep "${opts[@]}" -- "$escaped_pattern"
  else
    grep "${opts[@]}" -- "$escaped_pattern" "$@"
  fi
}

# Search for a word boundary match with literal content
# Usage: grep_word_literal "function_name" file1 file2 ...
# This is equivalent to grep -w but safer for special characters
grep_word_literal() {
  local opts=()

  while [[ $# -gt 0 && "$1" == -* ]]; do
    opts+=("$1")
    shift
  done

  local pattern="$1"
  shift

  # Use grep -Fw for fixed-string word matching
  if [[ $# -eq 0 ]]; then
    grep -Fw "${opts[@]}" -- "$pattern"
  else
    grep -Fw "${opts[@]}" -- "$pattern" "$@"
  fi
}

# Safe xargs grep for searching multiple files
# Usage: echo "$file_list" | xargs_grep_literal "pattern"
# Usage: echo "$file_list" | xargs_grep_literal -l "pattern"  # list files only
xargs_grep_literal() {
  local opts=()

  while [[ $# -gt 0 && "$1" == -* ]]; do
    opts+=("$1")
    shift
  done

  local pattern="$1"

  # Use xargs with grep -F for safe literal matching
  # --no-run-if-empty prevents grep from hanging on empty input
  xargs --no-run-if-empty grep -F "${opts[@]}" -- "$pattern" 2>/dev/null
}

# Safe xargs grep with word boundaries
# Usage: echo "$file_list" | xargs_grep_word "name"
xargs_grep_word() {
  local opts=()

  while [[ $# -gt 0 && "$1" == -* ]]; do
    opts+=("$1")
    shift
  done

  local pattern="$1"

  xargs --no-run-if-empty grep -Fw "${opts[@]}" -- "$pattern" 2>/dev/null
}

# Export safe grep functions
export -f escape_grep_pattern grep_literal grep_escaped grep_word_literal xargs_grep_literal xargs_grep_word

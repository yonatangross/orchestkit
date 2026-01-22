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
# Plugin root - where the plugin is installed
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}"

# Log directory
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  HOOK_LOG_DIR="${HOME}/.claude/logs/ork"
else
  HOOK_LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
fi
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
    # CRITICAL: Don't read from stdin at all - it can block even with timeout
    # If HOOK_INPUT is needed, it will be provided via environment variable
    # This prevents hanging during hook execution
    _HOOK_INPUT=""
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
# Safe:   get_field '.tool_output // .output // ""'
# UNSAFE: get_field "$USER_INPUT"  # NEVER DO THIS - jq filter injection risk
#
get_field() {
  local filter="$1"
  # SEC-006 fix: Block shell-dangerous characters only
  # Allow jq operators: // | [] {} () spaces - these are safe for jq
  # Block: backticks, $(), semicolons - these could cause shell injection
  case "$filter" in
    *'\`'*|*'$('*|*';'*)
      log_hook "ERROR: Potentially unsafe jq filter rejected: $filter"
      echo ""
      return 1
      ;;
  esac
  local input
  input=$(read_hook_input)
  echo "$input" | jq -r "$filter" 2>/dev/null || echo ""
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
  local prev_count
  prev_count=$(tail -1 "$count_file" 2>/dev/null | tr -cd '0-9' || true)
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
      local size
      size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
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
        local logdir
        logdir=$(dirname "$logfile")
        local logbase
        logbase=$(basename "$logfile")

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
      local size
      size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
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

        local logdir
        logdir=$(dirname "$logfile")
        local logbase
        logbase=$(basename "$logfile")
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

  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local hook_name
  hook_name=$(basename "${BASH_SOURCE[1]:-$0}" .sh)
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
  local cmd
  cmd=$(get_field '.tool_input.command')
  [[ "$cmd" =~ $pattern ]]
}

# Get current git branch
get_current_branch() {
  cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" && git branch --show-current 2>/dev/null
}

# Check if on protected branch
is_protected_branch() {
  local branch
  branch=$(get_current_branch)
  [[ "$branch" == "dev" || "$branch" == "main" || "$branch" == "master" ]]
}

# Metrics file path
METRICS_FILE="/tmp/claude-session-metrics.json"

# Update metrics counter
# Usage: increment_metric "tool_name"
# SEC-007 fix: Use jq --arg for safe variable interpolation
increment_metric() {
  local tool="$1"
  local session_id
  session_id=$(get_session_id)

  if [[ ! -f "$METRICS_FILE" ]]; then
    echo '{"tools":{},"sessions":{}}' > "$METRICS_FILE"
  fi

  # SEC-007 fix: Use jq --arg for safe variable interpolation (prevents injection)
  local current
  current=$(jq -r --arg t "$tool" '.tools[$t] // 0' "$METRICS_FILE")
  jq --arg t "$tool" --argjson v "$((current + 1))" '.tools[$t] = $v' "$METRICS_FILE" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}


# Export functions for subshells
export -f init_hook_input read_hook_input get_field get_tool_name get_session_id log_hook rotate_log_file info success warn error

# -----------------------------------------------------------------------------
# Configuration-aware hook enablement
# -----------------------------------------------------------------------------

# Config loader path
CONFIG_LOADER="${PLUGIN_ROOT}/.claude/scripts/config-loader.sh"

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
  local hook_name
  hook_name=$(basename "${BASH_SOURCE[1]:-$0}")

  if ! is_hook_enabled_by_config "$hook_name"; then
    # Output continue: true so Claude Code proceeds without this hook
    echo '{"continue": true, "suppressOutput": true}'
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
  echo '{"continue": true, "suppressOutput": true, "hookSpecificOutput": {"permissionDecision": "allow"}}'
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
  jq -n --arg r "$reason" '{continue:false,stopReason:$r,hookSpecificOutput:{permissionDecision:"deny",permissionDecisionReason:$r}}'
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

# -----------------------------------------------------------------------------
# Multi-Instance Detection Helpers
# -----------------------------------------------------------------------------

# Path to the coordination database
COORDINATION_DB_PATH="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

# Get the coordination database path
get_coordination_db() {
  echo "$COORDINATION_DB_PATH"
}

# Check if multi-instance coordination is enabled and available
is_multi_instance_enabled() {
  if ! command -v sqlite3 >/dev/null 2>&1; then
    return 1
  fi
  if [[ ! -f "$COORDINATION_DB_PATH" ]]; then
    return 1
  fi
  return 0
}

# Get current instance ID
get_instance_id() {
  local session_id="${CLAUDE_SESSION_ID:-}"
  if [[ -n "$session_id" ]]; then
    echo "$session_id"
  else
    echo "instance-$$-$(date +%s)"
  fi
}

# Initialize coordination database if it doesn't exist
init_coordination_db() {
  if ! command -v sqlite3 >/dev/null 2>&1; then
    log_hook "WARN: sqlite3 not available"
    return 1
  fi
  local db_dir
  db_dir=$(dirname "$COORDINATION_DB_PATH")
  mkdir -p "$db_dir" 2>/dev/null
  sqlite3 "$COORDINATION_DB_PATH" 'CREATE TABLE IF NOT EXISTS instances (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, last_heartbeat TEXT, status TEXT DEFAULT "active"); CREATE TABLE IF NOT EXISTS file_locks (file_path TEXT PRIMARY KEY, instance_id TEXT NOT NULL, acquired_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, instance_id TEXT NOT NULL, decision_type TEXT NOT NULL, decision_data TEXT, created_at TEXT NOT NULL);'
  return 0
}

# Escape string for SQLite (prevent SQL injection)
# Replaces single quotes with two single quotes
sqlite_escape() {
  local input="$1"
  # Use sed for reliable SQL escaping: replace ' with ''
  echo "$input" | sed "s/'/''/g"
}

# Check if a file is locked by another instance
is_file_locked_by_other() {
  local file_path="$1"
  local my_instance
  my_instance=$(get_instance_id)
  if ! is_multi_instance_enabled; then
    return 1
  fi
  local escaped_path
  escaped_path=$(sqlite_escape "$file_path")
  local lock_holder
  lock_holder=$(sqlite3 "$COORDINATION_DB_PATH" "SELECT instance_id FROM file_locks WHERE file_path = '$escaped_path';" 2>/dev/null)
  if [[ -z "$lock_holder" || "$lock_holder" == "$my_instance" ]]; then
    return 1
  fi
  return 0
}

# Acquire a file lock
acquire_file_lock() {
  local file_path="$1"
  local my_instance
  my_instance=$(get_instance_id)
  if ! is_multi_instance_enabled; then
    return 0
  fi
  if is_file_locked_by_other "$file_path"; then
    return 1
  fi
  local escaped_path
  escaped_path=$(sqlite_escape "$file_path")
  sqlite3 "$COORDINATION_DB_PATH" "INSERT OR REPLACE INTO file_locks (file_path, instance_id, acquired_at) VALUES ('$escaped_path', '$my_instance', datetime('now'));" 2>/dev/null
  return 0
}

# Release a file lock
release_file_lock() {
  local file_path="$1"
  local my_instance
  my_instance=$(get_instance_id)
  if ! is_multi_instance_enabled; then
    return 0
  fi
  local escaped_path
  escaped_path=$(sqlite_escape "$file_path")
  sqlite3 "$COORDINATION_DB_PATH" "DELETE FROM file_locks WHERE file_path = '$escaped_path' AND instance_id = '$my_instance';" 2>/dev/null
  return 0
}

# Release all locks held by current instance
release_all_locks() {
  local my_instance
  my_instance=$(get_instance_id)
  if ! is_multi_instance_enabled; then
    return 0
  fi
  sqlite3 "$COORDINATION_DB_PATH" "DELETE FROM file_locks WHERE instance_id = '$my_instance';" 2>/dev/null
  return 0
}

# Export multi-instance functions
export -f get_coordination_db is_multi_instance_enabled get_instance_id init_coordination_db
export -f is_file_locked_by_other acquire_file_lock release_file_lock release_all_locks sqlite_escape

# -----------------------------------------------------------------------------
# CC 2.1.7: Permission Feedback Functions
# -----------------------------------------------------------------------------

# Log permission decision for audit trail (CC 2.1.7 feature)
# Usage: log_permission_feedback "allow|deny" "reason"
log_permission_feedback() {
  local decision="$1"
  local reason="${2:-unspecified}"
  local log_file="${HOOK_LOG_DIR}/permission-feedback.log"

  # Rotate if needed
  rotate_log_file "$log_file" 100

  local timestamp
  timestamp=$(date -Iseconds)
  local tool_name
  tool_name=$(get_tool_name 2>/dev/null || echo "unknown")
  local session_id
  session_id=$(get_session_id 2>/dev/null || echo "unknown")

  echo "$timestamp | $decision | $reason | tool=$tool_name | session=$session_id" >> "$log_file"
  log_hook "Permission: $decision - $reason (tool=$tool_name)"
}

# Silent approval with feedback logging (CC 2.1.7)
# Usage: output_silent_allow_with_feedback "reason for approval"
output_silent_allow_with_feedback() {
  local reason="${1:-auto-approved}"
  log_permission_feedback "allow" "$reason"
  echo '{"continue": true, "suppressOutput": true, "hookSpecificOutput": {"permissionDecision": "allow"}}'
}

# Deny with feedback logging (CC 2.1.7)
# Usage: output_deny_with_feedback "reason for denial"
output_deny_with_feedback() {
  local reason="${1:-policy-violation}"
  log_permission_feedback "deny" "$reason"
  jq -n --arg r "$reason" '{decision:{behavior:"deny"},continue:false,stopReason:$r,hookSpecificOutput:{permissionDecision:"deny",permissionDecisionReason:$r}}'
}

# Export CC 2.1.7 permission feedback functions
export -f log_permission_feedback output_silent_allow_with_feedback output_deny_with_feedback

# -----------------------------------------------------------------------------
# CC 2.1.7 Output Helpers - ANSI-free JSON output
# -----------------------------------------------------------------------------

# Output warning message - CC 2.1.7 compliant (no ANSI in JSON)
# Usage: output_warning "Warning message"
output_warning() {
  local msg="$1"
  # Use Unicode emoji ⚠ instead of ANSI colors - safe for JSON
  jq -n --arg msg "⚠ $msg" '{continue: true, systemMessage: $msg}'
}

# Output PostToolUse feedback - CC 2.1.7 format
# Usage: output_posttool_feedback "message" [block]
# The "decision: block" field is required for Claude to see the reason
output_posttool_feedback() {
  local msg="$1"
  local block="${2:-false}"
  if [[ "$block" == "true" ]]; then
    jq -n --arg r "$msg" '{decision:"block",reason:$r,continue:false}'
  else
    # Even for non-blocking feedback, use decision:block format so Claude sees it
    jq -n --arg r "$msg" '{decision:"block",reason:$r,continue:true}'
  fi
}

# Strip ANSI escape codes from a string
# Usage: clean_msg=$(strip_ansi "$msg_with_colors")
strip_ansi() {
  echo "$1" | sed 's/\x1b\[[0-9;]*m//g'
}

# Export CC 2.1.7 helpers
export -f output_warning output_posttool_feedback strip_ansi

# -----------------------------------------------------------------------------
# CC 2.1.9: PreToolUse additionalContext Helpers
# -----------------------------------------------------------------------------
# These functions inject contextual information BEFORE tool execution.
# additionalContext appears in the model's context, enabling proactive guidance.

# Output with additionalContext - injects context before tool execution (CC 2.1.9)
# Usage: output_with_context "Context to inject before tool execution"
output_with_context() {
  local ctx="$1"
  jq -n --arg c "$ctx" \
    '{continue:true,suppressOutput:true,hookSpecificOutput:{additionalContext:$c}}'
}

# Output allow with additionalContext - permission hook approves with context (CC 2.1.9)
# Usage: output_allow_with_context "Context to inject" ["optional_system_message"]
output_allow_with_context() {
  local ctx="$1"
  local msg="${2:-}"

  if [[ -n "$msg" ]]; then
    jq -n --arg c "$ctx" --arg m "$msg" \
      '{continue:true,systemMessage:$m,hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$c,permissionDecision:"allow"}}'
  else
    jq -n --arg c "$ctx" \
      '{continue:true,suppressOutput:true,hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$c,permissionDecision:"allow"}}'
  fi
}

# Output allow with context and logged permission feedback (CC 2.1.9)
# Usage: output_allow_with_context_logged "Context" "reason for audit"
output_allow_with_context_logged() {
  local ctx="$1"
  local reason="${2:-auto-approved-with-context}"
  log_permission_feedback "allow" "$reason"
  jq -n --arg c "$ctx" \
    '{continue:true,suppressOutput:true,hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$c,permissionDecision:"allow"}}'
}

# Export CC 2.1.9 additionalContext helpers
export -f output_with_context output_allow_with_context output_allow_with_context_logged

# -----------------------------------------------------------------------------
# CC 2.1.9: Session ID Helpers
# -----------------------------------------------------------------------------
# Direct ${CLAUDE_SESSION_ID} substitution is now reliable in CC 2.1.9.
# These helpers provide session-scoped paths without fallback complexity.

# Get session-scoped state directory path (CC 2.1.9)
# Usage: state_dir=$(get_session_state_dir)
get_session_state_dir() {
  echo "${CLAUDE_PROJECT_DIR:-.}/.claude/context/sessions/${CLAUDE_SESSION_ID:-unknown}"
}

# Get session-scoped temp file path (CC 2.1.9)
# Usage: tmp_file=$(get_session_temp_file "mcp-defer-state.json")
get_session_temp_file() {
  local filename="$1"
  echo "/tmp/claude-session-${CLAUDE_SESSION_ID:-unknown}/${filename}"
}

# Ensure session temp directory exists and return path (CC 2.1.9)
# Usage: tmp_dir=$(ensure_session_temp_dir)
ensure_session_temp_dir() {
  local tmp_dir="/tmp/claude-session-${CLAUDE_SESSION_ID:-unknown}"
  mkdir -p "$tmp_dir" 2>/dev/null || true
  echo "$tmp_dir"
}

# Export CC 2.1.9 session ID helpers
export -f get_session_state_dir get_session_temp_file ensure_session_temp_dir

# -----------------------------------------------------------------------------
# CC 2.1.7 Self-Guard Helpers
# -----------------------------------------------------------------------------

# Guard: Only run for specific file extensions
# Note: Uses tr for case-insensitive comparison (Bash 3.2 compatible - no ${,,} syntax)
guard_file_extension() {
  local file_path
  file_path=$(get_field '.tool_input.file_path // ""')
  [[ -z "$file_path" ]] && { output_silent_success; return 1; }
  local ext="${file_path##*.}"
  # Convert to lowercase using tr (Bash 3.2 compatible)
  local ext_lower
  ext_lower=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')
  for allowed_ext in "$@"; do
    local allowed_lower
    allowed_lower=$(printf '%s' "$allowed_ext" | tr '[:upper:]' '[:lower:]')
    [[ "$ext_lower" == "$allowed_lower" ]] && return 0
  done
  output_silent_success
  return 1
}

# Guard: Only run for code files
guard_code_files() {
  guard_file_extension "py" "ts" "tsx" "js" "jsx" "go" "rs" "java"
}

# Guard: Only run for Python files
guard_python_files() { guard_file_extension "py"; }

# Guard: Only run for TypeScript/JavaScript files
guard_typescript_files() { guard_file_extension "ts" "tsx" "js" "jsx"; }

# Guard: Only run for test files
guard_test_files() {
  local file_path
  file_path=$(get_field '.tool_input.file_path // ""')
  [[ -z "$file_path" ]] && { output_silent_success; return 1; }
  case "$file_path" in *test*|*spec*|*Test*|*Spec*) return 0 ;; esac
  output_silent_success
  return 1
}

# Guard: Only run for files matching path pattern
guard_path_pattern() {
  local file_path
  file_path=$(get_field '.tool_input.file_path // ""')
  [[ -z "$file_path" ]] && { output_silent_success; return 1; }
  for pattern in "$@"; do [[ "$file_path" == $pattern ]] && return 0; done
  output_silent_success
  return 1
}

# Guard: Skip internal/generated files
guard_skip_internal() {
  local fp
  fp=$(get_field '.tool_input.file_path // ""')
  [[ -z "$fp" ]] && return 0
  case "$fp" in */.claude/*|*/node_modules/*|*/.git/*|*/dist/*|*.lock)
    output_silent_success; return 1 ;; esac
  return 0
}

# Guard: Only run for non-trivial bash commands
guard_nontrivial_bash() {
  local cmd
  cmd=$(get_field '.tool_input.command // ""')
  case "$cmd" in echo\ *|ls\ *|ls|pwd|cat\ *|head\ *|tail\ *|wc\ *|date|whoami)
    output_silent_success; return 1 ;; esac
  return 0
}

# Guard: Only run if multi-instance coordination is enabled
guard_multi_instance() {
  is_multi_instance_enabled && return 0
  output_silent_success; return 1
}

export -f guard_file_extension guard_code_files guard_python_files
export -f guard_typescript_files guard_test_files guard_path_pattern
export -f guard_skip_internal guard_nontrivial_bash guard_multi_instance

# Guard: Only run for specific tool names
# Usage: guard_tool "Write" "Edit" || exit 0
guard_tool() {
  local tool_name
  tool_name=$(get_field '.tool_name // ""')
  [[ -z "$tool_name" ]] && { output_silent_success; return 1; }
  for allowed_tool in "$@"; do
    [[ "$tool_name" == "$allowed_tool" ]] && return 0
  done
  output_silent_success
  return 1
}

export -f guard_tool

# -----------------------------------------------------------------------------
# Atomic JSON File Operations (CC 2.1.x Multi-Instance Safety)
# -----------------------------------------------------------------------------
# These functions provide safe, atomic JSON file writes with flock locking
# for multi-instance coordination safety.
#
# Usage: atomic_json_write "$FILE_PATH" "$JSON_CONTENT"
# Usage: atomic_json_write "$FILE_PATH" "$JSON_CONTENT" 10  # 10 second timeout
# -----------------------------------------------------------------------------

# Atomic JSON write with flock locking for multi-instance safety
# Usage: atomic_json_write <file_path> <json_content> [timeout_seconds]
#
# Features:
# - Uses flock for file locking (with timeout)
# - Writes to temp file first, then atomic mv
# - Validates JSON before writing
# - Creates parent directories if needed
#
# Returns: 0 on success, 1 on failure
atomic_json_write() {
  local file_path="$1"
  local json_content="$2"
  local timeout_seconds="${3:-5}"  # Default 5 second timeout

  # Validate inputs
  if [[ -z "$file_path" ]]; then
    log_hook "ERROR: atomic_json_write: file_path is required"
    return 1
  fi

  if [[ -z "$json_content" ]]; then
    log_hook "ERROR: atomic_json_write: json_content is required"
    return 1
  fi

  # Validate JSON syntax before writing
  if ! echo "$json_content" | jq . >/dev/null 2>&1; then
    log_hook "ERROR: atomic_json_write: Invalid JSON content for $file_path"
    return 1
  fi

  # Ensure parent directory exists
  local dir
  dir=$(dirname "$file_path")
  mkdir -p "$dir" 2>/dev/null || {
    log_hook "ERROR: atomic_json_write: Cannot create directory $dir"
    return 1
  }

  # Create temp file in same directory for atomic mv
  local tmp_file
  tmp_file=$(mktemp "${dir}/.atomic_json_XXXXXX") || {
    log_hook "ERROR: atomic_json_write: Cannot create temp file in $dir"
    return 1
  }

  # Write JSON to temp file
  if ! echo "$json_content" > "$tmp_file"; then
    rm -f "$tmp_file" 2>/dev/null
    log_hook "ERROR: atomic_json_write: Cannot write to temp file"
    return 1
  fi

  # Lock file path (use .lock suffix on the target file)
  local lock_file="${file_path}.lock"

  # Perform atomic write with flock
  local result=0
  if command -v flock >/dev/null 2>&1; then
    # Use flock for atomic locking
    (
      # Acquire exclusive lock with timeout
      if flock -w "$timeout_seconds" 9 2>/dev/null; then
        # Atomic move (same filesystem)
        if mv "$tmp_file" "$file_path" 2>/dev/null; then
          exit 0
        else
          log_hook "ERROR: atomic_json_write: Failed to mv $tmp_file to $file_path"
          rm -f "$tmp_file" 2>/dev/null
          exit 1
        fi
      else
        log_hook "WARN: atomic_json_write: Lock timeout for $file_path after ${timeout_seconds}s"
        rm -f "$tmp_file" 2>/dev/null
        exit 1
      fi
    ) 9>"$lock_file"
    result=$?
  else
    # Fallback: simple lock file approach for systems without flock
    local lock_acquired=0
    local attempts=0
    local max_attempts=$((timeout_seconds * 10))  # Check every 0.1s

    while [[ $attempts -lt $max_attempts ]]; do
      if (set -o noclobber && echo "$$" > "$lock_file") 2>/dev/null; then
        lock_acquired=1
        break
      fi

      # Check if lock is stale (older than 30 seconds)
      if [[ -f "$lock_file" ]]; then
        local lock_age
        if [[ "$(uname)" == "Darwin" ]]; then
          lock_age=$(( $(date +%s) - $(stat -f%m "$lock_file" 2>/dev/null || echo 0) ))
        else
          lock_age=$(( $(date +%s) - $(stat -c%Y "$lock_file" 2>/dev/null || echo 0) ))
        fi

        if [[ $lock_age -gt 30 ]]; then
          rm -f "$lock_file" 2>/dev/null
          continue
        fi
      fi

      sleep 0.1
      ((attempts++)) || true
    done

    if [[ $lock_acquired -eq 1 ]]; then
      if mv "$tmp_file" "$file_path" 2>/dev/null; then
        result=0
      else
        log_hook "ERROR: atomic_json_write: Failed to mv $tmp_file to $file_path"
        rm -f "$tmp_file" 2>/dev/null
        result=1
      fi
      rm -f "$lock_file" 2>/dev/null
    else
      log_hook "WARN: atomic_json_write: Lock timeout for $file_path after ${timeout_seconds}s (no flock)"
      rm -f "$tmp_file" 2>/dev/null
      result=1
    fi
  fi

  return $result
}

# Atomic JSON update using jq transformation
# Usage: atomic_json_update <file_path> <jq_filter> [jq_args...]
#
# Example:
#   atomic_json_update "$FILE" '.count += 1' --arg name "foo"
#
# Note: This reads the file, applies jq transformation, and writes atomically.
# If the file doesn't exist, starts with empty object {}.
#
# Returns: 0 on success, 1 on failure
atomic_json_update() {
  local file_path="$1"
  shift
  local jq_filter="$1"
  shift
  local jq_args=("$@")

  # Validate inputs
  if [[ -z "$file_path" ]]; then
    log_hook "ERROR: atomic_json_update: file_path is required"
    return 1
  fi

  if [[ -z "$jq_filter" ]]; then
    log_hook "ERROR: atomic_json_update: jq_filter is required"
    return 1
  fi

  # Lock file path
  local lock_file="${file_path}.lock"
  local timeout_seconds=5

  # Perform atomic read-modify-write with flock
  if command -v flock >/dev/null 2>&1; then
    (
      if flock -w "$timeout_seconds" 9 2>/dev/null; then
        # Read current content or start with empty object
        local current_json
        if [[ -f "$file_path" ]]; then
          current_json=$(cat "$file_path" 2>/dev/null) || current_json="{}"
        else
          current_json="{}"
        fi

        # Validate current JSON
        if ! echo "$current_json" | jq . >/dev/null 2>&1; then
          log_hook "WARN: atomic_json_update: Invalid JSON in $file_path, starting fresh"
          current_json="{}"
        fi

        # Apply jq transformation
        local new_json
        new_json=$(echo "$current_json" | jq "${jq_args[@]}" "$jq_filter" 2>/dev/null) || {
          log_hook "ERROR: atomic_json_update: jq transformation failed for $file_path"
          exit 1
        }

        # Write to temp file and atomic mv
        local dir
        dir=$(dirname "$file_path")
        mkdir -p "$dir" 2>/dev/null || exit 1

        local tmp_file
        tmp_file=$(mktemp "${dir}/.atomic_json_XXXXXX") || exit 1

        if echo "$new_json" > "$tmp_file" && mv "$tmp_file" "$file_path"; then
          exit 0
        else
          rm -f "$tmp_file" 2>/dev/null
          exit 1
        fi
      else
        log_hook "WARN: atomic_json_update: Lock timeout for $file_path"
        exit 1
      fi
    ) 9>"$lock_file"
    return $?
  else
    # Fallback without flock - less safe but functional
    local current_json
    if [[ -f "$file_path" ]]; then
      current_json=$(cat "$file_path" 2>/dev/null) || current_json="{}"
    else
      current_json="{}"
    fi

    if ! echo "$current_json" | jq . >/dev/null 2>&1; then
      current_json="{}"
    fi

    local new_json
    new_json=$(echo "$current_json" | jq "${jq_args[@]}" "$jq_filter" 2>/dev/null) || {
      log_hook "ERROR: atomic_json_update: jq transformation failed"
      return 1
    }

    atomic_json_write "$file_path" "$new_json" 5
    return $?
  fi
}

# Export atomic JSON functions
export -f atomic_json_write atomic_json_update

# -----------------------------------------------------------------------------
# Timeout and Performance Utilities for SessionStart Hooks
# -----------------------------------------------------------------------------
# These utilities prevent hooks from hanging during startup by adding timeouts
# and tracking execution times.

# Run a command with timeout (prevents hanging)
# Usage: run_with_timeout <timeout_seconds> <command> [args...]
# Returns: 0 on success, 124 on timeout, or command's exit code
# On timeout, logs warning and returns 0 (graceful degradation)
# NOTE: If timeout command is not available, runs command without timeout
run_with_timeout() {
  local timeout_sec="$1"
  shift
  local cmd=("$@")

  # Check if timeout command is available (GNU coreutils or macOS gtimeout)
  if command -v timeout >/dev/null 2>&1; then
    # GNU timeout
    if timeout "$timeout_sec" "${cmd[@]}" 2>/dev/null; then
      return 0
    else
      local exit_code=$?
      if [[ $exit_code -eq 124 ]]; then
        log_hook "WARN: Command timed out after ${timeout_sec}s: ${cmd[0]}"
        return 0  # Graceful degradation - don't block startup
      fi
      return $exit_code
    fi
  elif command -v gtimeout >/dev/null 2>&1; then
    # macOS gtimeout (from GNU coreutils via Homebrew)
    if gtimeout "$timeout_sec" "${cmd[@]}" 2>/dev/null; then
      return 0
    else
      local exit_code=$?
      if [[ $exit_code -eq 124 ]]; then
        log_hook "WARN: Command timed out after ${timeout_sec}s: ${cmd[0]}"
        return 0
      fi
      return $exit_code
    fi
  else
    # Fallback: No timeout available - just run the command
    # This is safer than trying to implement timeout in bash which can hang
    # The assumption is that hooks should not be blocking anyway
    "${cmd[@]}"
    return $?
  fi
}

# Check if slow hooks should be bypassed
# Usage: if should_skip_slow_hooks; then exit 0; fi
should_skip_slow_hooks() {
  [[ "${ORCHESTKIT_SKIP_SLOW_HOOKS:-0}" == "1" ]]
}

# Log hook execution timing
# Usage: 
#   HOOK_START_TIME=$(date +%s.%N)
#   # ... hook code ...
#   log_hook_timing "hook-name"
log_hook_timing() {
  local hook_name="${1:-$(basename "${BASH_SOURCE[1]:-$0}" .sh)}"
  local start_time="${HOOK_START_TIME:-}"
  
  if [[ -z "$start_time" ]]; then
    return 0  # No timing data available
  fi
  
  local end_time
  end_time=$(date +%s.%N 2>/dev/null || date +%s)
  
  # Calculate duration (handle both GNU and BSD date)
  local duration
  if command -v bc >/dev/null 2>&1; then
    duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")
  else
    # Fallback: integer seconds
    local start_int end_int
    start_int=$(echo "$start_time" | cut -d. -f1)
    end_int=$(echo "$end_time" | cut -d. -f1)
    duration=$((end_int - start_int))
  fi
  
  # Log if hook took more than 1 second
  if (( $(echo "$duration > 1.0" | bc 2>/dev/null || echo 0) )); then
    log_hook "SLOW: $hook_name took ${duration}s (threshold: 1s)"
  fi
}

# Start timing a hook
# Usage: start_hook_timing
start_hook_timing() {
  export HOOK_START_TIME
  HOOK_START_TIME=$(date +%s.%N 2>/dev/null || date +%s)
}

# Export timeout and timing utilities
export -f run_with_timeout should_skip_slow_hooks log_hook_timing start_hook_timing

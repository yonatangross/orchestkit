#!/usr/bin/env bash
set -euo pipefail
# Setup Maintenance - Periodic maintenance tasks
# Hook: Setup (triggered by setup-check.sh or --maintenance flag)
# CC 2.1.11 Compliant
#
# Tasks:
# - Log rotation (daily)
# - Stale lock cleanup (daily)
# - Session archive (daily)
# - Memory Fabric cleanup (daily) - CC 2.1.11, added in v4.20.0
# - Metrics aggregation (weekly)
# - Full health validation (weekly)
# - Version migrations (on version change)

# Check for HOOK_INPUT from parent (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Determine plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
MARKER_FILE="${PLUGIN_ROOT}/.setup-complete"
CURRENT_VERSION="4.25.0"

# Mode: --force, --background, --migrate
MODE="${1:-auto}"

log_hook "Maintenance starting (mode: $MODE)"

# Track tasks completed
TASKS_COMPLETED=()
TASKS_FAILED=()

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

# Get marker field
get_marker_field() {
  local field="$1"
  if [[ -f "$MARKER_FILE" ]]; then
    jq -r "$field // empty" "$MARKER_FILE" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Update marker field
update_marker_field() {
  local field="$1"
  local value="$2"

  if [[ -f "$MARKER_FILE" ]]; then
    jq --arg v "$value" "$field = \$v" "$MARKER_FILE" > "${MARKER_FILE}.tmp" && \
      mv "${MARKER_FILE}.tmp" "$MARKER_FILE"
  fi
}

# Calculate hours since timestamp
hours_since() {
  local timestamp="$1"
  local last_epoch now_epoch

  if [[ -z "$timestamp" ]]; then
    echo "999"  # Very large number
    return
  fi

  # Handle both GNU and BSD date
  if date --version >/dev/null 2>&1; then
    last_epoch=$(date -d "$timestamp" +%s 2>/dev/null || echo 0)
  else
    last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%%+*}" +%s 2>/dev/null || echo 0)
  fi

  now_epoch=$(date +%s)
  echo $(( (now_epoch - last_epoch) / 3600 ))
}

# ─────────────────────────────────────────────────────────────────────────────
# Maintenance Tasks
# ─────────────────────────────────────────────────────────────────────────────

# Task: Log rotation (rotate logs > 200KB)
task_log_rotation() {
  log_hook "Task: Log rotation"

  local log_dir="${PLUGIN_ROOT}/.claude/logs"
  local home_log_dir="${HOME}/.claude/logs/skf"
  local rotated=0

  # Rotate plugin logs
  for log_dir_path in "$log_dir" "$home_log_dir"; do
    if [[ -d "$log_dir_path" ]]; then
      while IFS= read -r logfile; do
        local size
        size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
        if [[ "$size" -gt 204800 ]]; then  # 200KB
          local rotated_name="${logfile}.old.$(date +%Y%m%d-%H%M%S)"
          mv "$logfile" "$rotated_name" 2>/dev/null && ((rotated++)) || true

          # Compress if gzip available
          if command -v gzip >/dev/null 2>&1; then
            gzip "$rotated_name" 2>/dev/null || true
          fi
        fi
      done < <(find "$log_dir_path" -name "*.log" -type f 2>/dev/null)

      # Clean up old rotated logs (keep last 5)
      find "$log_dir_path" -name "*.log.old.*" -type f 2>/dev/null | \
        sort -r | tail -n +6 | while IFS= read -r oldfile; do
          rm -f "$oldfile" 2>/dev/null || true
        done
    fi
  done

  if [[ $rotated -gt 0 ]]; then
    TASKS_COMPLETED+=("Rotated $rotated log files")
  fi
}

# Task: Stale lock cleanup (remove locks > 24h old)
task_stale_lock_cleanup() {
  log_hook "Task: Stale lock cleanup"

  local cleaned=0

  # Clean up coordination database locks
  local coord_db="${PLUGIN_ROOT}/.claude/coordination/.claude.db"
  if [[ -f "$coord_db" ]] && command -v sqlite3 >/dev/null 2>&1; then
    # Remove locks older than 24 hours
    sqlite3 "$coord_db" "DELETE FROM file_locks WHERE datetime(acquired_at) < datetime('now', '-24 hours');" 2>/dev/null || true

    # Count remaining locks
    local lock_count
    lock_count=$(sqlite3 "$coord_db" "SELECT COUNT(*) FROM file_locks;" 2>/dev/null || echo 0)
    log_hook "Coordination locks remaining: $lock_count"
    cleaned=1
  fi

  # Clean up any .lock files older than 24 hours
  find "${PLUGIN_ROOT}" -name "*.lock" -type f -mtime +1 2>/dev/null | while IFS= read -r lockfile; do
    rm -f "$lockfile" 2>/dev/null && ((cleaned++)) || true
  done

  if [[ $cleaned -gt 0 ]]; then
    TASKS_COMPLETED+=("Cleaned stale locks")
  fi
}

# Task: Session cleanup (archive sessions > 7 days)
task_session_cleanup() {
  log_hook "Task: Session cleanup"

  local session_dir="${PLUGIN_ROOT}/.claude/context/sessions"
  local archive_dir="${PLUGIN_ROOT}/.claude/context/archive"
  local archived=0

  if [[ -d "$session_dir" ]]; then
    mkdir -p "$archive_dir" 2>/dev/null || true

    # Find session directories older than 7 days
    find "$session_dir" -maxdepth 1 -type d -mtime +7 2>/dev/null | while IFS= read -r session; do
      if [[ "$session" != "$session_dir" ]]; then
        local session_name
        session_name=$(basename "$session")
        mv "$session" "$archive_dir/" 2>/dev/null && ((archived++)) || true
      fi
    done
  fi

  # Clean up temp files older than 7 days
  find /tmp -maxdepth 1 -name "claude-session-*" -type d -mtime +7 2>/dev/null | while IFS= read -r tmpdir; do
    rm -rf "$tmpdir" 2>/dev/null || true
  done

  if [[ $archived -gt 0 ]]; then
    TASKS_COMPLETED+=("Archived $archived old sessions")
  fi
}

# Task: Metrics aggregation (aggregate daily metrics into weekly summary)
task_metrics_aggregation() {
  log_hook "Task: Metrics aggregation"

  local metrics_file="/tmp/claude-session-metrics.json"
  local aggregate_file="${PLUGIN_ROOT}/.claude/logs/metrics-aggregate.json"

  if [[ -f "$metrics_file" ]]; then
    # Read current metrics
    local current_metrics
    current_metrics=$(cat "$metrics_file" 2>/dev/null || echo '{}')

    # Initialize or update aggregate file
    if [[ ! -f "$aggregate_file" ]]; then
      echo '{"weeks":[],"last_aggregated":""}' > "$aggregate_file"
    fi

    # Add current week's data
    local week
    week=$(date +%Y-W%V)
    local now
    now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

    jq --arg w "$week" --arg t "$now" --argjson m "$current_metrics" \
      '.weeks += [{"week":$w,"timestamp":$t,"metrics":$m}] | .last_aggregated = $t | .weeks = (.weeks | .[-10:])' \
      "$aggregate_file" > "${aggregate_file}.tmp" && \
      mv "${aggregate_file}.tmp" "$aggregate_file"

    # Reset daily metrics
    echo '{"tools":{},"sessions":{}}' > "$metrics_file"

    TASKS_COMPLETED+=("Aggregated metrics for $week")
  fi
}

# Task: Memory Fabric cleanup (cleanup old pending syncs and processed archives)
# CC 2.1.11: Memory Fabric v2.0 maintenance
task_memory_fabric_cleanup() {
  log_hook "Task: Memory Fabric cleanup"

  local cleaned=0
  local project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

  # Clean up old pending sync files (older than 7 days)
  # These are session-specific files: .mem0-pending-sync-{session-id}.json
  find "${project_dir}/.claude/logs" -name ".mem0-pending-sync-*.json" -type f -mtime +7 2>/dev/null | while IFS= read -r syncfile; do
    rm -f "$syncfile" 2>/dev/null && ((cleaned++)) || true
  done

  # Clean up old processed archives (keep last 20)
  local processed_dir="${project_dir}/.claude/logs/mem0-processed"
  if [[ -d "$processed_dir" ]]; then
    find "$processed_dir" -name "*.processed-*.json" -type f 2>/dev/null | \
      sort -r | tail -n +21 | while IFS= read -r oldfile; do
        rm -f "$oldfile" 2>/dev/null && ((cleaned++)) || true
      done
  fi

  # Clean up global pending sync if stale (older than 24 hours)
  local global_sync="${HOME}/.claude/.mem0-pending-sync.json"
  if [[ -f "$global_sync" ]]; then
    # Check file age using find
    if find "$global_sync" -mtime +1 2>/dev/null | grep -q .; then
      rm -f "$global_sync" 2>/dev/null && ((cleaned++)) || true
    fi
  fi

  # Validate memory-fabric schema if it exists
  local schema_file="${PLUGIN_ROOT}/.claude/schemas/memory-fabric.schema.json"
  if [[ -f "$schema_file" ]]; then
    if ! jq empty "$schema_file" 2>/dev/null; then
      log_hook "WARN: memory-fabric.schema.json is invalid - may need repair"
    fi
  fi

  if [[ $cleaned -gt 0 ]]; then
    TASKS_COMPLETED+=("Cleaned $cleaned Memory Fabric files")
  fi
}

# Task: Full health validation
task_health_validation() {
  log_hook "Task: Full health validation"

  local issues=0

  # Validate all hooks are executable
  local non_exec
  non_exec=$(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f ! -perm -111 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$non_exec" -gt 0 ]]; then
    log_hook "WARN: $non_exec hooks are not executable"
    chmod +x "${PLUGIN_ROOT}/hooks"/**/*.sh 2>/dev/null || true
    ((issues++))
  fi

  # Validate config.json
  local config_file="${PLUGIN_ROOT}/.claude/defaults/config.json"
  if [[ -f "$config_file" ]]; then
    if ! jq empty "$config_file" 2>/dev/null; then
      log_hook "WARN: config.json is invalid"
      ((issues++))
    fi
  fi

  # Update health check timestamp
  local now
  now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
  update_marker_field '.last_health_check' "$now"

  if [[ $issues -eq 0 ]]; then
    TASKS_COMPLETED+=("Health validation passed")
  else
    TASKS_COMPLETED+=("Health validation found $issues issues (auto-fixed)")
  fi
}

# Task: Version migration
task_version_migration() {
  log_hook "Task: Version migration"

  local marker_version
  marker_version=$(get_marker_field '.version')

  if [[ -z "$marker_version" || "$marker_version" == "$CURRENT_VERSION" ]]; then
    return 0  # No migration needed
  fi

  log_hook "Migrating from $marker_version to $CURRENT_VERSION"

  # Version-specific migrations
  case "$marker_version" in
    4.18.*)
      # Migration from 4.18.x to 4.19.0
      log_hook "Applying 4.18 -> 4.19 migrations"
      # No specific migrations needed, just version bump
      ;;
    4.17.*)
      # Migration from 4.17.x
      log_hook "Applying 4.17 -> 4.19 migrations"
      ;;
    *)
      log_hook "No specific migration path from $marker_version"
      ;;
  esac

  # Update version in marker
  update_marker_field '.version' "$CURRENT_VERSION"
  TASKS_COMPLETED+=("Migrated from $marker_version to $CURRENT_VERSION")
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Execution
# ─────────────────────────────────────────────────────────────────────────────

main() {
  local now
  now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

  # Get last maintenance time
  local last_maintenance
  last_maintenance=$(get_marker_field '.last_maintenance')
  local hours
  hours=$(hours_since "$last_maintenance")

  # Determine which tasks to run
  local run_daily=false
  local run_weekly=false

  case "$MODE" in
    --force)
      run_daily=true
      run_weekly=true
      ;;
    --migrate)
      task_version_migration
      ;;
    --background)
      # Background mode - only run if due
      if [[ "$hours" -ge 24 ]]; then
        run_daily=true
      fi
      if [[ "$hours" -ge 168 ]]; then  # 7 days
        run_weekly=true
      fi
      ;;
    *)
      # Auto mode - check timing
      if [[ "$hours" -ge 24 ]]; then
        run_daily=true
      fi
      if [[ "$hours" -ge 168 ]]; then
        run_weekly=true
      fi
      ;;
  esac

  # Run daily tasks
  if [[ "$run_daily" == "true" ]]; then
    log_hook "Running daily maintenance tasks"
    task_log_rotation
    task_stale_lock_cleanup
    task_session_cleanup
    task_memory_fabric_cleanup  # CC 2.1.11: Memory Fabric v2.0
  fi

  # Run weekly tasks
  if [[ "$run_weekly" == "true" ]]; then
    log_hook "Running weekly maintenance tasks"
    task_metrics_aggregation
    task_health_validation
  fi

  # Update last maintenance timestamp
  update_marker_field '.last_maintenance' "$now"

  # Build summary
  local summary=""
  if [[ ${#TASKS_COMPLETED[@]} -gt 0 ]]; then
    summary="Completed: ${TASKS_COMPLETED[*]}"
    log_hook "Maintenance complete: ${#TASKS_COMPLETED[@]} tasks"
  else
    log_hook "No maintenance tasks needed"
  fi

  # Output based on mode
  if [[ "$MODE" == "--background" ]]; then
    # Background mode - silent
    exit 0
  elif [[ -n "$summary" ]]; then
    jq -nc --arg ctx "Maintenance: $summary" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
  else
    echo '{"continue":true,"suppressOutput":true}'
  fi
}

main "$@"
exit 0

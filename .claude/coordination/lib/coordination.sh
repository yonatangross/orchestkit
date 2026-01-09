#!/bin/bash
# Coordination Library - Core functions for multi-instance coordination
# Provides file-based locking, work registry, and health checks
#
# IMPORTANT: This script must be run with bash, not sh or zsh
# Usage: bash -c 'source coordination.sh && coord_init'

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_LOCK_HELD=10
readonly EXIT_LOCK_EXPIRED=11
readonly EXIT_CONFLICT=12
readonly EXIT_STALE_INSTANCE=13

# Timeouts (seconds)
readonly LOCK_TIMEOUT=300        # 5 minutes
readonly HEARTBEAT_TIMEOUT=300   # 5 minutes
readonly STALE_CHECK_INTERVAL=60 # 1 minute

# Paths (use current directory as fallback if CLAUDE_PROJECT_DIR is unset)
_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
COORD_DIR="${_PROJECT_DIR}/.claude/coordination"
REGISTRY_FILE="${COORD_DIR}/work-registry.json"
DECISIONS_FILE="${COORD_DIR}/decision-log.json"
LOCKS_DIR="${COORD_DIR}/locks"
HEARTBEATS_DIR="${COORD_DIR}/heartbeats"

# Instance identity (set once per session)
INSTANCE_ID=""
INSTANCE_PID=$$

# Cross-platform file locking helper (macOS compatible)
# Uses simple lockfile approach that works on all platforms
_acquire_file_lock() {
  local lockfile="$1"
  local max_wait=30
  local waited=0

  while [[ -f "${lockfile}.held" ]] && [[ ${waited} -lt ${max_wait} ]]; do
    sleep 0.1
    waited=$((waited + 1))
  done

  echo "$$" > "${lockfile}.held" 2>/dev/null || true
}

_release_file_lock() {
  local lockfile="$1"
  rm -f "${lockfile}.held" 2>/dev/null || true
}

# Initialize coordination system
coord_init() {
  mkdir -p "${COORD_DIR}/locks" "${COORD_DIR}/heartbeats" "${COORD_DIR}/schemas"

  # Initialize registry if not exists
  if [[ ! -f "${REGISTRY_FILE}" ]]; then
    cat > "${REGISTRY_FILE}" << 'EOF'
{
  "schema_version": "1.0.0",
  "registry_updated_at": "",
  "instances": []
}
EOF
  fi

  # Initialize decision log if not exists
  if [[ ! -f "${DECISIONS_FILE}" ]]; then
    cat > "${DECISIONS_FILE}" << 'EOF'
{
  "schema_version": "1.0.0",
  "log_created_at": "",
  "decisions": []
}
EOF
  fi

  # Set instance ID if not already set
  if [[ -z "${INSTANCE_ID}" ]]; then
    INSTANCE_ID="claude-$(date -u +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
  fi
}

# Generate unique instance ID
# Format: claude-YYYYMMDD-HHMMSS-random8hex
coord_generate_instance_id() {
  echo "claude-$(date -u +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
}

# Register this instance in the work registry
# Args: $1 = current task description, $2 = agent role (optional)
coord_register_instance() {
  local task_desc="${1:-No task specified}"
  local agent_role="${2:-main}"
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

  coord_init

  local heartbeat_file="${HEARTBEATS_DIR}/${INSTANCE_ID}.json"
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Create heartbeat file
  cat > "${heartbeat_file}" << EOF
{
  "instance_id": "${INSTANCE_ID}",
  "pid": ${INSTANCE_PID},
  "last_ping": "${now}",
  "ping_count": 0,
  "status": "starting"
}
EOF

  # Use jq to add instance to registry (atomic update with file lock)
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg wtree "${CLAUDE_PROJECT_DIR:-$(pwd)}" \
     --argjson pid ${INSTANCE_PID} \
     --arg task "${task_desc}" \
     --arg role "${agent_role}" \
     --arg hbfile "${heartbeat_file}" \
     --arg now "${now}" \
     --arg branch "${branch}" \
     --arg user "${USER}" \
     --arg os "$(uname -s)" \
     '.registry_updated_at = $now |
      .instances += [{
        instance_id: $iid,
        worktree_path: $wtree,
        pid: $pid,
        current_task: {
          description: $task,
          agent_role: $role,
          started_at: $now
        },
        files_locked: [],
        heartbeat: {
          last_ping: $now,
          heartbeat_file: $hbfile
        },
        status: "active",
        metadata: {
          os: $os,
          branch: $branch,
          user: $user
        }
      }]' "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"

  echo "${INSTANCE_ID}"
}

# Unregister this instance (call on shutdown)
coord_unregister_instance() {
  coord_init

  # Remove heartbeat file
  rm -f "${HEARTBEATS_DIR}/${INSTANCE_ID}.json"

  # Remove from registry
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.registry_updated_at = $now |
      .instances = [.instances[] | select(.instance_id != $iid)]' \
     "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"

  # Release all locks held by this instance
  coord_release_all_locks
}

# Update heartbeat (call periodically, e.g., in PreToolUse hook)
coord_heartbeat() {
  coord_init

  local heartbeat_file="${HEARTBEATS_DIR}/${INSTANCE_ID}.json"

  if [[ ! -f "${heartbeat_file}" ]]; then
    return 1
  fi

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Atomically update heartbeat
  jq --arg now "${now}" \
     '.last_ping = $now | .ping_count += 1 | .status = "active"' \
     "${heartbeat_file}" > "${heartbeat_file}.tmp" && \
  mv "${heartbeat_file}.tmp" "${heartbeat_file}"

  # Update registry heartbeat timestamp
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg now "${now}" \
     '.registry_updated_at = $now |
      .instances = [.instances[] |
        if .instance_id == $iid then
          .heartbeat.last_ping = $now | .status = "active"
        else . end
      ]' "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"
}

# Check for stale instances and clean them up
# Returns: number of stale instances cleaned
coord_cleanup_stale_instances() {
  coord_init

  local now_epoch
  now_epoch=$(date +%s)
  local cleaned=0

  # Check all heartbeat files
  for hb_file in "${HEARTBEATS_DIR}"/*.json; do
    [[ ! -f "${hb_file}" ]] && continue

    local last_ping
    last_ping=$(jq -r '.last_ping' "${hb_file}" 2>/dev/null)

    if [[ -z "${last_ping}" ]]; then
      continue
    fi

    # Convert ISO 8601 to epoch (cross-platform)
    local ping_epoch
    if [[ "$(uname -s)" == "Darwin" ]]; then
      ping_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%SZ" "${last_ping}" +%s 2>/dev/null || echo 0)
    else
      ping_epoch=$(date -d "${last_ping}" +%s 2>/dev/null || echo 0)
    fi

    local age=$((now_epoch - ping_epoch))

    # If heartbeat older than timeout, mark as stale
    if [[ ${age} -gt ${HEARTBEAT_TIMEOUT} ]]; then
      local stale_iid
      stale_iid=$(jq -r '.instance_id' "${hb_file}")

      echo "Cleaning up stale instance: ${stale_iid} (last seen ${age}s ago)" >&2

      # Remove heartbeat file
      rm -f "${hb_file}"

      # Remove from registry
      _acquire_file_lock "${REGISTRY_FILE}"

      jq --arg iid "${stale_iid}" \
         --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
         '.registry_updated_at = $now |
          .instances = [.instances[] | select(.instance_id != $iid)]' \
         "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
      mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

      _release_file_lock "${REGISTRY_FILE}"

      # Release all locks held by stale instance
      coord_release_locks_by_instance "${stale_iid}"

      cleaned=$((cleaned + 1))
    fi
  done

  echo ${cleaned}
}

# Try to acquire a write lock on a file
# Args: $1 = file path (relative to repo root), $2 = intent description (optional)
# Returns: 0 if acquired, 10 if already locked, 11 if expired lock cleaned
coord_acquire_lock() {
  local file_path="${1}"
  local intent="${2:-Editing file}"

  coord_init

  # Clean up stale instances first
  coord_cleanup_stale_instances >/dev/null

  # Normalize path (relative to repo root)
  local rel_path
  rel_path=$(realpath --relative-to="${CLAUDE_PROJECT_DIR:-$(pwd)}" "${file_path}" 2>/dev/null || echo "${file_path}")

  # Lock file path (use base64 to avoid path issues)
  local lock_id
  lock_id=$(echo -n "${rel_path}" | base64 | tr -d '=\n' | tr '+/' '-_')
  local lock_file="${LOCKS_DIR}/${lock_id}.json"

  # Check if lock exists
  if [[ -f "${lock_file}" ]]; then
    local lock_expires
    lock_expires=$(jq -r '.expires_at' "${lock_file}" 2>/dev/null)

    local now_epoch
    now_epoch=$(date +%s)

    local expires_epoch
    if [[ "$(uname -s)" == "Darwin" ]]; then
      expires_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%SZ" "${lock_expires}" +%s 2>/dev/null || echo 0)
    else
      expires_epoch=$(date -d "${lock_expires}" +%s 2>/dev/null || echo 0)
    fi

    # If lock expired, remove it
    if [[ ${now_epoch} -gt ${expires_epoch} ]]; then
      local old_iid
      old_iid=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)
      echo "Removing expired lock on ${rel_path} (held by ${old_iid})" >&2
      rm -f "${lock_file}"
      return ${EXIT_LOCK_EXPIRED}
    fi

    # Lock still valid, held by another instance
    local holder
    holder=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)

    if [[ "${holder}" != "${INSTANCE_ID}" ]]; then
      echo "File ${rel_path} is locked by instance ${holder}" >&2
      return ${EXIT_LOCK_HELD}
    fi

    # We already hold the lock, renew it
    coord_renew_lock "${file_path}"
    return ${EXIT_SUCCESS}
  fi

  # Acquire new lock
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local expires
  if [[ "$(uname -s)" == "Darwin" ]]; then
    expires=$(date -u -v+${LOCK_TIMEOUT}S +"%Y-%m-%dT%H:%M:%SZ")
  else
    expires=$(date -u -d "+${LOCK_TIMEOUT} seconds" +"%Y-%m-%dT%H:%M:%SZ")
  fi

  # Get file hash for optimistic locking
  local file_hash
  if [[ -f "${file_path}" ]]; then
    file_hash=$(shasum "${file_path}" 2>/dev/null | awk '{print $1}' || sha1sum "${file_path}" 2>/dev/null | awk '{print $1}')
  else
    file_hash="0000000000000000000000000000000000000000"
  fi

  # Create lock file
  cat > "${lock_file}" << EOF
{
  "schema_version": "1.0.0",
  "file_path": "${rel_path}",
  "lock_type": "write",
  "locked_by": {
    "instance_id": "${INSTANCE_ID}",
    "pid": ${INSTANCE_PID}
  },
  "locked_at": "${now}",
  "expires_at": "${expires}",
  "file_hash": "${file_hash}",
  "intent": "${intent}"
}
EOF

  # Add to registry
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg fpath "${rel_path}" \
     --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.registry_updated_at = $now |
      .instances = [.instances[] |
        if .instance_id == $iid then
          .files_locked += [$fpath] | .files_locked |= unique
        else . end
      ]' "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"

  return ${EXIT_SUCCESS}
}

# Release a lock on a file
# Args: $1 = file path (relative to repo root)
coord_release_lock() {
  local file_path="${1}"

  coord_init

  local rel_path
  rel_path=$(realpath --relative-to="${CLAUDE_PROJECT_DIR:-$(pwd)}" "${file_path}" 2>/dev/null || echo "${file_path}")

  local lock_id
  lock_id=$(echo -n "${rel_path}" | base64 | tr -d '=\n' | tr '+/' '-_')
  local lock_file="${LOCKS_DIR}/${lock_id}.json"

  if [[ ! -f "${lock_file}" ]]; then
    return ${EXIT_SUCCESS}
  fi

  # Verify we hold the lock
  local holder
  holder=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)

  if [[ "${holder}" != "${INSTANCE_ID}" ]]; then
    echo "Cannot release lock: held by ${holder}" >&2
    return ${EXIT_LOCK_HELD}
  fi

  # Remove lock file
  rm -f "${lock_file}"

  # Remove from registry
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg fpath "${rel_path}" \
     --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.registry_updated_at = $now |
      .instances = [.instances[] |
        if .instance_id == $iid then
          .files_locked = [.files_locked[] | select(. != $fpath)]
        else . end
      ]' "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"

  return ${EXIT_SUCCESS}
}

# Renew a lock (extend expiration)
# Args: $1 = file path
coord_renew_lock() {
  local file_path="${1}"

  coord_init

  local rel_path
  rel_path=$(realpath --relative-to="${CLAUDE_PROJECT_DIR:-$(pwd)}" "${file_path}" 2>/dev/null || echo "${file_path}")

  local lock_id
  lock_id=$(echo -n "${rel_path}" | base64 | tr -d '=\n' | tr '+/' '-_')
  local lock_file="${LOCKS_DIR}/${lock_id}.json"

  if [[ ! -f "${lock_file}" ]]; then
    return 1
  fi

  local expires
  if [[ "$(uname -s)" == "Darwin" ]]; then
    expires=$(date -u -v+${LOCK_TIMEOUT}S +"%Y-%m-%dT%H:%M:%SZ")
  else
    expires=$(date -u -d "+${LOCK_TIMEOUT} seconds" +"%Y-%m-%dT%H:%M:%SZ")
  fi

  jq --arg expires "${expires}" \
     '.expires_at = $expires' \
     "${lock_file}" > "${lock_file}.tmp" && \
  mv "${lock_file}.tmp" "${lock_file}"
}

# Release all locks held by this instance
coord_release_all_locks() {
  coord_init

  for lock_file in "${LOCKS_DIR}"/*.json; do
    [[ ! -f "${lock_file}" ]] && continue

    local holder
    holder=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)

    if [[ "${holder}" == "${INSTANCE_ID}" ]]; then
      rm -f "${lock_file}"
    fi
  done

  # Clear from registry
  _acquire_file_lock "${REGISTRY_FILE}"

  jq --arg iid "${INSTANCE_ID}" \
     --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.registry_updated_at = $now |
      .instances = [.instances[] |
        if .instance_id == $iid then
          .files_locked = []
        else . end
      ]' "${REGISTRY_FILE}" > "${REGISTRY_FILE}.tmp" && \
  mv "${REGISTRY_FILE}.tmp" "${REGISTRY_FILE}"

  _release_file_lock "${REGISTRY_FILE}"
}

# Release all locks held by a specific instance (for cleanup)
# Args: $1 = instance_id
coord_release_locks_by_instance() {
  local target_iid="${1}"

  coord_init

  for lock_file in "${LOCKS_DIR}"/*.json; do
    [[ ! -f "${lock_file}" ]] && continue

    local holder
    holder=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)

    if [[ "${holder}" == "${target_iid}" ]]; then
      rm -f "${lock_file}"
    fi
  done
}

# Check if a file is locked by another instance
# Args: $1 = file path
# Returns: 0 if not locked or locked by us, 10 if locked by another
coord_check_lock() {
  local file_path="${1}"

  coord_init

  local rel_path
  rel_path=$(realpath --relative-to="${CLAUDE_PROJECT_DIR:-$(pwd)}" "${file_path}" 2>/dev/null || echo "${file_path}")

  local lock_id
  lock_id=$(echo -n "${rel_path}" | base64 | tr -d '=\n' | tr '+/' '-_')
  local lock_file="${LOCKS_DIR}/${lock_id}.json"

  if [[ ! -f "${lock_file}" ]]; then
    return ${EXIT_SUCCESS}
  fi

  local holder
  holder=$(jq -r '.locked_by.instance_id' "${lock_file}" 2>/dev/null)

  if [[ "${holder}" == "${INSTANCE_ID}" ]]; then
    return ${EXIT_SUCCESS}
  fi

  echo "Locked by: ${holder}" >&2
  return ${EXIT_LOCK_HELD}
}

# Detect file conflicts using optimistic locking
# Args: $1 = file path
# Returns: 0 if no conflict, 12 if conflict detected
coord_detect_conflict() {
  local file_path="${1}"

  coord_init

  if [[ ! -f "${file_path}" ]]; then
    return ${EXIT_SUCCESS}
  fi

  local rel_path
  rel_path=$(realpath --relative-to="${CLAUDE_PROJECT_DIR:-$(pwd)}" "${file_path}" 2>/dev/null || echo "${file_path}")

  local lock_id
  lock_id=$(echo -n "${rel_path}" | base64 | tr -d '=\n' | tr '+/' '-_')
  local lock_file="${LOCKS_DIR}/${lock_id}.json"

  if [[ ! -f "${lock_file}" ]]; then
    return ${EXIT_SUCCESS}
  fi

  # Get original hash from lock
  local lock_hash
  lock_hash=$(jq -r '.file_hash' "${lock_file}" 2>/dev/null)

  # Get current file hash
  local current_hash
  current_hash=$(shasum "${file_path}" 2>/dev/null | awk '{print $1}' || sha1sum "${file_path}" 2>/dev/null | awk '{print $1}')

  if [[ "${lock_hash}" != "${current_hash}" ]]; then
    echo "Conflict detected: file ${rel_path} was modified since lock acquired" >&2
    return ${EXIT_CONFLICT}
  fi

  return ${EXIT_SUCCESS}
}

# Log a decision to the shared decision log
# Args: $1 = category, $2 = title, $3 = description, $4 = scope (optional)
coord_log_decision() {
  local category="${1}"
  local title="${2}"
  local description="${3}"
  local scope="${4:-module}"

  coord_init

  # Generate decision ID
  local dec_id
  dec_id="DEC-$(date -u +%Y%m%d)-$(jq '[.decisions[]] | length' "${DECISIONS_FILE}" 2>/dev/null | xargs printf "%04d")"

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Append to decision log (atomic)
  _acquire_file_lock "${DECISIONS_FILE}"

  jq --arg did "${dec_id}" \
     --arg ts "${now}" \
     --arg iid "${INSTANCE_ID}" \
     --arg cat "${category}" \
     --arg title "${title}" \
     --arg desc "${description}" \
     --arg scope "${scope}" \
     'if .log_created_at == "" then .log_created_at = $ts else . end |
      .decisions += [{
        decision_id: $did,
        timestamp: $ts,
        made_by: {
          instance_id: $iid
        },
        category: $cat,
        title: $title,
        description: $desc,
        impact: {
          scope: $scope
        },
        status: "accepted"
      }]' "${DECISIONS_FILE}" > "${DECISIONS_FILE}.tmp" && \
  mv "${DECISIONS_FILE}.tmp" "${DECISIONS_FILE}"

  _release_file_lock "${DECISIONS_FILE}"

  echo "${dec_id}"
}

# Query recent decisions
# Args: $1 = category filter (optional), $2 = limit (default 10)
coord_query_decisions() {
  local category="${1:-}"
  local limit="${2:-10}"

  coord_init

  if [[ -z "${category}" ]]; then
    jq --argjson limit "${limit}" \
       '[.decisions | reverse | .[:$limit]]' \
       "${DECISIONS_FILE}"
  else
    jq --arg cat "${category}" \
       --argjson limit "${limit}" \
       '[.decisions[] | select(.category == $cat)] | reverse | .[:$limit]' \
       "${DECISIONS_FILE}"
  fi
}

# Get active instances
coord_list_instances() {
  coord_init
  coord_cleanup_stale_instances >/dev/null

  jq '.instances' "${REGISTRY_FILE}"
}

# Get work assigned to a specific instance
# Args: $1 = instance_id (optional, defaults to current instance)
coord_get_work() {
  local iid="${1:-${INSTANCE_ID}}"

  coord_init

  jq --arg iid "${iid}" \
     '.instances[] | select(.instance_id == $iid)' \
     "${REGISTRY_FILE}"
}

# Display coordination status in a nice format
coord_status() {
  coord_init
  coord_cleanup_stale_instances >/dev/null

  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│  WORKTREE COORDINATION STATUS                                   │"
  echo "├─────────────────────────────────────────────────────────────────┤"
  echo ""
  echo "📍 Current Worktree: $(pwd)"
  echo "📍 Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  echo "👥 Active Instances:"
  jq -r '.instances[] | "   • \(.instance_id) [\(.metadata.branch // "unknown")] - \(.current_task.description // "no task")"' "${REGISTRY_FILE}" 2>/dev/null || echo "   (none)"
  echo ""
  echo "🔒 File Locks:"
  local lock_count=0
  for lock_file in "${LOCKS_DIR}"/*.json; do
    [[ ! -f "${lock_file}" ]] && continue
    lock_count=$((lock_count + 1))
    local fpath=$(jq -r '.file_path' "${lock_file}")
    local holder=$(jq -r '.locked_by.instance_id' "${lock_file}")
    echo "   • ${fpath} → ${holder}"
  done
  [[ ${lock_count} -eq 0 ]] && echo "   (no active locks)"
  echo ""
  echo "└─────────────────────────────────────────────────────────────────┘"
}

# Export functions for use in other scripts
export -f coord_init
export -f coord_generate_instance_id
export -f coord_register_instance
export -f coord_unregister_instance
export -f coord_heartbeat
export -f coord_cleanup_stale_instances
export -f coord_acquire_lock
export -f coord_release_lock
export -f coord_renew_lock
export -f coord_release_all_locks
export -f coord_release_locks_by_instance
export -f coord_check_lock
export -f coord_detect_conflict
export -f coord_log_decision
export -f coord_query_decisions
export -f coord_list_instances
export -f coord_get_work
export -f coord_status
export -f _acquire_file_lock
export -f _release_file_lock
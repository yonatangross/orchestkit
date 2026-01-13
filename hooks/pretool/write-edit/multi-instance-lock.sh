#!/bin/bash
# Multi-Instance File Lock Hook
# CC 2.1.6 Compliant: includes continue field in all outputs
# Acquires file locks before Write/Edit operations to prevent conflicts
# Version: 1.0.0

set -euo pipefail

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INSTANCE_DIR="$PROJECT_ROOT/.instance"
DB_PATH="$PROJECT_ROOT/.claude/coordination/.claude.db"

# Read tool input from stdin
INPUT=$(cat)

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [multi-instance-lock] $*" >&2
}

# Check if coordination is enabled
if [[ ! -f "$DB_PATH" ]]; then
    # No coordination database, pass through with continue
    echo "$INPUT" | jq '. + {"continue": true, "suppressOutput": true}'
    exit 0
fi

# Check if we have instance identity
if [[ ! -f "$INSTANCE_DIR/id.json" ]]; then
    log "WARNING: No instance identity found, passing through"
    echo "$INPUT" | jq '. + {"continue": true, "suppressOutput": true}'
    exit 0
fi

# Get tool name and file path from input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // .input.file_path // empty')

# Only process Write and Edit tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    echo "$INPUT" | jq '. + {"continue": true, "suppressOutput": true}'
    exit 0
fi

# Skip if no file path
if [[ -z "$FILE_PATH" ]]; then
    echo "$INPUT" | jq '. + {"continue": true, "suppressOutput": true}'
    exit 0
fi

# Convert to relative path if absolute
if [[ "$FILE_PATH" == "$PROJECT_ROOT"* ]]; then
    FILE_PATH="${FILE_PATH#$PROJECT_ROOT/}"
fi

# Get instance ID
INSTANCE_ID=$(jq -r '.instance_id' "$INSTANCE_DIR/id.json")

# Generate lock ID
LOCK_ID="lock-$(head -c 8 /dev/urandom | xxd -p 2>/dev/null || openssl rand -hex 8)"

# Calculate expiry (60 seconds from now)
if [[ "$(uname)" == "Darwin" ]]; then
    EXPIRES_AT=$(date -u -v+60S +%Y-%m-%dT%H:%M:%SZ)
else
    EXPIRES_AT=$(date -u -d '+60 seconds' +%Y-%m-%dT%H:%M:%SZ)
fi

# Check for existing lock
check_existing_lock() {
    local file_path="$1"

    sqlite3 "$DB_PATH" << EOF
SELECT instance_id, expires_at, reason
FROM file_locks
WHERE file_path = '$file_path'
AND expires_at > datetime('now')
AND instance_id != '$INSTANCE_ID'
LIMIT 1;
EOF
}

# Acquire lock
acquire_lock() {
    local file_path="$1"
    local reason="${2:-Writing file}"

    sqlite3 "$DB_PATH" << EOF
INSERT OR REPLACE INTO file_locks (
    lock_id,
    file_path,
    lock_type,
    instance_id,
    acquired_at,
    expires_at,
    extensions,
    reason
) VALUES (
    '$LOCK_ID',
    '$file_path',
    'exclusive_write',
    '$INSTANCE_ID',
    datetime('now'),
    '$EXPIRES_AT',
    0,
    '$reason'
);

-- Log to audit
INSERT INTO audit_log (instance_id, action_type, target_type, target_id, details)
VALUES (
    '$INSTANCE_ID',
    'lock_acquire',
    'file',
    '$file_path',
    '{"lock_id": "$LOCK_ID", "expires_at": "$EXPIRES_AT"}'
);
EOF
}

# Check for locks on parent directories (directory locks)
check_directory_lock() {
    local file_path="$1"
    local dir_path
    dir_path=$(dirname "$file_path")

    sqlite3 "$DB_PATH" << EOF
SELECT instance_id, file_path as locked_dir
FROM file_locks
WHERE lock_type = 'directory'
AND '$file_path' LIKE file_path || '%'
AND expires_at > datetime('now')
AND instance_id != '$INSTANCE_ID'
LIMIT 1;
EOF
}

# Request lock from holder
request_lock_release() {
    local file_path="$1"
    local holder_instance="$2"
    local message_id="msg-$(head -c 8 /dev/urandom | xxd -p 2>/dev/null || openssl rand -hex 8)"

    sqlite3 "$DB_PATH" << EOF
INSERT INTO messages (
    message_id,
    from_instance,
    to_instance,
    message_type,
    payload,
    priority,
    expires_at
) VALUES (
    '$message_id',
    '$INSTANCE_ID',
    '$holder_instance',
    'lock_request',
    '{"file_path": "$file_path", "requester": "$INSTANCE_ID", "urgency": "normal"}',
    1,
    datetime('now', '+5 minutes')
);
EOF

    log "Lock request sent to $holder_instance for $file_path"
}

# Main lock logic
main() {
    # Check for directory lock first
    local dir_lock_info
    dir_lock_info=$(check_directory_lock "$FILE_PATH")

    if [[ -n "$dir_lock_info" ]]; then
        local holder_instance
        holder_instance=$(echo "$dir_lock_info" | cut -d'|' -f1)
        local locked_dir
        locked_dir=$(echo "$dir_lock_info" | cut -d'|' -f2)

        log "BLOCKED: Directory $locked_dir is locked by $holder_instance"

        # Send lock request
        request_lock_release "$locked_dir" "$holder_instance"

        # Output blocking response with continue: false
        cat << EOF
{
  "continue": false,
  "blocked": true,
  "reason": "Directory lock conflict",
  "file": "$FILE_PATH",
  "locked_directory": "$locked_dir",
  "holder_instance": "$holder_instance",
  "suggestion": "The directory is locked by another instance. A lock request has been sent. Wait for lock release or coordinate with the other instance.",
  "retry_after_seconds": 10
}
EOF
        exit 1
    fi

    # Check for file lock
    local lock_info
    lock_info=$(check_existing_lock "$FILE_PATH")

    if [[ -n "$lock_info" ]]; then
        local holder_instance
        holder_instance=$(echo "$lock_info" | cut -d'|' -f1)
        local expires_at
        expires_at=$(echo "$lock_info" | cut -d'|' -f2)
        local reason
        reason=$(echo "$lock_info" | cut -d'|' -f3)

        log "BLOCKED: File $FILE_PATH is locked by $holder_instance until $expires_at"

        # Send lock request
        request_lock_release "$FILE_PATH" "$holder_instance"

        # Output blocking response with continue: false
        cat << EOF
{
  "continue": false,
  "blocked": true,
  "reason": "File lock conflict",
  "file": "$FILE_PATH",
  "holder_instance": "$holder_instance",
  "holder_reason": "$reason",
  "expires_at": "$expires_at",
  "suggestion": "The file is locked by another instance. A lock request has been sent. Wait for lock release or coordinate with the other instance.",
  "retry_after_seconds": 10
}
EOF
        exit 1
    fi

    # No conflicts, acquire lock
    acquire_lock "$FILE_PATH" "Modifying via $TOOL_NAME"
    log "Lock acquired: $FILE_PATH (expires: $EXPIRES_AT)"

    # Add lock info and continue: true to the output
    echo "$INPUT" | jq --arg lock_id "$LOCK_ID" --arg expires "$EXPIRES_AT" \
        '. + {"continue": true, "suppressOutput": true, "_coordination": {"lock_id": $lock_id, "expires_at": $expires}}'
}

main
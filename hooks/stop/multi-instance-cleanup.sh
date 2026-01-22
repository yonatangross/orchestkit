#!/bin/bash
# Multi-Instance Cleanup Hook
# Runs on session stop to release locks and update instance status
# CC 2.1.7 Compliant: JSON output on all exit paths
# Version: 1.1.0

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTANCE_DIR="$PROJECT_ROOT/.instance"
DB_PATH="$PROJECT_ROOT/.claude/coordination/.claude.db"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [multi-instance-cleanup] $*" >&2
}

# Check if coordination is enabled (self-guard)
if [[ ! -f "$DB_PATH" ]]; then
    log "No coordination database, skipping cleanup"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Check if we have instance identity
if [[ ! -f "$INSTANCE_DIR/id.json" ]]; then
    log "No instance identity, skipping cleanup"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Get instance ID
INSTANCE_ID=$(jq -r '.instance_id' "$INSTANCE_DIR/id.json")
log "Cleaning up instance: $INSTANCE_ID"

# Stop heartbeat process
stop_heartbeat() {
    if [[ -f "$INSTANCE_DIR/heartbeat.pid" ]]; then
        local pid
        pid=$(cat "$INSTANCE_DIR/heartbeat.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            log "Stopped heartbeat process (PID: $pid)"
        fi
        rm -f "$INSTANCE_DIR/heartbeat.pid"
    fi
}

# Release all locks held by this instance
release_locks() {
    log "Releasing all locks..."

    # Schema: file_locks (file_path TEXT PRIMARY KEY, instance_id TEXT NOT NULL, acquired_at TEXT NOT NULL)
    # Delete locks owned by this instance (correct column is instance_id, not locked_by)
    sqlite3 "$DB_PATH" << EOF
-- Release all locks held by this instance
DELETE FROM file_locks
WHERE instance_id = '$INSTANCE_ID';
EOF

    log "All locks released"
}

# Abandon work claims (if work_claims table exists)
handle_work_claims() {
    log "Handling work claims..."

    # Check if work_claims table exists before attempting updates
    local has_claims_table
    has_claims_table=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='work_claims';" 2>/dev/null || echo "0")

    if [[ "$has_claims_table" == "1" ]]; then
        sqlite3 "$DB_PATH" << EOF
-- Mark active claims as abandoned
UPDATE work_claims
SET status = 'abandoned',
    completed_at = datetime('now')
WHERE instance_id = '$INSTANCE_ID'
  AND status = 'active';
EOF
        log "Work claims handled"
    else
        log "No work_claims table, skipping"
    fi
}

# Share any new knowledge discovered this session
share_session_knowledge() {
    if [[ -f "$INSTANCE_DIR/session_discoveries.json" ]]; then
        log "Sharing session discoveries to knowledge base..."

        # This could be expanded to process and insert discoveries
        # For now, just log that we would do this
        local discovery_count
        discovery_count=$(jq '. | length' "$INSTANCE_DIR/session_discoveries.json" 2>/dev/null || echo "0")

        if [[ "$discovery_count" -gt 0 ]]; then
            log "Would share $discovery_count discoveries (not implemented yet)"
        fi
    fi
}

# Update instance status (if instances table exists)
update_instance_status() {
    # Check if instances table exists (schema has 'instances' with 'id' not 'instance_id')
    local has_instances_table
    has_instances_table=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='instances';" 2>/dev/null || echo "0")

    if [[ "$has_instances_table" == "1" ]]; then
        sqlite3 "$DB_PATH" << EOF
UPDATE instances
SET status = 'terminated',
    last_heartbeat = datetime('now')
WHERE id = '$INSTANCE_ID';
EOF
        log "Instance status updated to terminated"
    else
        log "No instances table, skipping status update"
    fi
}

# Broadcast shutdown message (if messages table exists)
broadcast_shutdown() {
    # Check if messages table exists
    local has_messages_table
    has_messages_table=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='messages';" 2>/dev/null || echo "0")

    if [[ "$has_messages_table" == "1" ]]; then
        local message_id="msg-$(head -c 8 /dev/urandom | xxd -p 2>/dev/null || openssl rand -hex 8)"
        sqlite3 "$DB_PATH" << EOF
INSERT INTO messages (
    message_id,
    from_instance,
    to_instance,
    message_type,
    payload,
    expires_at
) VALUES (
    '$message_id',
    '$INSTANCE_ID',
    NULL,
    'shutdown',
    '{"instance_id": "$INSTANCE_ID", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}',
    datetime('now', '+1 hour')
);
EOF
        log "Shutdown broadcast sent"
    else
        log "No messages table, skipping broadcast"
    fi
}

# Cleanup instance-specific files (optional)
cleanup_instance_files() {
    # Keep id.json for history but remove transient files
    rm -f "$INSTANCE_DIR/knowledge_cache.json"
    rm -f "$INSTANCE_DIR/claims.json"
    rm -f "$INSTANCE_DIR/session_discoveries.json"

    log "Instance files cleaned up"
}

# Summary of cleanup
print_summary() {
    log "=== Cleanup Summary ==="
    log "Instance: $INSTANCE_ID"
    log "Status: terminated"
    log "======================"
}

# Main cleanup
main() {
    log "Starting multi-instance cleanup..."

    # Stop heartbeat first
    stop_heartbeat

    # Release all locks
    release_locks

    # Handle work claims
    handle_work_claims

    # Share knowledge
    share_session_knowledge

    # Broadcast shutdown
    broadcast_shutdown

    # Update status
    update_instance_status

    # Cleanup files
    cleanup_instance_files

    # Print summary
    print_summary

    log "Multi-instance cleanup completed"
}

# Output CC 2.1.7 compliant JSON first
echo '{"continue":true,"suppressOutput":true}'
main "$@"
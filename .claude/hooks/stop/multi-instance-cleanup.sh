#!/bin/bash
# Multi-Instance Cleanup Hook
# Runs on session stop to release locks and update instance status
# Version: 1.0.0

set -euo pipefail

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTANCE_DIR="$PROJECT_ROOT/.instance"
DB_PATH="$PROJECT_ROOT/.claude/coordination/.claude.db"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [multi-instance-cleanup] $*" >&2
}

# Check if coordination is enabled
if [[ ! -f "$DB_PATH" ]]; then
    log "No coordination database, skipping cleanup"
    exit 0
fi

# Check if we have instance identity
if [[ ! -f "$INSTANCE_DIR/id.json" ]]; then
    log "No instance identity, skipping cleanup"
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
            log "Stopping heartbeat process (PID: $pid)"
            kill "$pid" 2>/dev/null || true
        fi
        rm -f "$INSTANCE_DIR/heartbeat.pid"
    fi
}

# Release all locks held by this instance
release_locks() {
    local lock_count
    lock_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file_locks WHERE instance_id = '$INSTANCE_ID'")

    if [[ "$lock_count" -gt 0 ]]; then
        log "Releasing $lock_count file locks..."

        sqlite3 "$DB_PATH" << EOF
-- Log each lock release
INSERT INTO audit_log (instance_id, action_type, target_type, target_id, details)
SELECT '$INSTANCE_ID', 'lock_release', 'file', file_path, json_object('lock_id', lock_id, 'reason', 'session_end')
FROM file_locks
WHERE instance_id = '$INSTANCE_ID';

-- Delete file locks
DELETE FROM file_locks WHERE instance_id = '$INSTANCE_ID';

-- Delete region locks
DELETE FROM region_locks WHERE instance_id = '$INSTANCE_ID';
EOF
    fi
}

# Handle incomplete work claims
handle_work_claims() {
    local claim_count
    claim_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM work_claims WHERE instance_id = '$INSTANCE_ID' AND status IN ('claimed', 'in_progress')")

    if [[ "$claim_count" -gt 0 ]]; then
        log "Found $claim_count incomplete work claims"

        # Check if we should abandon or just pause
        # For now, mark as abandoned (could be made configurable)
        sqlite3 "$DB_PATH" << EOF
UPDATE work_claims
SET status = 'abandoned',
    updated_at = datetime('now')
WHERE instance_id = '$INSTANCE_ID'
AND status IN ('claimed', 'in_progress');

-- Log abandonment
INSERT INTO audit_log (instance_id, action_type, target_type, target_id, details)
SELECT '$INSTANCE_ID', 'work_abandon', 'claim', claim_id, json_object('task', task_description, 'reason', 'session_end')
FROM work_claims
WHERE instance_id = '$INSTANCE_ID'
AND status = 'abandoned';
EOF

        log "Work claims marked as abandoned"
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

# Update instance status
update_instance_status() {
    sqlite3 "$DB_PATH" << EOF
UPDATE instances
SET status = 'terminated',
    last_heartbeat = datetime('now')
WHERE instance_id = '$INSTANCE_ID';

-- Log termination
INSERT INTO audit_log (instance_id, action_type, target_type, target_id, details)
VALUES (
    '$INSTANCE_ID',
    'instance_stop',
    'instance',
    '$INSTANCE_ID',
    '{"reason": "session_end", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}'
);
EOF

    log "Instance status updated to terminated"
}

# Broadcast shutdown message
broadcast_shutdown() {
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
    NULL,  -- Broadcast to all
    'shutdown',
    '{"instance_id": "$INSTANCE_ID", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}',
    datetime('now', '+1 hour')
);
EOF

    log "Shutdown broadcast sent"
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
    log "Locks released: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_log WHERE instance_id = '$INSTANCE_ID' AND action_type = 'lock_release' AND timestamp > datetime('now', '-1 minute')")"
    log "Work claims abandoned: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM work_claims WHERE instance_id = '$INSTANCE_ID' AND status = 'abandoned'")"
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

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
main "$@"

#!/bin/bash
# Multi-Instance Coordination Initialization Hook
# Runs on session start to register this Claude Code instance
# CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
# Version: 1.1.0

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# =============================================================================
# SELF-GUARD: Only run when multi-instance mode is enabled
# =============================================================================
if [[ "${CLAUDE_MULTI_INSTANCE:-0}" != "1" ]]; then
    # Multi-instance not enabled - silent exit (CC 2.1.7)
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Check for sqlite3 (required for coordination)
if ! command -v sqlite3 >/dev/null 2>&1; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# =============================================================================
# MAIN HOOK LOGIC
# =============================================================================

# Get the project root (where .claude lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common library if available
if [[ -f "$SCRIPT_DIR/../_lib/common.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/common.sh"
fi

# Configuration paths
COORDINATION_DIR="$PROJECT_ROOT/.claude/coordination"
INSTANCE_DIR="$PROJECT_ROOT/.instance"
DB_PATH="$COORDINATION_DIR/.claude.db"
CONFIG_PATH="$COORDINATION_DIR/config.json"
SCHEMA_PATH="$COORDINATION_DIR/schema.sql"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [multi-instance-init] $*" >&2
}

# Generate unique instance ID
generate_instance_id() {
    local worktree_name
    worktree_name=$(basename "$PROJECT_ROOT")
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local random
    random=$(head -c 4 /dev/urandom | xxd -p 2>/dev/null || openssl rand -hex 4)
    echo "${worktree_name}-${timestamp}-${random}"
}

# Detect capabilities based on directory structure and recent activity
detect_capabilities() {
    local caps=()

    # Check for backend files
    if [[ -d "$PROJECT_ROOT/backend" ]] || [[ -d "$PROJECT_ROOT/src/backend" ]]; then
        caps+=("backend")
    fi

    # Check for frontend files
    if [[ -d "$PROJECT_ROOT/frontend" ]] || [[ -d "$PROJECT_ROOT/src/frontend" ]] || \
       [[ -f "$PROJECT_ROOT/package.json" ]]; then
        caps+=("frontend")
    fi

    # Check for test files
    if [[ -d "$PROJECT_ROOT/tests" ]] || [[ -d "$PROJECT_ROOT/__tests__" ]]; then
        caps+=("testing")
    fi

    # Check for infrastructure files
    if [[ -d "$PROJECT_ROOT/infrastructure" ]] || [[ -f "$PROJECT_ROOT/docker-compose.yml" ]] || \
       [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
        caps+=("devops")
    fi

    # Output as JSON array
    printf '%s\n' "${caps[@]}" | jq -R . | jq -s .
}

# Initialize coordination database if needed
init_database() {
    if [[ ! -f "$DB_PATH" ]]; then
        log "Initializing coordination database..."
        mkdir -p "$(dirname "$DB_PATH")"

        if [[ -f "$SCHEMA_PATH" ]]; then
            sqlite3 "$DB_PATH" < "$SCHEMA_PATH"
            log "Database initialized from schema"
        else
            log "WARNING: Schema file not found at $SCHEMA_PATH"
            return 1
        fi
    fi
}

# Cleanup stale instances (no heartbeat in 30+ seconds)
cleanup_stale_instances() {
    log "Cleaning up stale instances..."

    sqlite3 "$DB_PATH" << 'EOF'
-- Mark stale instances as terminated
UPDATE instances
SET status = 'terminated'
WHERE status = 'active'
AND last_heartbeat < datetime('now', '-30 seconds');

-- Release locks held by terminated instances
DELETE FROM file_locks
WHERE instance_id IN (
    SELECT instance_id FROM instances WHERE status = 'terminated'
);

-- Release region locks
DELETE FROM region_locks
WHERE instance_id IN (
    SELECT instance_id FROM instances WHERE status = 'terminated'
);

-- Abandon work claims from terminated instances
UPDATE work_claims
SET status = 'abandoned',
    instance_id = NULL
WHERE status IN ('claimed', 'in_progress')
AND instance_id IN (
    SELECT instance_id FROM instances WHERE status = 'terminated'
);

-- Cleanup expired messages
DELETE FROM messages
WHERE expires_at < datetime('now');

-- Cleanup old read messages
DELETE FROM messages
WHERE created_at < datetime('now', '-24 hours')
AND acknowledged_at IS NOT NULL;
EOF

    log "Stale instance cleanup complete"
}

# Create instance identity file
create_instance_identity() {
    local instance_id="$1"
    local branch
    branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
    local capabilities
    capabilities=$(detect_capabilities)

    mkdir -p "$INSTANCE_DIR"

    cat > "$INSTANCE_DIR/id.json" << EOF
{
  "instance_id": "$instance_id",
  "worktree_name": "$(basename "$PROJECT_ROOT")",
  "worktree_path": "$PROJECT_ROOT",
  "branch": "$branch",
  "capabilities": $capabilities,
  "agent_type": null,
  "model": "claude-opus-4-5-20251101",
  "priority": 1,
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "active",
  "heartbeat_interval_ms": 5000,
  "last_heartbeat": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    log "Instance identity created: $instance_id"
}

# Register instance in coordination database
register_instance() {
    local instance_id="$1"
    local id_json
    id_json=$(cat "$INSTANCE_DIR/id.json")

    local worktree_name branch capabilities priority

    worktree_name=$(echo "$id_json" | jq -r '.worktree_name')
    branch=$(echo "$id_json" | jq -r '.branch')
    capabilities=$(echo "$id_json" | jq -c '.capabilities')
    priority=$(echo "$id_json" | jq -r '.priority')

    sqlite3 "$DB_PATH" << EOF
INSERT OR REPLACE INTO instances (
    instance_id,
    worktree_name,
    branch,
    capabilities,
    priority,
    status,
    created_at,
    last_heartbeat
) VALUES (
    '$instance_id',
    '$worktree_name',
    '$branch',
    '$capabilities',
    $priority,
    'active',
    datetime('now'),
    datetime('now')
);
EOF

    # Log to audit
    sqlite3 "$DB_PATH" << EOF
INSERT INTO audit_log (instance_id, action_type, target_type, target_id, details)
VALUES (
    '$instance_id',
    'instance_start',
    'instance',
    '$instance_id',
    '{"worktree": "$worktree_name", "branch": "$branch"}'
);
EOF

    log "Instance registered in database: $instance_id"
}

# Start heartbeat process in background
start_heartbeat() {
    local instance_id="$1"
    local heartbeat_interval=5

    # Kill any existing heartbeat for this instance
    if [[ -f "$INSTANCE_DIR/heartbeat.pid" ]]; then
        local old_pid
        old_pid=$(cat "$INSTANCE_DIR/heartbeat.pid")
        if kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid" 2>/dev/null || true
        fi
    fi

    # Start new heartbeat
    (
        trap "exit 0" SIGTERM SIGINT

        while true; do
            sqlite3 "$DB_PATH" "UPDATE instances SET last_heartbeat = datetime('now') WHERE instance_id = '$instance_id'" 2>/dev/null || true
            sleep $heartbeat_interval
        done
    ) &

    echo $! > "$INSTANCE_DIR/heartbeat.pid"
    log "Heartbeat started (PID: $!)"
}

# Load relevant shared knowledge for this instance
load_shared_knowledge() {
    local instance_id="$1"
    local capabilities
    capabilities=$(jq -r '.capabilities | join(",")' "$INSTANCE_DIR/id.json")

    # Query relevant knowledge
    local knowledge
    knowledge=$(sqlite3 -json "$DB_PATH" << EOF
SELECT knowledge_id, knowledge_type, domain, title, content, confidence
FROM shared_knowledge
WHERE (expires_at IS NULL OR expires_at > datetime('now'))
AND confidence >= 0.5
ORDER BY confidence DESC, created_at DESC
LIMIT 20;
EOF
)

    # Save to instance-local knowledge cache
    echo "$knowledge" > "$INSTANCE_DIR/knowledge_cache.json"

    local count
    count=$(echo "$knowledge" | jq '. | length' 2>/dev/null || echo "0")
    log "Loaded $count shared knowledge items"
}

# Check for pending messages
check_pending_messages() {
    local instance_id="$1"

    local pending_count
    pending_count=$(sqlite3 "$DB_PATH" << EOF
SELECT COUNT(*) FROM messages
WHERE to_instance = '$instance_id'
AND read_at IS NULL
AND (expires_at IS NULL OR expires_at > datetime('now'));
EOF
)

    if [[ "$pending_count" -gt 0 ]]; then
        log "INFO: $pending_count pending messages for this instance"
    fi
}

# Main initialization
main() {
    log "Starting multi-instance coordination initialization..."

    # Ensure directories exist
    mkdir -p "$COORDINATION_DIR/locks"
    mkdir -p "$INSTANCE_DIR"

    # Initialize database
    init_database || {
        log "ERROR: Failed to initialize database"
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    }

    # Cleanup stale instances
    cleanup_stale_instances

    # Check if we already have an instance running
    if [[ -f "$INSTANCE_DIR/id.json" ]] && [[ -f "$INSTANCE_DIR/heartbeat.pid" ]]; then
        local existing_pid
        existing_pid=$(cat "$INSTANCE_DIR/heartbeat.pid")
        if kill -0 "$existing_pid" 2>/dev/null; then
            local existing_id
            existing_id=$(jq -r '.instance_id' "$INSTANCE_DIR/id.json")
            log "Reusing existing instance: $existing_id"

            # Update heartbeat
            sqlite3 "$DB_PATH" "UPDATE instances SET last_heartbeat = datetime('now'), status = 'active' WHERE instance_id = '$existing_id'"

            echo '{"continue":true,"suppressOutput":true}'
            exit 0
        fi
    fi

    # Generate new instance ID
    local instance_id
    instance_id=$(generate_instance_id)

    # Create identity and register
    create_instance_identity "$instance_id"
    register_instance "$instance_id"

    # Start heartbeat
    start_heartbeat "$instance_id"

    # Load shared knowledge
    load_shared_knowledge "$instance_id"

    # Check for pending messages
    check_pending_messages "$instance_id"

    log "Multi-instance coordination initialized successfully"
}

# Run main and output CC 2.1.7 compliant JSON
main "$@"
echo '{"continue":true,"suppressOutput":true}'
exit 0
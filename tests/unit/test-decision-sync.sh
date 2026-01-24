#!/usr/bin/env bash
# ============================================================================
# Decision Sync Unit Tests (#47)
# ============================================================================
# Tests for bi-directional sync between decision-log.json and mem0
# - Sync state initialization
# - Pending decisions detection
# - Hash generation for deduplication
# - Mark-synced functionality
# - Command output validation
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

DECISION_SYNC="$PROJECT_ROOT/.claude/scripts/decision-sync.sh"

# ============================================================================
# SETUP
# ============================================================================

setup_decision_test_env() {
    # Create test directory structure
    mkdir -p "$TEMP_DIR/.claude/coordination"
    # Clear any existing sync state
    rm -f "$TEMP_DIR/.claude/coordination/.decision-sync-state.json"
    rm -f "$TEMP_DIR/.claude/coordination/decision-log.json"
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
}

create_test_decisions() {
    local count="${1:-3}"
    local decisions="[]"

    for i in $(seq 1 "$count"); do
        local decision=$(cat << EOF
{
    "decision_id": "DEC-TEST-000$i",
    "timestamp": "2026-01-14T10:0$i:00Z",
    "title": "Test Decision $i",
    "description": "Description for test decision $i",
    "status": "accepted",
    "category": "architecture",
    "impact": { "scope": "local" },
    "made_by": { "instance_id": "test-instance-$i" }
}
EOF
)
        decisions=$(echo "$decisions" | jq --argjson dec "$decision" '. + [$dec]')
    done

    echo "{\"version\": \"1.0\", \"decisions\": $decisions}" > "$TEMP_DIR/.claude/coordination/decision-log.json"
}

# ============================================================================
# INITIALIZATION TESTS
# ============================================================================

describe "Decision Sync: Initialization"

test_sync_state_initialization() {
    setup_decision_test_env

    # Run status command which initializes sync state
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status >/dev/null 2>&1

    assert_file_exists "$TEMP_DIR/.claude/coordination/.decision-sync-state.json"
}

test_sync_state_structure() {
    setup_decision_test_env

    # Run status to initialize
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status >/dev/null 2>&1

    local state
    state=$(cat "$TEMP_DIR/.claude/coordination/.decision-sync-state.json")

    assert_valid_json "$state"
    assert_json_field "$state" ".version" "1.0"
}

test_empty_decision_log_handling() {
    setup_decision_test_env

    # Don't create decision log
    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pending 2>&1)

    assert_contains "$output" "No pending"
}

# ============================================================================
# PENDING DECISIONS TESTS
# ============================================================================

describe "Decision Sync: Pending Detection"

test_detect_all_pending_when_none_synced() {
    setup_decision_test_env
    create_test_decisions 3

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pending 2>&1)

    assert_contains "$output" "Pending Decisions (3)"
}

test_pending_shows_decision_ids() {
    setup_decision_test_env
    create_test_decisions 2

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pending 2>&1)

    assert_contains "$output" "DEC-TEST-0001"
    assert_contains "$output" "DEC-TEST-0002"
}

test_pending_excludes_synced() {
    setup_decision_test_env
    create_test_decisions 3

    # Mark one as synced
    cat > "$TEMP_DIR/.claude/coordination/.decision-sync-state.json" << 'EOF'
{
    "version": "1.0",
    "last_sync": "2026-01-14T10:00:00Z",
    "synced_decisions": ["DEC-TEST-0001"],
    "pending_count": 2
}
EOF

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pending 2>&1)

    assert_contains "$output" "Pending Decisions (2)"
    assert_not_contains "$output" "DEC-TEST-0001"
}

# ============================================================================
# SYNC COMMAND TESTS
# ============================================================================

describe "Decision Sync: Sync Command"

test_sync_outputs_user_id() {
    setup_decision_test_env
    create_test_decisions 1

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" sync 2>&1)

    assert_contains "$output" "user_id:"
}

test_sync_outputs_text_content() {
    setup_decision_test_env
    create_test_decisions 1

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" sync 2>&1)

    assert_contains "$output" "text:"
}

test_sync_outputs_metadata_with_hash() {
    setup_decision_test_env
    create_test_decisions 1

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" sync 2>&1)

    assert_contains "$output" "metadata:"
    assert_contains "$output" "hash"
}

test_sync_empty_when_none_pending() {
    setup_decision_test_env

    # Create decisions but mark all as synced
    create_test_decisions 2
    cat > "$TEMP_DIR/.claude/coordination/.decision-sync-state.json" << 'EOF'
{
    "version": "1.0",
    "last_sync": "2026-01-14T10:00:00Z",
    "synced_decisions": ["DEC-TEST-0001", "DEC-TEST-0002"],
    "pending_count": 0
}
EOF

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" sync 2>&1)

    assert_contains "$output" "No pending"
}

# ============================================================================
# MARK-SYNCED TESTS
# ============================================================================

describe "Decision Sync: Mark Synced"

test_mark_synced_adds_to_list() {
    setup_decision_test_env
    create_test_decisions 2

    # Initialize sync state
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status >/dev/null 2>&1

    # Mark one as synced
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" mark-synced "DEC-TEST-0001" >/dev/null 2>&1

    local state
    state=$(cat "$TEMP_DIR/.claude/coordination/.decision-sync-state.json")

    local synced_ids
    synced_ids=$(echo "$state" | jq -r '.synced_decisions | @csv')

    assert_contains "$synced_ids" "DEC-TEST-0001"
}

test_mark_synced_updates_last_sync() {
    setup_decision_test_env
    create_test_decisions 1

    # Initialize
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status >/dev/null 2>&1

    # Mark synced
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" mark-synced "DEC-TEST-0001" >/dev/null 2>&1

    local state
    state=$(cat "$TEMP_DIR/.claude/coordination/.decision-sync-state.json")

    local last_sync
    last_sync=$(echo "$state" | jq -r '.last_sync')

    [[ "$last_sync" != "null" ]] || fail "last_sync should be set"
}

test_mark_synced_without_id_fails() {
    setup_decision_test_env

    local exit_code=0
    CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" mark-synced 2>&1 || exit_code=$?

    [[ $exit_code -ne 0 ]] || fail "Should fail without decision_id"
}

# ============================================================================
# PULL COMMAND TESTS
# ============================================================================

describe "Decision Sync: Pull Command"

test_pull_shows_instructions() {
    setup_decision_test_env

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pull 2>&1)

    # Updated: now uses MCP tools instead of Python scripts
    assert_contains "$output" "mcp__mem0__search_memory"
}

test_pull_shows_user_id() {
    setup_decision_test_env

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pull 2>&1)

    assert_contains "$output" "user_id:"
}

test_pull_shows_example_queries() {
    setup_decision_test_env

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" pull 2>&1)

    assert_contains "$output" "architecture"
}

# ============================================================================
# STATUS COMMAND TESTS
# ============================================================================

describe "Decision Sync: Status Command"

test_status_shows_counts() {
    setup_decision_test_env
    create_test_decisions 3

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status 2>&1)

    assert_contains "$output" "Local decisions: 3"
    assert_contains "$output" "Pending sync:"
}

test_status_shows_project_id() {
    setup_decision_test_env

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status 2>&1)

    assert_contains "$output" "Project:"
    assert_contains "$output" "User ID:"
}

test_status_shows_file_paths() {
    setup_decision_test_env

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" status 2>&1)

    assert_contains "$output" "decision-log.json"
    assert_contains "$output" ".decision-sync-state.json"
}

# ============================================================================
# EXPORT COMMAND TESTS
# ============================================================================

describe "Decision Sync: Export Command"

test_export_outputs_format_instructions() {
    setup_decision_test_env
    create_test_decisions 1

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" export 2>&1)

    # Updated: now uses MCP tools instead of Python scripts
    assert_contains "$output" "mcp__mem0__add_memory"
}

test_export_includes_decision_content() {
    setup_decision_test_env
    create_test_decisions 1

    local output
    output=$(CLAUDE_PROJECT_DIR="$TEMP_DIR" "$DECISION_SYNC" export 2>&1)

    assert_contains "$output" "DEC-TEST-0001"
    assert_contains "$output" "Test Decision 1"
}

# ============================================================================
# HELP COMMAND TESTS
# ============================================================================

describe "Decision Sync: Help"

test_help_shows_all_commands() {
    local output
    output=$("$DECISION_SYNC" help 2>&1)

    assert_contains "$output" "status"
    assert_contains "$output" "pending"
    assert_contains "$output" "export"
    assert_contains "$output" "sync"
    assert_contains "$output" "pull"
    assert_contains "$output" "mark-synced"
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

run_tests
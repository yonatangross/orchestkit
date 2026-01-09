#!/bin/bash
# Unit tests for coordination.sh library
# Tests file locking, instance registry, and worktree coordination

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Test temp directory
TEST_TEMP_DIR="/tmp/coordination-test-$$"

log_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "  ${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo "----------------------------------------"
}

# Setup test environment
setup() {
    rm -rf "$TEST_TEMP_DIR"
    mkdir -p "$TEST_TEMP_DIR/.claude/coordination"
    export CLAUDE_PROJECT_DIR="$TEST_TEMP_DIR"
    export INSTANCE_ID=""
    export INSTANCE_PID=$$

    # Source coordination library
    source "${PROJECT_ROOT}/.claude/coordination/lib/coordination.sh" 2>/dev/null
}

# Teardown test environment
teardown() {
    rm -rf "$TEST_TEMP_DIR"
    export INSTANCE_ID=""
}

# Test: coord_init creates required directories
test_coord_init() {
    log_section "Test: coord_init"

    setup

    coord_init

    if [[ -d "${TEST_TEMP_DIR}/.claude/coordination/locks" ]]; then
        log_pass "Creates locks directory"
    else
        log_fail "Missing locks directory"
    fi

    if [[ -d "${TEST_TEMP_DIR}/.claude/coordination/heartbeats" ]]; then
        log_pass "Creates heartbeats directory"
    else
        log_fail "Missing heartbeats directory"
    fi

    if [[ -f "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" ]]; then
        log_pass "Creates work-registry.json"
    else
        log_fail "Missing work-registry.json"
    fi

    if [[ -f "${TEST_TEMP_DIR}/.claude/coordination/decision-log.json" ]]; then
        log_pass "Creates decision-log.json"
    else
        log_fail "Missing decision-log.json"
    fi

    # Verify registry JSON is valid
    if jq . "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" >/dev/null 2>&1; then
        log_pass "work-registry.json is valid JSON"
    else
        log_fail "work-registry.json is invalid JSON"
    fi

    teardown
}

# Test: coord_generate_instance_id format
test_coord_generate_instance_id() {
    log_section "Test: coord_generate_instance_id"

    setup

    local id1=""
    local id2=""
    id1=$(coord_generate_instance_id)
    sleep 0.1
    id2=$(coord_generate_instance_id)

    # Check format: claude-YYYYMMDD-HHMMSS-random8hex
    if [[ "$id1" =~ ^claude-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$ ]]; then
        log_pass "Instance ID format is correct"
    else
        log_fail "Instance ID format incorrect: $id1"
    fi

    # IDs should be unique (random component)
    if [[ "$id1" != "$id2" ]]; then
        log_pass "Instance IDs are unique"
    else
        log_fail "Instance IDs are not unique"
    fi

    teardown
}

# Test: coord_register_instance
test_coord_register_instance() {
    log_section "Test: coord_register_instance"

    setup

    # Register sets INSTANCE_ID as side effect
    coord_register_instance "Test task" "test-agent" >/dev/null

    if [[ -n "$INSTANCE_ID" ]]; then
        log_pass "Sets INSTANCE_ID: $INSTANCE_ID"
    else
        log_fail "INSTANCE_ID not set"
        teardown
        return
    fi

    # Check heartbeat file exists
    if [[ -f "${TEST_TEMP_DIR}/.claude/coordination/heartbeats/${INSTANCE_ID}.json" ]]; then
        log_pass "Creates heartbeat file"
    else
        log_fail "Missing heartbeat file"
    fi

    # Check registry entry
    local registered=""
    registered=$(jq -r --arg iid "$INSTANCE_ID" '.instances[] | select(.instance_id == $iid) | .instance_id' \
        "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" 2>/dev/null)

    if [[ "$registered" == "$INSTANCE_ID" ]]; then
        log_pass "Instance registered in work-registry"
    else
        log_fail "Instance not found in work-registry"
    fi

    # Check task description
    local task=""
    task=$(jq -r --arg iid "$INSTANCE_ID" '.instances[] | select(.instance_id == $iid) | .current_task.description' \
        "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" 2>/dev/null)

    if [[ "$task" == "Test task" ]]; then
        log_pass "Task description recorded correctly"
    else
        log_fail "Task description incorrect: $task"
    fi

    teardown
}

# Test: coord_acquire_lock and coord_release_lock
test_coord_locks() {
    log_section "Test: File Locking"

    setup

    # Initialize and register
    coord_register_instance "Lock test" "test" >/dev/null

    # Create a test file
    local test_file="${TEST_TEMP_DIR}/test-file.txt"
    echo "test content" > "$test_file"

    # Acquire lock
    if coord_acquire_lock "$test_file" "Testing lock"; then
        log_pass "Lock acquired successfully"
    else
        log_fail "Failed to acquire lock"
        teardown
        return
    fi

    # Verify lock file exists
    local lock_count=0
    lock_count=$(find "${TEST_TEMP_DIR}/.claude/coordination/locks" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$lock_count" -gt 0 ]]; then
        log_pass "Lock file created"
    else
        log_fail "No lock file found"
    fi

    # Check lock
    if coord_check_lock "$test_file" 2>/dev/null; then
        log_pass "coord_check_lock returns success for owned lock"
    else
        log_fail "coord_check_lock fails for owned lock"
    fi

    # Release lock
    if coord_release_lock "$test_file"; then
        log_pass "Lock released successfully"
    else
        log_fail "Failed to release lock"
    fi

    # Verify lock file removed
    lock_count=$(find "${TEST_TEMP_DIR}/.claude/coordination/locks" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$lock_count" -eq 0 ]]; then
        log_pass "Lock file removed after release"
    else
        log_fail "Lock file still exists after release"
    fi

    teardown
}

# Test: coord_heartbeat
test_coord_heartbeat() {
    log_section "Test: Heartbeat"

    setup

    coord_register_instance "Heartbeat test" "test" >/dev/null

    # Get initial ping count
    local initial_count=""
    initial_count=$(jq -r '.ping_count' "${TEST_TEMP_DIR}/.claude/coordination/heartbeats/${INSTANCE_ID}.json" 2>/dev/null)

    # Send heartbeat
    coord_heartbeat

    # Get new ping count
    local new_count=""
    new_count=$(jq -r '.ping_count' "${TEST_TEMP_DIR}/.claude/coordination/heartbeats/${INSTANCE_ID}.json" 2>/dev/null)

    if [[ "$new_count" -gt "$initial_count" ]]; then
        log_pass "Heartbeat increments ping count ($initial_count -> $new_count)"
    else
        log_fail "Heartbeat did not increment ping count: $initial_count -> $new_count"
    fi

    # Check status is active
    local status=""
    status=$(jq -r '.status' "${TEST_TEMP_DIR}/.claude/coordination/heartbeats/${INSTANCE_ID}.json" 2>/dev/null)

    if [[ "$status" == "active" ]]; then
        log_pass "Heartbeat sets status to active"
    else
        log_fail "Heartbeat status not active: $status"
    fi

    teardown
}

# Test: coord_log_decision
test_coord_log_decision() {
    log_section "Test: Decision Logging"

    setup

    coord_register_instance "Decision test" "test" >/dev/null

    local decision_id=""
    decision_id=$(coord_log_decision "architecture" "Test decision" "This is a test" "module")

    if [[ "$decision_id" =~ ^DEC-[0-9]{8}-[0-9]{4}$ ]]; then
        log_pass "Decision ID format correct: $decision_id"
    else
        log_fail "Decision ID format incorrect: $decision_id"
    fi

    # Check decision in log
    local logged_title=""
    logged_title=$(jq -r --arg did "$decision_id" '.decisions[] | select(.decision_id == $did) | .title' \
        "${TEST_TEMP_DIR}/.claude/coordination/decision-log.json" 2>/dev/null)

    if [[ "$logged_title" == "Test decision" ]]; then
        log_pass "Decision logged correctly"
    else
        log_fail "Decision not found in log"
    fi

    teardown
}

# Test: coord_unregister_instance
test_coord_unregister() {
    log_section "Test: Instance Unregistration"

    setup

    coord_register_instance "Unregister test" "test" >/dev/null
    local saved_instance_id="$INSTANCE_ID"

    # Verify registered
    local before_count=""
    before_count=$(jq '.instances | length' "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" 2>/dev/null)

    # Unregister
    coord_unregister_instance

    # Verify unregistered
    local after_count=""
    after_count=$(jq '.instances | length' "${TEST_TEMP_DIR}/.claude/coordination/work-registry.json" 2>/dev/null)

    if [[ "$after_count" -lt "$before_count" ]]; then
        log_pass "Instance removed from registry"
    else
        log_fail "Instance not removed from registry (before: $before_count, after: $after_count)"
    fi

    # Heartbeat file should be removed
    if [[ ! -f "${TEST_TEMP_DIR}/.claude/coordination/heartbeats/${saved_instance_id}.json" ]]; then
        log_pass "Heartbeat file removed"
    else
        log_fail "Heartbeat file still exists"
    fi

    teardown
}

# Test: coord_list_instances
test_coord_list_instances() {
    log_section "Test: List Instances"

    setup

    coord_register_instance "List test" "test" >/dev/null

    local instances=""
    instances=$(coord_list_instances)

    if echo "$instances" | jq . >/dev/null 2>&1; then
        log_pass "coord_list_instances returns valid JSON"
    else
        log_fail "coord_list_instances returns invalid JSON"
    fi

    local count=""
    count=$(echo "$instances" | jq 'length' 2>/dev/null)

    if [[ "$count" -ge 1 ]]; then
        log_pass "Instance appears in list (count: $count)"
    else
        log_fail "Instance not in list"
    fi

    teardown
}

# Test: coord_status output
test_coord_status() {
    log_section "Test: coord_status"

    setup

    coord_register_instance "Status test" "test" >/dev/null

    local output=""
    output=$(coord_status 2>&1)

    if echo "$output" | grep -q "WORKTREE COORDINATION STATUS"; then
        log_pass "Status output contains header"
    else
        log_fail "Status output missing header"
    fi

    if echo "$output" | grep -q "Active Instances"; then
        log_pass "Status output contains instances section"
    else
        log_fail "Status output missing instances section"
    fi

    if echo "$output" | grep -q "File Locks"; then
        log_pass "Status output contains locks section"
    else
        log_fail "Status output missing locks section"
    fi

    teardown
}

# Test: Lock conflict between instances
test_lock_conflict() {
    log_section "Test: Lock Conflict Detection"

    setup

    # Register first instance
    coord_register_instance "Instance 1" "main" >/dev/null
    local instance1="$INSTANCE_ID"

    # Create and lock a test file
    local test_file="${TEST_TEMP_DIR}/shared-file.txt"
    echo "shared content" > "$test_file"
    coord_acquire_lock "$test_file" "Instance 1 lock"

    # Simulate second instance by changing INSTANCE_ID
    INSTANCE_ID="test-instance-2-$$"
    INSTANCE_PID=$$

    # Try to acquire same lock - should fail
    if ! coord_check_lock "$test_file" 2>/dev/null; then
        log_pass "Lock conflict detected for second instance"
    else
        log_fail "Lock conflict not detected"
    fi

    # Restore first instance and release lock
    INSTANCE_ID="$instance1"
    coord_release_lock "$test_file"

    teardown
}

# Test: Multiple file locks
test_multiple_locks() {
    log_section "Test: Multiple File Locks"

    setup

    coord_register_instance "Multi-lock test" "test" >/dev/null

    local file1="${TEST_TEMP_DIR}/file1.txt"
    local file2="${TEST_TEMP_DIR}/file2.txt"
    echo "content1" > "$file1"
    echo "content2" > "$file2"

    # Acquire both locks
    coord_acquire_lock "$file1" "Lock 1"
    coord_acquire_lock "$file2" "Lock 2"

    local lock_count=0
    lock_count=$(find "${TEST_TEMP_DIR}/.claude/coordination/locks" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$lock_count" -eq 2 ]]; then
        log_pass "Multiple locks created"
    else
        log_fail "Expected 2 locks, got: $lock_count"
    fi

    # Release all
    coord_release_all_locks

    lock_count=$(find "${TEST_TEMP_DIR}/.claude/coordination/locks" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$lock_count" -eq 0 ]]; then
        log_pass "All locks released"
    else
        log_fail "Locks not fully released: $lock_count remaining"
    fi

    teardown
}

# Main
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Coordination Library Unit Tests                      ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    test_coord_init
    test_coord_generate_instance_id
    test_coord_register_instance
    test_coord_locks
    test_coord_heartbeat
    test_coord_log_decision
    test_coord_unregister
    test_coord_list_instances
    test_coord_status
    test_lock_conflict
    test_multiple_locks

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some tests failed"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All tests passed"
        exit 0
    fi
}

main "$@"
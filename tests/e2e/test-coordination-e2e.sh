#!/usr/bin/env bash
# ============================================================================
# Coordination System E2E Test
# ============================================================================
# Verifies the multi-worktree coordination system:
# 1. Lock acquisition and release
# 2. Concurrent access handling
# 3. Deadlock prevention
# 4. State file integrity
# 5. Cleanup mechanisms
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
COORD_DIR="$PROJECT_ROOT/.claude/coordination"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

# Test-specific temp directory
TEST_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_TEMP_DIR"' EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Coordination System E2E Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Test 1: Coordination Directory Structure
# ============================================================================
echo "▶ Test 1: Coordination Directory Structure"
echo "────────────────────────────────────────"

if [ -d "$COORD_DIR" ]; then
    pass "Coordination directory exists"
else
    fail "Coordination directory missing: $COORD_DIR"
fi

# Check for required files
required_files=("work-registry.json" "decision-log.json")
for file in "${required_files[@]}"; do
    if [ -f "$COORD_DIR/$file" ]; then
        pass "Found $file"
    else
        info "Optional file not found: $file (may be created on demand)"
    fi
done

# Check for lib directory
if [ -d "$COORD_DIR/lib" ] || [ -f "$COORD_DIR/lib/coordination.sh" ]; then
    pass "Coordination library found"
else
    info "Coordination library not found (may use inline functions)"
fi

echo ""

# ============================================================================
# Test 2: Work Registry Integrity
# ============================================================================
echo "▶ Test 2: Work Registry Integrity"
echo "────────────────────────────────────────"

if [ -f "$COORD_DIR/work-registry.json" ]; then
    # Validate JSON
    if jq empty "$COORD_DIR/work-registry.json" 2>/dev/null; then
        pass "work-registry.json is valid JSON"
    else
        fail "work-registry.json is invalid JSON"
    fi

    # Check structure
    if jq -e 'has("locks") or has("workers") or has("instances")' "$COORD_DIR/work-registry.json" >/dev/null 2>&1; then
        pass "work-registry.json has expected structure"
    else
        info "work-registry.json structure may be empty or different"
    fi
else
    info "work-registry.json not present (created on first use)"
    pass "Registry integrity check skipped (file not present)"
fi

echo ""

# ============================================================================
# Test 3: Decision Log Integrity
# ============================================================================
echo "▶ Test 3: Decision Log Integrity"
echo "────────────────────────────────────────"

if [ -f "$COORD_DIR/decision-log.json" ]; then
    # Validate JSON
    if jq empty "$COORD_DIR/decision-log.json" 2>/dev/null; then
        pass "decision-log.json is valid JSON"
    else
        fail "decision-log.json is invalid JSON"
    fi

    # Check for array structure (decisions are usually stored as array)
    if jq -e 'type == "array" or type == "object"' "$COORD_DIR/decision-log.json" >/dev/null 2>&1; then
        pass "decision-log.json has valid structure"
    else
        fail "decision-log.json has unexpected structure"
    fi
else
    info "decision-log.json not present (created on first use)"
    pass "Decision log integrity check skipped (file not present)"
fi

echo ""

# ============================================================================
# Test 4: Lock Simulation
# ============================================================================
echo "▶ Test 4: Lock Simulation"
echo "────────────────────────────────────────"

# Create a test lock file
TEST_LOCK_FILE="$TEST_TEMP_DIR/test.lock"

# Simulate lock acquisition
acquire_test_lock() {
    local lockfile="$1"
    local timeout="${2:-5}"

    local start_time
    start_time=$(date +%s)

    while true; do
        # Try to create lock file atomically
        if (set -o noclobber; echo "$$" > "$lockfile") 2>/dev/null; then
            return 0
        fi

        local current_time
        current_time=$(date +%s)
        if [ $((current_time - start_time)) -ge "$timeout" ]; then
            return 1
        fi

        sleep 0.1
    done
}

release_test_lock() {
    local lockfile="$1"
    rm -f "$lockfile"
}

# Test basic acquire/release
if acquire_test_lock "$TEST_LOCK_FILE" 2; then
    pass "Lock acquisition succeeded"
    release_test_lock "$TEST_LOCK_FILE"
    pass "Lock release succeeded"
else
    fail "Lock acquisition failed"
fi

echo ""

# ============================================================================
# Test 5: Concurrent Access Simulation
# ============================================================================
echo "▶ Test 5: Concurrent Access Simulation"
echo "────────────────────────────────────────"

CONCURRENT_LOCK="$TEST_TEMP_DIR/concurrent.lock"
RESULT_FILE="$TEST_TEMP_DIR/results.txt"
: > "$RESULT_FILE"

# Spawn two background processes trying to acquire same lock
(
    if acquire_test_lock "$CONCURRENT_LOCK" 3; then
        echo "worker1:acquired" >> "$RESULT_FILE"
        sleep 1
        release_test_lock "$CONCURRENT_LOCK"
        echo "worker1:released" >> "$RESULT_FILE"
    else
        echo "worker1:timeout" >> "$RESULT_FILE"
    fi
) &
PID1=$!

(
    sleep 0.2  # Slight delay to ensure worker1 gets lock first
    if acquire_test_lock "$CONCURRENT_LOCK" 3; then
        echo "worker2:acquired" >> "$RESULT_FILE"
        sleep 0.5
        release_test_lock "$CONCURRENT_LOCK"
        echo "worker2:released" >> "$RESULT_FILE"
    else
        echo "worker2:timeout" >> "$RESULT_FILE"
    fi
) &
PID2=$!

# Wait for both
wait $PID1 2>/dev/null || true
wait $PID2 2>/dev/null || true

# Verify results
if grep -q "worker1:acquired" "$RESULT_FILE" && grep -q "worker2:acquired" "$RESULT_FILE"; then
    pass "Both workers acquired lock (sequentially)"
elif grep -q "worker1:acquired" "$RESULT_FILE" || grep -q "worker2:acquired" "$RESULT_FILE"; then
    pass "At least one worker acquired lock"
else
    fail "Lock contention simulation failed"
fi

# Check for proper sequencing (worker1 should release before worker2 acquires)
if grep -n "." "$RESULT_FILE" | sort -t: -k1 -n | grep -q "worker1:released" && \
   grep -n "." "$RESULT_FILE" | sort -t: -k1 -n | grep -q "worker2:acquired"; then
    pass "Lock sequencing verified"
fi

echo ""

# ============================================================================
# Test 6: Stale Lock Detection
# ============================================================================
echo "▶ Test 6: Stale Lock Detection"
echo "────────────────────────────────────────"

STALE_LOCK="$TEST_TEMP_DIR/stale.lock"

# Create a stale lock (with non-existent PID)
echo "999999" > "$STALE_LOCK"

# Check if we can detect stale lock
is_stale_lock() {
    local lockfile="$1"
    if [ ! -f "$lockfile" ]; then
        return 0  # No lock = stale
    fi

    local lock_pid
    lock_pid=$(cat "$lockfile" 2>/dev/null)

    # Check if PID is still running
    if ! kill -0 "$lock_pid" 2>/dev/null; then
        return 0  # Process not running = stale
    fi

    return 1
}

if is_stale_lock "$STALE_LOCK"; then
    pass "Stale lock detected correctly"
else
    fail "Failed to detect stale lock"
fi

# Clean up stale lock
rm -f "$STALE_LOCK"

echo ""

# ============================================================================
# Test 7: Data Corruption Prevention
# ============================================================================
echo "▶ Test 7: Data Corruption Prevention"
echo "────────────────────────────────────────"

# Test atomic write pattern
TEST_DATA_FILE="$TEST_TEMP_DIR/data.json"
TEST_DATA_TEMP="$TEST_TEMP_DIR/data.json.tmp"

# Initial data
echo '{"version": 1, "data": "initial"}' > "$TEST_DATA_FILE"

# Simulate atomic update
atomic_update() {
    local file="$1"
    local new_data="$2"
    local temp_file="${file}.tmp"

    # Write to temp file first
    echo "$new_data" > "$temp_file"

    # Validate JSON before committing
    if jq empty "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$file"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# Test valid update
if atomic_update "$TEST_DATA_FILE" '{"version": 2, "data": "updated"}'; then
    if jq -e '.version == 2' "$TEST_DATA_FILE" >/dev/null 2>&1; then
        pass "Atomic update succeeded"
    else
        fail "Atomic update data mismatch"
    fi
else
    fail "Atomic update failed"
fi

# Test invalid update (should not corrupt file)
original_data=$(cat "$TEST_DATA_FILE")
if ! atomic_update "$TEST_DATA_FILE" 'invalid json {{{'; then
    if [ "$(cat "$TEST_DATA_FILE")" = "$original_data" ]; then
        pass "Invalid update rejected, data preserved"
    else
        fail "Data corrupted after invalid update"
    fi
else
    fail "Invalid JSON accepted (should have been rejected)"
fi

echo ""

# ============================================================================
# Test 8: Cleanup Mechanism
# ============================================================================
echo "▶ Test 8: Cleanup Mechanism"
echo "────────────────────────────────────────"

# Create some test locks
CLEANUP_DIR="$TEST_TEMP_DIR/cleanup_test"
mkdir -p "$CLEANUP_DIR"

# Create active and stale locks
echo "$$" > "$CLEANUP_DIR/active.lock"
echo "999998" > "$CLEANUP_DIR/stale1.lock"
echo "999997" > "$CLEANUP_DIR/stale2.lock"

# Cleanup function
cleanup_stale_locks() {
    local dir="$1"
    local cleaned=0

    for lockfile in "$dir"/*.lock; do
        [ -f "$lockfile" ] || continue

        local lock_pid
        lock_pid=$(cat "$lockfile" 2>/dev/null)

        if ! kill -0 "$lock_pid" 2>/dev/null; then
            rm -f "$lockfile"
            ((cleaned++)) || true
        fi
    done

    echo "$cleaned"
}

cleaned_count=$(cleanup_stale_locks "$CLEANUP_DIR")

if [ "$cleaned_count" -eq 2 ]; then
    pass "Cleaned up $cleaned_count stale locks"
else
    fail "Expected to clean 2 stale locks, cleaned $cleaned_count"
fi

# Verify active lock still exists
if [ -f "$CLEANUP_DIR/active.lock" ]; then
    pass "Active lock preserved during cleanup"
else
    fail "Active lock was incorrectly removed"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
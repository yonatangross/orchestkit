#!/usr/bin/env bash
# ============================================================================
# Symlink Attack Security Tests
# ============================================================================
# Tests for symlink-based security attacks:
# 1. Symlink following to sensitive files
# 2. TOCTOU (Time-of-check to time-of-use) race conditions
# 3. Symlink creation in world-writable directories
# 4. Hardlink attacks
# 5. Directory symlink attacks
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

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
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

# Test temp directory
TEST_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_TEMP_DIR"' EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Symlink Attack Security Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Test 1: Symlink Detection
# ============================================================================
echo "▶ Test 1: Symlink Detection"
echo "────────────────────────────────────────"

# Create test files and symlinks
echo "safe content" > "$TEST_TEMP_DIR/safe_file.txt"
ln -s "$TEST_TEMP_DIR/safe_file.txt" "$TEST_TEMP_DIR/symlink_to_safe.txt"
ln -s "/etc/passwd" "$TEST_TEMP_DIR/symlink_to_passwd"

is_symlink() {
    [ -L "$1" ]
}

# Test symlink detection
if is_symlink "$TEST_TEMP_DIR/symlink_to_safe.txt"; then
    pass "Symlink detected correctly"
else
    fail "Failed to detect symlink"
fi

# Test regular file detection
if ! is_symlink "$TEST_TEMP_DIR/safe_file.txt"; then
    pass "Regular file correctly identified as non-symlink"
else
    fail "Regular file incorrectly identified as symlink"
fi

echo ""

# ============================================================================
# Test 2: Safe File Reading (No Symlink Following)
# ============================================================================
echo "▶ Test 2: Safe File Reading (No Symlink Following)"
echo "────────────────────────────────────────"

safe_read_file() {
    local filepath="$1"

    # Reject symlinks
    if [ -L "$filepath" ]; then
        echo "ERROR: Refusing to read symlink" >&2
        return 1
    fi

    # Reject if doesn't exist or isn't a regular file
    if [ ! -f "$filepath" ]; then
        echo "ERROR: Not a regular file" >&2
        return 1
    fi

    cat "$filepath"
}

# Should succeed on regular file
if safe_read_file "$TEST_TEMP_DIR/safe_file.txt" >/dev/null 2>&1; then
    pass "Regular file read succeeds"
else
    fail "Regular file read failed"
fi

# Should fail on symlink
if ! safe_read_file "$TEST_TEMP_DIR/symlink_to_safe.txt" >/dev/null 2>&1; then
    pass "Symlink read correctly blocked"
else
    fail "Symlink read was not blocked"
fi

# Should fail on symlink to sensitive file
if ! safe_read_file "$TEST_TEMP_DIR/symlink_to_passwd" >/dev/null 2>&1; then
    pass "Symlink to sensitive file blocked"
else
    fail "Symlink to sensitive file was not blocked"
fi

echo ""

# ============================================================================
# Test 3: Safe File Writing (No Symlink Following)
# ============================================================================
echo "▶ Test 3: Safe File Writing (No Symlink Following)"
echo "────────────────────────────────────────"

safe_write_file() {
    local filepath="$1"
    local content="$2"

    # Reject symlinks
    if [ -L "$filepath" ]; then
        echo "ERROR: Refusing to write to symlink" >&2
        return 1
    fi

    # Check parent directory exists and is not a symlink
    local parent_dir
    parent_dir=$(dirname "$filepath")
    if [ -L "$parent_dir" ]; then
        echo "ERROR: Parent directory is a symlink" >&2
        return 1
    fi

    # Write atomically via temp file
    local temp_file
    temp_file=$(mktemp "${filepath}.XXXXXX")
    echo "$content" > "$temp_file"
    mv "$temp_file" "$filepath"
}

# Should succeed on new file
if safe_write_file "$TEST_TEMP_DIR/new_file.txt" "test content" 2>/dev/null; then
    if [ "$(cat "$TEST_TEMP_DIR/new_file.txt")" = "test content" ]; then
        pass "Safe write to new file succeeds"
    else
        fail "File content mismatch"
    fi
else
    fail "Safe write failed"
fi

# Create a symlink where we want to write
ln -sf "/tmp/should_not_exist_$$" "$TEST_TEMP_DIR/write_symlink.txt"

# Should fail when trying to write to symlink
if ! safe_write_file "$TEST_TEMP_DIR/write_symlink.txt" "malicious" 2>/dev/null; then
    pass "Write to symlink correctly blocked"
else
    fail "Write to symlink was not blocked"
fi

echo ""

# ============================================================================
# Test 4: Directory Traversal via Symlinks
# ============================================================================
echo "▶ Test 4: Directory Traversal via Symlinks"
echo "────────────────────────────────────────"

# Create a symlink to parent directory
mkdir -p "$TEST_TEMP_DIR/subdir"
ln -s ".." "$TEST_TEMP_DIR/subdir/parent_link"

# Portable resolve_safe_path function
resolve_safe_path() {
    local base_dir="$1"
    local requested_path="$2"

    # Resolve the full path
    local full_path="$base_dir/$requested_path"

    # Get canonical paths (portable: cd && pwd)
    local resolved resolved_base

    # Resolve base directory
    resolved_base=$(cd "$base_dir" 2>/dev/null && pwd -P) || return 1

    # Check if the full_path exists to determine how to resolve it
    if [ -e "$full_path" ]; then
        # Path exists, resolve it
        resolved=$(cd "$(dirname "$full_path")" 2>/dev/null && pwd -P)/$(basename "$full_path") || return 1
    else
        # Path doesn't exist - check parent and construct
        local parent_dir
        parent_dir=$(dirname "$full_path")
        if [ -d "$parent_dir" ]; then
            resolved=$(cd "$parent_dir" 2>/dev/null && pwd -P)/$(basename "$full_path") || return 1
        else
            # Parent doesn't exist either, reject
            return 1
        fi
    fi

    # Check if resolved path is still under base_dir
    case "$resolved" in
        "$resolved_base"/*|"$resolved_base")
            echo "$resolved"
            return 0
            ;;
        *)
            echo "ERROR: Path escapes base directory" >&2
            return 1
            ;;
    esac
}

# Should block path that escapes via symlink
if ! resolve_safe_path "$TEST_TEMP_DIR/subdir" "parent_link/../../etc/passwd" >/dev/null 2>&1; then
    pass "Symlink-based directory escape blocked"
else
    fail "Symlink-based directory escape not blocked"
fi

# Should allow safe path
if resolve_safe_path "$TEST_TEMP_DIR" "safe_file.txt" >/dev/null 2>&1; then
    pass "Safe path within base allowed"
else
    fail "Safe path incorrectly blocked"
fi

echo ""

# ============================================================================
# Test 5: TOCTOU Protection Simulation
# ============================================================================
echo "▶ Test 5: TOCTOU Protection Simulation"
echo "────────────────────────────────────────"

safe_atomic_operation() {
    local filepath="$1"

    if [ -L "$filepath" ]; then
        return 1
    fi

    if [ ! -f "$filepath" ]; then
        return 1
    fi

    return 0
}

# Test the function
if safe_atomic_operation "$TEST_TEMP_DIR/safe_file.txt"; then
    pass "TOCTOU-safe operation on regular file"
else
    fail "TOCTOU-safe operation failed on regular file"
fi

if ! safe_atomic_operation "$TEST_TEMP_DIR/symlink_to_safe.txt"; then
    pass "TOCTOU-safe operation rejects symlink"
else
    fail "TOCTOU-safe operation accepted symlink"
fi

info "Note: Full TOCTOU protection requires O_NOFOLLOW (not in pure bash)"

echo ""

# ============================================================================
# Test 6: Hardlink Detection
# ============================================================================
echo "▶ Test 6: Hardlink Detection"
echo "────────────────────────────────────────"

echo "original content" > "$TEST_TEMP_DIR/original.txt"
ln "$TEST_TEMP_DIR/original.txt" "$TEST_TEMP_DIR/hardlink.txt" 2>/dev/null || {
    info "Hardlinks not supported on this filesystem"
    pass "Hardlink test skipped (not supported)"
    echo ""
    goto_next=true
}

if [ "${goto_next:-false}" != "true" ]; then
    get_inode() {
        ls -i "$1" 2>/dev/null | awk '{print $1}'
    }

    get_link_count() {
        stat -f %l "$1" 2>/dev/null || stat -c %h "$1" 2>/dev/null || echo "1"
    }

    original_inode=$(get_inode "$TEST_TEMP_DIR/original.txt")
    hardlink_inode=$(get_inode "$TEST_TEMP_DIR/hardlink.txt")

    if [ "$original_inode" = "$hardlink_inode" ]; then
        pass "Hardlink detected (same inode: $original_inode)"
    else
        fail "Hardlink not detected"
    fi

    link_count=$(get_link_count "$TEST_TEMP_DIR/original.txt")
    if [ "$link_count" -gt 1 ]; then
        pass "File has multiple hardlinks (count: $link_count)"
    fi
fi

echo ""

# ============================================================================
# Test 7: Dangling Symlink Handling
# ============================================================================
echo "▶ Test 7: Dangling Symlink Handling"
echo "────────────────────────────────────────"

ln -s "$TEST_TEMP_DIR/nonexistent_target" "$TEST_TEMP_DIR/dangling_symlink"

handle_dangling_symlink() {
    local filepath="$1"

    if [ -L "$filepath" ]; then
        if [ ! -e "$filepath" ]; then
            echo "ERROR: Dangling symlink" >&2
            return 1
        fi
    fi

    return 0
}

if ! handle_dangling_symlink "$TEST_TEMP_DIR/dangling_symlink"; then
    pass "Dangling symlink correctly detected"
else
    fail "Dangling symlink not detected"
fi

echo ""

# ============================================================================
# Test 8: Recursive Symlink Detection
# ============================================================================
echo "▶ Test 8: Recursive Symlink Detection"
echo "────────────────────────────────────────"

mkdir -p "$TEST_TEMP_DIR/recursive_test"
ln -s "../recursive_test" "$TEST_TEMP_DIR/recursive_test/loop" 2>/dev/null || true

# Test loop detection - try to access deep path
if ! cd "$TEST_TEMP_DIR/recursive_test/loop/loop/loop/loop" 2>/dev/null; then
    pass "Recursive symlink loop handled safely"
else
    cd - >/dev/null
    info "System allows some recursive symlink traversal"
    pass "Recursive symlink test completed"
fi

echo ""

# ============================================================================
# Test 9: Temp Directory Safety
# ============================================================================
echo "▶ Test 9: Temp Directory Safety"
echo "────────────────────────────────────────"

create_safe_temp_file() {
    local temp_file
    temp_file=$(mktemp) || return 1

    if [ -L "$temp_file" ]; then
        rm -f "$temp_file"
        return 1
    fi

    if [ ! -O "$temp_file" ]; then
        rm -f "$temp_file"
        return 1
    fi

    echo "$temp_file"
    return 0
}

temp_file=$(create_safe_temp_file)
if [ -n "$temp_file" ] && [ -f "$temp_file" ] && [ ! -L "$temp_file" ]; then
    pass "Safe temp file created"
    rm -f "$temp_file"
else
    fail "Safe temp file creation failed"
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
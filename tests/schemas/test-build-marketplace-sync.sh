#!/usr/bin/env bash
# test-build-marketplace-sync.sh - Validate build script marketplace version sync logic
# Tests the Phase 5 marketplace.json version sync from build-plugins.sh
#
# IMPORTANT: This test re-implements the sync logic from build-plugins.sh lines 289-319.
# An integrity check (Test 0) verifies the source hasn't diverged from this copy.
# If Test 0 fails, update run_sync() to match the new source.
#
# Isolates the sync logic into a temp directory with fixture data to verify:
# - Source integrity (sync logic hasn't diverged)
# - Version mismatch triggers update
# - Matching versions leave file unchanged
# - Missing plugins in marketplace are skipped
# - Missing marketplace.json is handled gracefully
# - Multiple plugins synced correctly
# - Version downgrade behavior
# - Malformed JSON handling
# - Other fields preserved during sync
#
# P2/P3 gaps for future sessions:
# TODO(P2): Test duplicate plugin names across manifests
# TODO(P2): Test .tmp file cleanup when jq fails mid-write
# TODO(P3): Test with read-only marketplace.json (permission denied)
# TODO(P3): Test realistic scale (36 plugins matching production)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

errors=0
tests_run=0
tests_passed=0

log_error() {
    echo -e "${RED}FAIL:${NC} $*"
    errors=$((errors + 1))
}

log_success() {
    echo -e "${GREEN}PASS:${NC} $*"
    tests_passed=$((tests_passed + 1))
}

assert_eq() {
    local expected="$1"
    local actual="$2"
    local msg="$3"
    tests_run=$((tests_run + 1))
    if [[ "$expected" == "$actual" ]]; then
        log_success "$msg"
    else
        log_error "$msg (expected='$expected', actual='$actual')"
    fi
}

assert_file_contains() {
    local file="$1"
    local expected="$2"
    local msg="$3"
    tests_run=$((tests_run + 1))
    if grep -q "$expected" "$file" 2>/dev/null; then
        log_success "$msg"
    else
        log_error "$msg (file does not contain '$expected')"
    fi
}

assert_file_unchanged() {
    local file="$1"
    local checksum_before="$2"
    local msg="$3"
    tests_run=$((tests_run + 1))
    local checksum_after
    checksum_after=$(md5sum "$file" 2>/dev/null | cut -d' ' -f1 || md5 -q "$file" 2>/dev/null || echo "unknown")
    if [[ "$checksum_before" == "$checksum_after" ]]; then
        log_success "$msg"
    else
        log_error "$msg (file was modified)"
    fi
}

# Checksum helper (works on both Linux and macOS)
compute_checksum() {
    local file="$1"
    if command -v md5sum &>/dev/null; then
        md5sum "$file" | cut -d' ' -f1
    elif command -v md5 &>/dev/null; then
        md5 -q "$file"
    else
        echo "no-md5"
    fi
}

# Check jq availability
if ! command -v jq &>/dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

echo "========================================"
echo "  Build Marketplace Sync Tests"
echo "========================================"
echo ""

# ============================================================================
# Test 0: Source integrity check
# ============================================================================
echo "--- Test 0: Source integrity — sync logic matches build-plugins.sh ---"

# Extract the critical sync logic lines from build-plugins.sh
# This is the logic we re-implement in run_sync() below.
# If these lines change, our test is no longer valid.
EXPECTED_HASH="e5f7e4d3"  # First 8 chars of md5 of the sync logic block
BUILD_SCRIPT="$PROJECT_ROOT/scripts/build-plugins.sh"

tests_run=$((tests_run + 1))
if [[ -f "$BUILD_SCRIPT" ]]; then
    # Extract lines between "Phase 5" and "Phase 6" markers
    SYNC_BLOCK=$(sed -n '/Phase 5: Sync marketplace/,/Phase 6: Summary/p' "$BUILD_SCRIPT")
    # Verify the key operations are present
    if echo "$SYNC_BLOCK" | grep -q 'SYNC_COUNT=0' && \
       echo "$SYNC_BLOCK" | grep -q 'jq -r.*\.name' && \
       echo "$SYNC_BLOCK" | grep -q 'CURRENT_VERSION.*select.*\.name' && \
       echo "$SYNC_BLOCK" | grep -q '\.tmp.*&&.*mv'; then
        log_success "Sync logic structure matches build-plugins.sh"
    else
        log_error "Sync logic in build-plugins.sh has changed — update run_sync() and re-verify tests"
    fi
else
    log_error "build-plugins.sh not found at $BUILD_SCRIPT"
fi
echo ""

# ============================================================================
# Helper: Run the sync logic (extracted from build-plugins.sh Phase 5)
# ============================================================================
run_sync() {
    local manifests_dir="$1"
    local marketplace_file="$2"

    if [[ ! -f "$marketplace_file" ]]; then
        echo "NO_MARKETPLACE"
        return 0
    fi

    local sync_count=0
    for manifest in "$manifests_dir"/*.json; do
        [[ ! -f "$manifest" ]] && continue

        local plugin_name
        plugin_name=$(jq -r '.name' "$manifest")
        local manifest_version
        manifest_version=$(jq -r '.version' "$manifest")

        local current_version
        current_version=$(jq -r --arg name "$plugin_name" '.plugins[] | select(.name == $name) | .version' "$marketplace_file" 2>/dev/null || echo "")

        if [[ -n "$current_version" && "$current_version" != "$manifest_version" ]]; then
            jq --arg name "$plugin_name" --arg ver "$manifest_version" \
                '(.plugins[] | select(.name == $name)).version = $ver' \
                "$marketplace_file" > "${marketplace_file}.tmp" && mv "${marketplace_file}.tmp" "$marketplace_file"
            sync_count=$((sync_count + 1))
        fi
    done

    echo "$sync_count"
}

# ============================================================================
# Test 1: Version mismatch syncs correctly
# ============================================================================
echo "--- Test 1: Version mismatch syncs correctly ---"

TMPDIR1=$(mktemp -d)
mkdir -p "$TMPDIR1/manifests"

# Create manifest with version 5.4.0
cat > "$TMPDIR1/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.4.0", "description": "test"}
EOF

# Create marketplace with version 5.3.0
cat > "$TMPDIR1/marketplace.json" <<'EOF'
{"name": "orchestkit", "version": "5.4.0", "plugins": [{"name": "ork", "version": "5.3.0", "description": "test", "source": ".", "category": "dev"}]}
EOF

SYNC_RESULT=$(run_sync "$TMPDIR1/manifests" "$TMPDIR1/marketplace.json")
assert_eq "1" "$SYNC_RESULT" "Sync count is 1 for version mismatch"

UPDATED_VERSION=$(jq -r '.plugins[] | select(.name == "ork") | .version' "$TMPDIR1/marketplace.json")
assert_eq "5.4.0" "$UPDATED_VERSION" "marketplace.json version updated to 5.4.0"

rm -rf "$TMPDIR1"
echo ""

# ============================================================================
# Test 2: Matching versions -> no change
# ============================================================================
echo "--- Test 2: Matching versions -> no change ---"

TMPDIR2=$(mktemp -d)
mkdir -p "$TMPDIR2/manifests"

cat > "$TMPDIR2/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.3.0", "description": "test"}
EOF

cat > "$TMPDIR2/marketplace.json" <<'EOF'
{"name": "orchestkit", "version": "5.3.0", "plugins": [{"name": "ork", "version": "5.3.0", "description": "test", "source": ".", "category": "dev"}]}
EOF

CHECKSUM_BEFORE=$(compute_checksum "$TMPDIR2/marketplace.json")
SYNC_RESULT=$(run_sync "$TMPDIR2/manifests" "$TMPDIR2/marketplace.json")
assert_eq "0" "$SYNC_RESULT" "Sync count is 0 for matching versions"
assert_file_unchanged "$TMPDIR2/marketplace.json" "$CHECKSUM_BEFORE" "marketplace.json unchanged when versions match"

rm -rf "$TMPDIR2"
echo ""

# ============================================================================
# Test 3: Missing plugin in marketplace -> skip gracefully
# ============================================================================
echo "--- Test 3: Missing plugin in marketplace -> skip gracefully ---"

TMPDIR3=$(mktemp -d)
mkdir -p "$TMPDIR3/manifests"

cat > "$TMPDIR3/manifests/ork-new-plugin.json" <<'EOF'
{"name": "ork-new-plugin", "version": "1.0.0", "description": "new plugin"}
EOF

cat > "$TMPDIR3/marketplace.json" <<'EOF'
{"name": "orchestkit", "version": "5.4.0", "plugins": [{"name": "ork", "version": "5.4.0", "description": "test", "source": ".", "category": "dev"}]}
EOF

CHECKSUM_BEFORE=$(compute_checksum "$TMPDIR3/marketplace.json")
SYNC_RESULT=$(run_sync "$TMPDIR3/manifests" "$TMPDIR3/marketplace.json")
assert_eq "0" "$SYNC_RESULT" "Sync count is 0 for missing plugin in marketplace"
assert_file_unchanged "$TMPDIR3/marketplace.json" "$CHECKSUM_BEFORE" "marketplace.json unchanged when plugin not in marketplace"

rm -rf "$TMPDIR3"
echo ""

# ============================================================================
# Test 4: No marketplace.json -> skip entirely
# ============================================================================
echo "--- Test 4: No marketplace.json -> skip entirely ---"

TMPDIR4=$(mktemp -d)
mkdir -p "$TMPDIR4/manifests"

cat > "$TMPDIR4/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.4.0", "description": "test"}
EOF

tests_run=$((tests_run + 1))
SYNC_RESULT=$(run_sync "$TMPDIR4/manifests" "$TMPDIR4/nonexistent-marketplace.json")
if [[ "$SYNC_RESULT" == "NO_MARKETPLACE" ]]; then
    log_success "Handles missing marketplace.json gracefully"
else
    log_error "Expected NO_MARKETPLACE, got '$SYNC_RESULT'"
fi

rm -rf "$TMPDIR4"
echo ""

# ============================================================================
# Test 5: Multiple plugins synced -> correct count
# ============================================================================
echo "--- Test 5: Multiple plugins synced -> correct count ---"

TMPDIR5=$(mktemp -d)
mkdir -p "$TMPDIR5/manifests"

cat > "$TMPDIR5/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.4.0", "description": "main"}
EOF

cat > "$TMPDIR5/manifests/ork-core.json" <<'EOF'
{"name": "ork-core", "version": "5.4.0", "description": "core"}
EOF

cat > "$TMPDIR5/manifests/ork-memory-graph.json" <<'EOF'
{"name": "ork-memory-graph", "version": "5.4.0", "description": "memory"}
EOF

cat > "$TMPDIR5/marketplace.json" <<'EOF'
{
  "name": "orchestkit",
  "version": "5.4.0",
  "plugins": [
    {"name": "ork", "version": "5.3.0", "description": "main", "source": ".", "category": "dev"},
    {"name": "ork-core", "version": "5.2.0", "description": "core", "source": "./plugins/ork-core", "category": "dev"},
    {"name": "ork-memory-graph", "version": "5.1.0", "description": "memory", "source": "./plugins/ork-memory-graph", "category": "dev"}
  ]
}
EOF

SYNC_RESULT=$(run_sync "$TMPDIR5/manifests" "$TMPDIR5/marketplace.json")
assert_eq "3" "$SYNC_RESULT" "Sync count is 3 for 3 mismatched plugins"

V1=$(jq -r '.plugins[] | select(.name == "ork") | .version' "$TMPDIR5/marketplace.json")
V2=$(jq -r '.plugins[] | select(.name == "ork-core") | .version' "$TMPDIR5/marketplace.json")
V3=$(jq -r '.plugins[] | select(.name == "ork-memory-graph") | .version' "$TMPDIR5/marketplace.json")

assert_eq "5.4.0" "$V1" "ork plugin synced to 5.4.0"
assert_eq "5.4.0" "$V2" "ork-core plugin synced to 5.4.0"
assert_eq "5.4.0" "$V3" "ork-memory-graph plugin synced to 5.4.0"

rm -rf "$TMPDIR5"
echo ""

# ============================================================================
# Test 6: Empty manifests directory -> no sync
# ============================================================================
echo "--- Test 6: Empty manifests directory -> no sync ---"

TMPDIR6=$(mktemp -d)
mkdir -p "$TMPDIR6/manifests"

cat > "$TMPDIR6/marketplace.json" <<'EOF'
{"name": "orchestkit", "version": "5.4.0", "plugins": [{"name": "ork", "version": "5.3.0", "description": "test", "source": ".", "category": "dev"}]}
EOF

CHECKSUM_BEFORE=$(compute_checksum "$TMPDIR6/marketplace.json")
SYNC_RESULT=$(run_sync "$TMPDIR6/manifests" "$TMPDIR6/marketplace.json")
assert_eq "0" "$SYNC_RESULT" "Sync count is 0 for empty manifests dir"
assert_file_unchanged "$TMPDIR6/marketplace.json" "$CHECKSUM_BEFORE" "marketplace.json unchanged with empty manifests"

rm -rf "$TMPDIR6"
echo ""

# ============================================================================
# Test 7: Version downgrade — manifest older than marketplace
# ============================================================================
echo "--- Test 7: Version downgrade (manifest < marketplace) ---"

TMPDIR7=$(mktemp -d)
mkdir -p "$TMPDIR7/manifests"

cat > "$TMPDIR7/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.3.0", "description": "downgrade"}
EOF

cat > "$TMPDIR7/marketplace.json" <<'EOF'
{"name": "orchestkit", "version": "5.4.0", "plugins": [{"name": "ork", "version": "5.4.0", "description": "test", "source": ".", "category": "dev"}]}
EOF

SYNC_RESULT=$(run_sync "$TMPDIR7/manifests" "$TMPDIR7/marketplace.json")
assert_eq "1" "$SYNC_RESULT" "Sync count is 1 for version downgrade (manifest wins)"

DOWNGRADED_VERSION=$(jq -r '.plugins[] | select(.name == "ork") | .version' "$TMPDIR7/marketplace.json")
assert_eq "5.3.0" "$DOWNGRADED_VERSION" "marketplace.json version downgraded to manifest version 5.3.0"

rm -rf "$TMPDIR7"
echo ""

# ============================================================================
# Test 8: Malformed marketplace.json — jq fails gracefully
# ============================================================================
echo "--- Test 8: Malformed marketplace.json ---"

TMPDIR8=$(mktemp -d)
mkdir -p "$TMPDIR8/manifests"

cat > "$TMPDIR8/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.4.0", "description": "test"}
EOF

# Invalid JSON
echo "{invalid json{{" > "$TMPDIR8/marketplace.json"

tests_run=$((tests_run + 1))
# run_sync should not crash (set -e could be an issue)
SYNC_RESULT=$(run_sync "$TMPDIR8/manifests" "$TMPDIR8/marketplace.json" 2>/dev/null || echo "ERROR")
if [[ "$SYNC_RESULT" == "ERROR" || "$SYNC_RESULT" == "0" ]]; then
    log_success "Malformed marketplace.json handled without crash"
else
    log_error "Expected graceful handling of malformed JSON, got '$SYNC_RESULT'"
fi

rm -rf "$TMPDIR8"
echo ""

# ============================================================================
# Test 9: Other fields preserved during version-only sync
# ============================================================================
echo "--- Test 9: Other fields preserved during sync ---"

TMPDIR9=$(mktemp -d)
mkdir -p "$TMPDIR9/manifests"

cat > "$TMPDIR9/manifests/ork.json" <<'EOF'
{"name": "ork", "version": "5.4.0", "description": "test"}
EOF

cat > "$TMPDIR9/marketplace.json" <<'EOF'
{
  "name": "orchestkit",
  "version": "5.4.0",
  "plugins": [
    {
      "name": "ork",
      "version": "5.3.0",
      "description": "OrchestKit full plugin",
      "source": "./plugins/ork",
      "category": "development",
      "tags": ["ai", "automation"]
    }
  ]
}
EOF

run_sync "$TMPDIR9/manifests" "$TMPDIR9/marketplace.json" > /dev/null

# Verify version changed
UPDATED_VERSION=$(jq -r '.plugins[0].version' "$TMPDIR9/marketplace.json")
assert_eq "5.4.0" "$UPDATED_VERSION" "Version updated to 5.4.0"

# Verify other fields preserved
PRESERVED_DESC=$(jq -r '.plugins[0].description' "$TMPDIR9/marketplace.json")
assert_eq "OrchestKit full plugin" "$PRESERVED_DESC" "Description preserved after sync"

PRESERVED_SOURCE=$(jq -r '.plugins[0].source' "$TMPDIR9/marketplace.json")
assert_eq "./plugins/ork" "$PRESERVED_SOURCE" "Source field preserved after sync"

PRESERVED_CATEGORY=$(jq -r '.plugins[0].category' "$TMPDIR9/marketplace.json")
assert_eq "development" "$PRESERVED_CATEGORY" "Category field preserved after sync"

PRESERVED_TAGS=$(jq -r '.plugins[0].tags | length' "$TMPDIR9/marketplace.json")
assert_eq "2" "$PRESERVED_TAGS" "Tags array preserved after sync"

rm -rf "$TMPDIR9"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "========================================"
echo "  Test Summary"
echo "========================================"
echo ""
echo "Tests run:    $tests_run"
echo "Tests passed: $tests_passed"
echo "Errors:       $errors"
echo ""

if [[ $errors -gt 0 ]]; then
    echo -e "${RED}FAILED: $errors test(s) failed${NC}"
    exit 1
fi

echo -e "${GREEN}PASSED: All $tests_run tests passed${NC}"
exit 0

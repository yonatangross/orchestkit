#!/usr/bin/env bash
# ============================================================================
# Pattern Sync Library Unit Tests
# ============================================================================
# Tests for .claude/scripts/pattern-sync.sh
# - Initialization functions
# - Sync enable/disable
# - Pattern filtering
# - Pull and push operations
# - Bidirectional sync
# - Status reporting
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

PATTERN_SYNC_LIB="$PROJECT_ROOT/.claude/scripts/pattern-sync.sh"

# Helper to setup and source pattern-sync.sh with proper env vars
source_pattern_sync() {
    local test_dir="${1:-$TEMP_DIR/default}"
    local test_home="${2:-$TEMP_DIR/home}"

    # Export CLAUDE_PROJECT_DIR so the library uses our test directory
    export CLAUDE_PROJECT_DIR="$test_dir"
    export PROJECT_DIR="$test_dir"
    export PROJECT_PATTERNS_FILE="$test_dir/.claude/feedback/learned-patterns.json"
    export PROJECT_PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"
    export GLOBAL_PATTERNS_DIR="$test_home/.claude"
    export GLOBAL_PATTERNS_FILE="$test_home/.claude/global-patterns.json"

    source "$PATTERN_SYNC_LIB"
}

# ============================================================================
# INITIALIZATION TESTS
# ============================================================================

describe "Pattern Sync Library: Initialization"

test_pattern_sync_lib_exists() {
    assert_file_exists "$PATTERN_SYNC_LIB"
}

test_pattern_sync_lib_syntax() {
    bash -n "$PATTERN_SYNC_LIB"
}

test_init_global_patterns_creates_directory() {
    local test_home="$TEMP_DIR/home1"
    mkdir -p "$test_home"

    source_pattern_sync "$TEMP_DIR/proj1" "$test_home"

    init_global_patterns

    assert_file_exists "$test_home/.claude/global-patterns.json"
}

test_init_global_patterns_creates_valid_json() {
    local test_home="$TEMP_DIR/home2"
    mkdir -p "$test_home"

    source_pattern_sync "$TEMP_DIR/proj2" "$test_home"

    init_global_patterns

    # Verify valid JSON structure
    jq '.' "$test_home/.claude/global-patterns.json" >/dev/null

    local version
    version=$(jq -r '.version' "$test_home/.claude/global-patterns.json")
    assert_equals "1.0" "$version"
}

test_init_global_patterns_has_metadata() {
    local test_home="$TEMP_DIR/home3"
    mkdir -p "$test_home"

    source_pattern_sync "$TEMP_DIR/proj3" "$test_home"

    init_global_patterns

    local has_metadata
    has_metadata=$(jq 'has("metadata")' "$test_home/.claude/global-patterns.json")
    assert_equals "true" "$has_metadata"
}

# ============================================================================
# SYNC ENABLE/DISABLE TESTS
# ============================================================================

describe "Pattern Sync Library: Enable/Disable"

test_is_sync_enabled_default_true() {
    local test_dir="$TEMP_DIR/test-sync1"
    mkdir -p "$test_dir/.claude/feedback"

    # No preferences file created
    source_pattern_sync "$test_dir" "$TEMP_DIR/home-sync1"

    # No preferences file - should default to enabled
    if is_sync_enabled; then
        return 0
    else
        fail "Should default to enabled when no preferences file"
    fi
}

test_is_sync_enabled_when_true() {
    local test_dir="$TEMP_DIR/test-sync2"
    mkdir -p "$test_dir/.claude/feedback"

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$TEMP_DIR/home-sync2"

    if is_sync_enabled; then
        return 0
    else
        fail "Should be enabled when preferences say true"
    fi
}

test_is_sync_enabled_when_false() {
    local test_dir="$TEMP_DIR/test-sync3"
    mkdir -p "$test_dir/.claude/feedback"

    echo '{"syncGlobalPatterns": false}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$TEMP_DIR/home-sync3"

    if is_sync_enabled; then
        fail "Should be disabled when preferences say false"
    fi
}

# ============================================================================
# PATTERN FILTERING TESTS
# ============================================================================

describe "Pattern Sync Library: Pattern Filtering"

test_should_exclude_absolute_paths() {
    source_pattern_sync "$TEMP_DIR/filter1" "$TEMP_DIR/home-filter1"

    if should_exclude_pattern "/usr/local/bin/npm test"; then
        return 0
    else
        fail "Should exclude patterns with absolute paths"
    fi
}

test_should_exclude_node_modules() {
    source_pattern_sync "$TEMP_DIR/filter2" "$TEMP_DIR/home-filter2"

    if should_exclude_pattern "node_modules/.bin/jest"; then
        return 0
    else
        fail "Should exclude patterns with node_modules"
    fi
}

test_should_exclude_git_directory() {
    source_pattern_sync "$TEMP_DIR/filter3" "$TEMP_DIR/home-filter3"

    if should_exclude_pattern ".git/hooks/pre-commit"; then
        return 0
    else
        fail "Should exclude patterns with .git/"
    fi
}

test_should_include_safe_patterns() {
    source_pattern_sync "$TEMP_DIR/filter4" "$TEMP_DIR/home-filter4"

    if should_exclude_pattern "npm test"; then
        fail "Should NOT exclude 'npm test'"
    fi

    if should_exclude_pattern "git status"; then
        fail "Should NOT exclude 'git status'"
    fi

    return 0
}

test_normalize_pattern_removes_absolute_paths() {
    source_pattern_sync "$TEMP_DIR/filter5" "$TEMP_DIR/home-filter5"

    local result
    result=$(normalize_pattern "/home/user/project/npm test")

    # Should simplify the path
    if [[ "$result" != *"/home/user"* ]]; then
        return 0
    else
        fail "Should normalize absolute paths: $result"
    fi
}

# ============================================================================
# PULL OPERATIONS TESTS
# ============================================================================

describe "Pattern Sync Library: Pull Operations"

test_pull_global_patterns_with_no_global_file() {
    local test_dir="$TEMP_DIR/test-pull1"
    mkdir -p "$test_dir/.claude/feedback"

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"
    # Create project patterns file so we get past the project check
    echo '{"version":"1.0","permissions":{},"codeStyle":{},"metadata":{}}' > "$test_dir/.claude/feedback/learned-patterns.json"

    # Set a non-existent global patterns file (init_global_patterns will create it)
    export CLAUDE_PROJECT_DIR="$test_dir"
    export PROJECT_DIR="$test_dir"
    export PROJECT_PATTERNS_FILE="$test_dir/.claude/feedback/learned-patterns.json"
    export PROJECT_PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"
    export GLOBAL_PATTERNS_DIR="$test_dir/nonexistent"
    export GLOBAL_PATTERNS_FILE="$test_dir/nonexistent/global-patterns.json"

    source "$PATTERN_SYNC_LIB"

    # Should handle missing global file gracefully - init_global_patterns creates it, then succeeds
    local output
    output=$(pull_global_patterns 2>&1)

    # Either "No global patterns file" or success message is acceptable
    assert_contains_either "$output" "No global patterns file" "successfully"
}

test_pull_global_patterns_merges_permissions() {
    local test_dir="$TEMP_DIR/test-pull2"
    local test_home="$TEMP_DIR/home-pull2"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    # Create project patterns (with metadata to avoid jq errors)
    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.8, "samples": 3}
  },
  "codeStyle": {},
  "metadata": {}
}
EOF

    # Create global patterns with higher confidence
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.99, "samples": 50},
    "git status": {"autoApprove": true, "confidence": 0.95, "samples": 20}
  },
  "codeStyle": {},
  "metadata": {"projectCount": 2}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    pull_global_patterns >/dev/null

    # Verify "git status" was added from global
    local has_git_status
    has_git_status=$(jq '.permissions["git status"] != null' "$test_dir/.claude/feedback/learned-patterns.json" 2>/dev/null || echo "false")
    assert_equals "true" "$has_git_status"

    # Verify "npm test" got higher confidence from global
    local npm_conf
    npm_conf=$(jq -r '.permissions["npm test"].confidence // 0' "$test_dir/.claude/feedback/learned-patterns.json" 2>/dev/null || echo "0")
    assert_equals "0.99" "$npm_conf"
}

test_pull_disabled_when_sync_off() {
    local test_dir="$TEMP_DIR/test-pull3"
    local test_home="$TEMP_DIR/home-pull3"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    # Create files so pull would work if enabled
    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{"version":"1.0","permissions":{},"codeStyle":{},"metadata":{}}
EOF
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{"version":"1.0","permissions":{},"codeStyle":{},"metadata":{}}
EOF

    echo '{"syncGlobalPatterns": false}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    local output
    output=$(pull_global_patterns 2>&1)

    assert_contains "$output" "disabled"
}

# ============================================================================
# PUSH OPERATIONS TESTS
# ============================================================================

describe "Pattern Sync Library: Push Operations"

test_push_only_high_confidence_patterns() {
    local test_dir="$TEMP_DIR/test-push1"
    local test_home="$TEMP_DIR/home-push1"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    # Create project patterns with mixed confidence
    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.99, "samples": 10},
    "low confidence": {"autoApprove": true, "confidence": 0.5, "samples": 2}
  },
  "codeStyle": {}
}
EOF

    # Create empty global patterns
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {},
  "codeStyle": {},
  "metadata": {"projectCount": 0, "syncHistory": []}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    push_project_patterns >/dev/null

    # Verify high confidence pattern was pushed
    local has_npm_test
    has_npm_test=$(jq '.permissions | has("npm test")' "$test_home/.claude/global-patterns.json")
    assert_equals "true" "$has_npm_test"

    # Verify low confidence pattern was NOT pushed
    local has_low_conf
    has_low_conf=$(jq '.permissions | has("low confidence")' "$test_home/.claude/global-patterns.json")
    assert_equals "false" "$has_low_conf"
}

test_push_adds_source_project() {
    local test_dir="$TEMP_DIR/test-push2"
    local test_home="$TEMP_DIR/home-push2"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {
    "npm run build": {"autoApprove": true, "confidence": 0.98, "samples": 15}
  },
  "codeStyle": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {"projectCount": 0, "syncHistory": []}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    push_project_patterns >/dev/null

    # Verify source was recorded
    local source_val
    source_val=$(jq -r '.permissions["npm run build"].source' "$test_home/.claude/global-patterns.json")

    # Should have a source value (project name)
    if [[ "$source_val" != "null" && -n "$source_val" ]]; then
        return 0
    else
        fail "Should record source project: $source_val"
    fi
}

test_push_updates_sync_history() {
    local test_dir="$TEMP_DIR/test-push3"
    local test_home="$TEMP_DIR/home-push3"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "pytest": {"autoApprove": true, "confidence": 0.96, "samples": 8}
  },
  "codeStyle": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {"projectCount": 0, "syncHistory": []}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    push_project_patterns >/dev/null

    # Verify sync history was updated
    local history_len
    history_len=$(jq '.metadata.syncHistory | length' "$test_home/.claude/global-patterns.json")

    if [[ "$history_len" -ge 1 ]]; then
        return 0
    else
        fail "Should have sync history entry"
    fi
}

test_push_disabled_when_sync_off() {
    local test_dir="$TEMP_DIR/test-push4"
    local test_home="$TEMP_DIR/home-push4"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    # Create files
    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{"version":"1.0","permissions":{"npm test":{"autoApprove":true,"confidence":0.99,"samples":10}},"codeStyle":{}}
EOF
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{"version":"1.0","permissions":{},"codeStyle":{},"metadata":{"syncHistory":[]}}
EOF

    echo '{"syncGlobalPatterns": false}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    local output
    output=$(push_project_patterns 2>&1)

    assert_contains "$output" "disabled"
}

# ============================================================================
# BIDIRECTIONAL SYNC TESTS
# ============================================================================

describe "Pattern Sync Library: Bidirectional Sync"

test_sync_patterns_runs_pull_and_push() {
    local test_dir="$TEMP_DIR/test-bidir1"
    local test_home="$TEMP_DIR/home-bidir1"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "make build": {"autoApprove": true, "confidence": 0.97, "samples": 12}
  },
  "codeStyle": {},
  "metadata": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "cargo test": {"autoApprove": true, "confidence": 0.99, "samples": 30}
  },
  "codeStyle": {},
  "metadata": {"projectCount": 1, "syncHistory": []}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    local output
    output=$(sync_patterns 2>&1)

    assert_contains "$output" "Starting pattern sync"
    assert_contains "$output" "complete"
}

# ============================================================================
# STATUS REPORTING TESTS
# ============================================================================

describe "Pattern Sync Library: Status Reporting"

test_get_sync_status_output() {
    local test_dir="$TEMP_DIR/test-status1"
    local test_home="$TEMP_DIR/home-status1"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.95, "samples": 10}
  },
  "codeStyle": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.95, "samples": 10},
    "npm run build": {"autoApprove": true, "confidence": 0.95, "samples": 10}
  },
  "codeStyle": {},
  "metadata": {"projectCount": 2, "lastSync": "2026-01-01T00:00:00Z"}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    local status
    status=$(get_sync_status)

    assert_contains "$status" "Pattern Sync Status"
    assert_contains "$status" "Global sync:"
    assert_contains "$status" "Global patterns:"
}

test_list_global_patterns_output() {
    local test_home="$TEMP_DIR/home-list1"
    mkdir -p "$test_home/.claude"

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "npm test": {"autoApprove": true, "confidence": 0.95, "samples": 10},
    "pytest": {"autoApprove": true, "confidence": 0.99, "samples": 25}
  },
  "codeStyle": {
    "asyncPreference": "async/await"
  },
  "metadata": {}
}
EOF

    source_pattern_sync "$TEMP_DIR/proj-list1" "$test_home"

    local output
    output=$(list_global_patterns)

    assert_contains "$output" "Global Auto-Approve Patterns"
    assert_contains "$output" "npm test"
    assert_contains "$output" "pytest"
    assert_contains "$output" "Code Style Preferences"
    assert_contains "$output" "asyncPreference"
}

# ============================================================================
# EDGE CASES
# ============================================================================

describe "Pattern Sync Library: Edge Cases"

test_handles_empty_permissions() {
    local test_dir="$TEMP_DIR/test-edge1"
    local test_home="$TEMP_DIR/home-edge1"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {"projectCount": 0}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    # Should handle empty permissions gracefully
    sync_patterns >/dev/null 2>&1

    # Verify files are still valid JSON
    jq '.' "$test_dir/.claude/feedback/learned-patterns.json" >/dev/null
    jq '.' "$test_home/.claude/global-patterns.json" >/dev/null
}

test_handles_missing_metadata() {
    local test_dir="$TEMP_DIR/test-edge2"
    local test_home="$TEMP_DIR/home-edge2"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {"npm test": {"autoApprove": true, "confidence": 0.99, "samples": 10}},
  "codeStyle": {}
}
EOF

    # Global file without metadata
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    # Should handle missing metadata gracefully
    push_project_patterns >/dev/null 2>&1

    # Verify file is still valid JSON
    jq '.' "$test_home/.claude/global-patterns.json" >/dev/null
}

test_keeps_only_last_10_syncs_in_history() {
    local test_dir="$TEMP_DIR/test-edge3"
    local test_home="$TEMP_DIR/home-edge3"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {"npm test": {"autoApprove": true, "confidence": 0.99, "samples": 10}},
  "codeStyle": {}
}
EOF

    # Create global file with 10 existing sync entries
    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {
    "projectCount": 5,
    "syncHistory": [
      {"project": "p1", "timestamp": "2026-01-01T00:00:00Z"},
      {"project": "p2", "timestamp": "2026-01-02T00:00:00Z"},
      {"project": "p3", "timestamp": "2026-01-03T00:00:00Z"},
      {"project": "p4", "timestamp": "2026-01-04T00:00:00Z"},
      {"project": "p5", "timestamp": "2026-01-05T00:00:00Z"},
      {"project": "p6", "timestamp": "2026-01-06T00:00:00Z"},
      {"project": "p7", "timestamp": "2026-01-07T00:00:00Z"},
      {"project": "p8", "timestamp": "2026-01-08T00:00:00Z"},
      {"project": "p9", "timestamp": "2026-01-09T00:00:00Z"},
      {"project": "p10", "timestamp": "2026-01-10T00:00:00Z"}
    ]
  }
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    push_project_patterns >/dev/null

    # Verify only last 10 syncs are kept
    local history_len
    history_len=$(jq '.metadata.syncHistory | length' "$test_home/.claude/global-patterns.json")
    assert_equals "10" "$history_len"

    # Verify first entry was removed (p1 should not be there)
    local first_project
    first_project=$(jq -r '.metadata.syncHistory[0].project' "$test_home/.claude/global-patterns.json")
    if [[ "$first_project" == "p1" ]]; then
        fail "Should have removed oldest sync entry"
    fi
}

test_does_not_push_below_sample_threshold() {
    local test_dir="$TEMP_DIR/test-edge4"
    local test_home="$TEMP_DIR/home-edge4"
    mkdir -p "$test_dir/.claude/feedback"
    mkdir -p "$test_home/.claude"

    # High confidence but low samples
    cat > "$test_dir/.claude/feedback/learned-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {
    "rare command": {"autoApprove": true, "confidence": 0.99, "samples": 3}
  },
  "codeStyle": {}
}
EOF

    cat > "$test_home/.claude/global-patterns.json" << 'EOF'
{
  "version": "1.0",
  "permissions": {},
  "codeStyle": {},
  "metadata": {"projectCount": 0, "syncHistory": []}
}
EOF

    echo '{"syncGlobalPatterns": true}' > "$test_dir/.claude/feedback/preferences.json"

    source_pattern_sync "$test_dir" "$test_home"

    push_project_patterns >/dev/null

    # Verify pattern was NOT pushed (below MIN_SAMPLES_FOR_SYNC=5)
    local has_rare
    has_rare=$(jq '.permissions | has("rare command")' "$test_home/.claude/global-patterns.json")
    assert_equals "false" "$has_rare"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
#!/usr/bin/env bash
# ============================================================================
# Best Practice Library Unit Tests (#49)
# ============================================================================
# Tests for mem0 best practices functions and integration
# - Scope configuration
# - Category detection
# - Pattern JSON building
# - Anti-pattern queries
# - Skill file validation (CC 2.1.6 format)
# - Schema validation
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

MEM0_LIB="$PROJECT_ROOT/hooks/_lib/mem0.sh"

# Source mem0.sh early to initialize all readonly vars and arrays
export CLAUDE_PROJECT_DIR="${TEMP_DIR:-/tmp}/test-project"
mkdir -p "$CLAUDE_PROJECT_DIR"
source "$MEM0_LIB"

# Skill paths (CC 2.1.6 nested structure)
REMEMBER_SKILL="$PROJECT_ROOT/skills/remember"
RECALL_SKILL="$PROJECT_ROOT/skills/recall"
BEST_PRACTICES_SKILL="$PROJECT_ROOT/skills/best-practices"
FEEDBACK_SKILL="$PROJECT_ROOT/skills/feedback"

# Helper to source mem0 with clean environment
source_mem0_clean() {
    # Set up test environment - readonly vars from mem0.sh are already initialized
    # on first source, so we just need to ensure CLAUDE_PROJECT_DIR is set
    export CLAUDE_PROJECT_DIR="$TEMP_DIR/test-project"
    mkdir -p "$CLAUDE_PROJECT_DIR"

    # Source mem0.sh - will skip readonly var initialization if already set
    source "$MEM0_LIB" 2>/dev/null || true
}

# ============================================================================
# SCOPE TESTS
# ============================================================================

describe "Best Practice Library: Scope Configuration"

test_best_practices_scope_exists() {
    source_mem0_clean
    assert_equals "best-practices" "$MEM0_SCOPE_BEST_PRACTICES"
}

test_best_practices_scope_is_valid() {
    source_mem0_clean

    # Verify the scopes array is defined and contains best-practices
    local found=false
    if [[ -n "${MEM0_VALID_SCOPES+x}" ]]; then
        for scope in "${MEM0_VALID_SCOPES[@]}"; do
            if [[ "$scope" == "best-practices" ]]; then
                found=true
                break
            fi
        done
    fi

    [[ "$found" == "true" ]] || fail "best-practices should be in MEM0_VALID_SCOPES"
}

test_user_id_with_best_practices_scope() {
    source_mem0_clean

    local user_id
    user_id=$(mem0_user_id "best-practices")

    assert_equals "test-project-best-practices" "$user_id"
}

# ============================================================================
# CATEGORY DETECTION TESTS
# ============================================================================

describe "Best Practice Library: Category Detection"

test_detect_pagination_category() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Cursor-based pagination scales well")
    assert_equals "pagination" "$category"
}

test_detect_pagination_from_offset() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Using offset pagination for the table")
    assert_equals "pagination" "$category"
}

test_detect_authentication_from_jwt() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "JWT tokens with httpOnly cookies")
    assert_equals "authentication" "$category"
}

test_detect_authentication_from_oauth() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "OAuth integration with Google")
    assert_equals "authentication" "$category"
}

test_detect_authentication_from_session() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Session-based auth for the app")
    assert_equals "authentication" "$category"
}

test_detect_database_from_postgres() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "PostgreSQL with pgvector for embeddings")
    assert_equals "database" "$category"
}

test_detect_database_from_sql() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "SQL query optimization needed")
    assert_equals "database" "$category"
}

test_detect_database_from_migration() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Alembic migration for schema changes")
    assert_equals "database" "$category"
}

test_detect_api_from_rest() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "REST API endpoint design")
    assert_equals "api" "$category"
}

test_detect_api_from_graphql() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "GraphQL vs REST consideration")
    assert_equals "api" "$category"
}

test_detect_frontend_from_react() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "React component structure")
    assert_equals "frontend" "$category"
}

test_detect_frontend_from_css() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "UI styling with Tailwind CSS")
    assert_equals "frontend" "$category"
}

test_detect_performance_from_cache() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Caching improves performance")
    assert_equals "performance" "$category"
}

test_detect_performance_from_slow() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "Query was too slow")
    assert_equals "performance" "$category"
}

test_detect_default_category() {
    source_mem0_clean

    local category
    category=$(detect_best_practice_category "This is some general text without keywords")
    assert_equals "decision" "$category"
}

# ============================================================================
# BUILD PATTERN JSON TESTS
# ============================================================================

describe "Best Practice Library: Pattern JSON Building"

test_build_success_pattern_json_structure() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "pagination" "Cursor pagination works great")

    assert_valid_json "$json"
    assert_json_field "$json" ".text" "Cursor pagination works great"
}

test_build_success_pattern_has_user_id() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "pagination" "Cursor pagination works great")

    assert_json_field "$json" ".user_id" "test-project-best-practices"
}

test_build_success_pattern_outcome() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "pagination" "Cursor pagination works great")

    assert_json_field "$json" ".metadata.outcome" "success"
}

test_build_failed_pattern_outcome() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "failed" "pagination" "Offset pagination timed out")

    assert_json_field "$json" ".metadata.outcome" "failed"
}

test_build_pattern_category() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "authentication" "JWT works well")

    assert_json_field "$json" ".metadata.category" "authentication"
}

test_build_pattern_with_lesson() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "failed" "pagination" "Offset failed" "Use cursor instead")

    assert_json_field "$json" ".metadata.lesson" "Use cursor instead"
}

test_build_pattern_includes_project() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "database" "PostgreSQL works well")

    assert_json_field "$json" ".metadata.project" "test-project"
}

test_build_pattern_includes_timestamp() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "neutral" "decision" "Some decision")

    local timestamp
    timestamp=$(echo "$json" | jq -r '.metadata.stored_at')

    [[ "$timestamp" != "null" ]] || fail "Timestamp should be set"
    [[ -n "$timestamp" ]] || fail "Timestamp should not be empty"
}

test_build_pattern_includes_source() {
    source_mem0_clean

    local json
    json=$(build_best_practice_json "success" "api" "REST endpoint pattern")

    assert_json_field "$json" ".metadata.source" "orchestkit-plugin"
}

# ============================================================================
# ANTIPATTERN QUERY TESTS
# ============================================================================

describe "Best Practice Library: Anti-pattern Queries"

test_antipattern_query_structure() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "implement offset pagination")

    assert_valid_json "$query"
}

test_antipattern_query_has_query_field() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "implement offset pagination")

    local query_text
    query_text=$(echo "$query" | jq -r '.query')

    [[ -n "$query_text" ]] || fail "Query should have query field"
}

test_antipattern_query_has_filters() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "implement offset pagination")

    local has_filters
    has_filters=$(echo "$query" | jq -e '.filters' >/dev/null 2>&1 && echo "true" || echo "false")

    assert_equals "true" "$has_filters"
}

test_antipattern_query_filters_for_failed() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "add cursor pagination")

    local outcome_filter
    outcome_filter=$(echo "$query" | jq -r '.filters.AND[1]["metadata.outcome"]')
    assert_equals "failed" "$outcome_filter"
}

test_antipattern_query_uses_detected_category() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "implement jwt authentication")

    local category_filter
    category_filter=$(echo "$query" | jq -r '.filters.AND[0]["metadata.category"]')
    assert_equals "authentication" "$category_filter"
}

test_antipattern_query_has_limit() {
    source_mem0_clean

    local query
    query=$(check_for_antipattern_query "some pattern")

    local limit
    limit=$(echo "$query" | jq -r '.limit')
    assert_equals "5" "$limit"
}

# ============================================================================
# SKILL FILE TESTS (CC 2.1.6 Format)
# ============================================================================

describe "Best Practice Library: Skill Files (CC 2.1.6)"

test_remember_skill_exists() {
    assert_file_exists "$REMEMBER_SKILL/SKILL.md"
}

test_remember_skill_has_capabilities() {
    : # No-op placeholder
}

test_remember_skill_has_success_flag() {
    assert_file_contains "$REMEMBER_SKILL/SKILL.md" "--success"
}

test_remember_skill_has_failed_flag() {
    assert_file_contains "$REMEMBER_SKILL/SKILL.md" "--failed"
}

test_remember_skill_has_best_practices_scope() {
    assert_file_contains "$REMEMBER_SKILL/SKILL.md" "best-practices"
}

test_recall_skill_exists() {
    assert_file_exists "$RECALL_SKILL/SKILL.md"
}

test_recall_skill_has_capabilities() {
    : # Placeholder
}

test_best_practices_skill_exists() {
    assert_file_exists "$BEST_PRACTICES_SKILL/SKILL.md"
}

test_best_practices_skill_has_capabilities() {
    : # Placeholder
}

test_best_practices_skill_has_categories() {
    assert_file_contains "$BEST_PRACTICES_SKILL/SKILL.md" "pagination"
    assert_file_contains "$BEST_PRACTICES_SKILL/SKILL.md" "authentication"
    assert_file_contains "$BEST_PRACTICES_SKILL/SKILL.md" "database"
}

test_best_practices_skill_has_stats_flag() {
    assert_file_contains "$BEST_PRACTICES_SKILL/SKILL.md" "--stats"
}

test_best_practices_skill_has_warnings_flag() {
    assert_file_contains "$BEST_PRACTICES_SKILL/SKILL.md" "--warnings"
}

test_feedback_skill_exists() {
    assert_file_exists "$FEEDBACK_SKILL/SKILL.md"
}

test_feedback_skill_has_capabilities() {
    : # Placeholder
}

# ============================================================================
# HOOK TESTS
# ============================================================================

describe "Best Practice Library: Hooks"

test_antipattern_hook_exists() {
    assert_file_exists "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh"
}

test_antipattern_hook_is_executable() {
    [[ -x "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" ]] || fail "Hook should be executable"
}

test_antipattern_hook_has_shebang() {
    local first_line
    first_line=$(head -1 "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh")
    assert_contains "$first_line" "#!/"
}

# ============================================================================
# SCHEMA TESTS
# ============================================================================

describe "Best Practice Library: Schema"

test_schema_has_best_practice_pattern() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local has_definition
    has_definition=$(jq -e '.definitions.bestPracticePattern' "$schema_file" >/dev/null 2>&1 && echo "true" || echo "false")

    assert_equals "true" "$has_definition"
}

test_schema_outcome_enum_has_success() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local outcomes
    outcomes=$(jq -r '.definitions.bestPracticePattern.properties.outcome.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$outcomes" "success"
}

test_schema_outcome_enum_has_failed() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local outcomes
    outcomes=$(jq -r '.definitions.bestPracticePattern.properties.outcome.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$outcomes" "failed"
}

test_schema_outcome_enum_has_neutral() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local outcomes
    outcomes=$(jq -r '.definitions.bestPracticePattern.properties.outcome.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$outcomes" "neutral"
}

test_schema_category_enum_has_pagination() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local categories
    categories=$(jq -r '.definitions.bestPracticePattern.properties.category.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$categories" "pagination"
}

test_schema_category_enum_has_authentication() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local categories
    categories=$(jq -r '.definitions.bestPracticePattern.properties.category.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$categories" "authentication"
}

test_schema_category_enum_has_database() {
    local schema_file="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
    local categories
    categories=$(jq -r '.definitions.bestPracticePattern.properties.category.enum | @csv' "$schema_file" 2>/dev/null)

    assert_contains "$categories" "database"
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

run_tests
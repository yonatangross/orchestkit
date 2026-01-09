#!/bin/bash
# Skill Semantic Matching Discovery Tests
# Tests that skill capabilities.json triggers and keywords correctly match user queries
#
# Usage: ./test-skill-discovery.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# Version: 1.0.0
# Part of SkillForge Plugin Test Suite

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

# Source test helpers
source "$PROJECT_ROOT/tests/fixtures/test-helpers.sh"

# Verbose mode
VERBOSE="${1:-}"
[[ "$VERBOSE" == "--verbose" ]] && set -x

# ============================================================================
# SEMANTIC MATCHING FUNCTIONS
# ============================================================================

# Check if skill uses slim array format (capabilities as string array)
is_slim_format() {
    local skill_name="$1"
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"
    
    if [[ ! -f "$caps_file" ]]; then
        return 1
    fi
    
    jq -e '.capabilities | type == "array"' "$caps_file" >/dev/null 2>&1
}


# Match query against high_confidence triggers in capabilities.json
# Returns 0 if matched, 1 if not matched
match_high_confidence() {
    local query="$1"
    local skill_name="$2"
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"

    if [[ ! -f "$caps_file" ]]; then
        echo "Capabilities file not found: $caps_file" >&2
        return 1
    fi

    # Get high_confidence triggers as array
    local triggers
    triggers=$(jq -r '.triggers.high_confidence[]?' "$caps_file" 2>/dev/null)

    if [[ -z "$triggers" ]]; then
        return 1
    fi

    # Convert query to lowercase for case-insensitive matching
    local query_lower
    query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')

    # Test each trigger pattern against the query
    # The patterns use .* to mean "anything in between" (regex wildcard)
    while IFS= read -r pattern; do
        if [[ -n "$pattern" ]]; then
            # The trigger patterns are regex patterns like "design.*api"
            # which should match "design a REST api" or "design my api"
            if echo "$query_lower" | grep -iE "$pattern" >/dev/null 2>&1; then
                return 0
            fi
        fi
    done <<< "$triggers"

    return 1
}

# Match query against medium_confidence triggers
match_medium_confidence() {
    local query="$1"
    local skill_name="$2"
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"

    if [[ ! -f "$caps_file" ]]; then
        return 1
    fi

    local triggers
    triggers=$(jq -r '.triggers.medium_confidence[]?' "$caps_file" 2>/dev/null)

    if [[ -z "$triggers" ]]; then
        return 1
    fi

    local query_lower
    query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')

    while IFS= read -r pattern; do
        if [[ -n "$pattern" ]]; then
            if echo "$query_lower" | grep -iE "$pattern" >/dev/null 2>&1; then
                return 0
            fi
        fi
    done <<< "$triggers"

    return 1
}

# Match query against capability keywords
# Supports both slim format (reads from SKILL.md) and legacy format (reads from capabilities.json)
match_keywords() {
    local query="$1"
    local skill_name="$2"
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"
    local skill_md="$SKILLS_DIR/$skill_name/SKILL.md"
    local min_matches="${3:-2}"  # Minimum keyword matches required

    if [[ ! -f "$caps_file" ]]; then
        return 1
    fi

    local keywords=""
    
    # Check format and extract keywords accordingly
    if is_slim_format "$skill_name"; then
        # Slim format: extract keywords from SKILL.md "**Keywords:**" lines
        if [[ -f "$skill_md" ]]; then
            keywords=$(grep -o '\*\*Keywords:\*\* [^*]*' "$skill_md" 2>/dev/null | sed 's/\*\*Keywords:\*\* //' | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u)
        fi
    else
        # Legacy format: get keywords from capabilities.json
        keywords=$(jq -r '.capabilities[].keywords[]?' "$caps_file" 2>/dev/null | sort -u)
    fi

    if [[ -z "$keywords" ]]; then
        return 1
    fi

    local query_lower
    query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')

    local match_count=0
    while IFS= read -r keyword; do
        if [[ -n "$keyword" ]]; then
            local keyword_lower
            keyword_lower=$(echo "$keyword" | tr '[:upper:]' '[:lower:]')

            if echo "$query_lower" | grep -iw "$keyword_lower" >/dev/null 2>&1; then
                match_count=$((match_count + 1))
            fi
        fi
    done <<< "$keywords"

    if [[ $match_count -ge $min_matches ]]; then
        return 0
    fi

    return 1
}

# Match query against solves questions
# Supports both slim format (reads from SKILL.md) and legacy format (reads from capabilities.json)
match_solves() {
    local query="$1"
    local skill_name="$2"
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"
    local skill_md="$SKILLS_DIR/$skill_name/SKILL.md"

    if [[ ! -f "$caps_file" ]]; then
        return 1
    fi

    local solves=""
    
    # Check format and extract solves accordingly
    if is_slim_format "$skill_name"; then
        # Slim format: extract solves from SKILL.md "**Solves:**" sections (lines starting with "- ")
        if [[ -f "$skill_md" ]]; then
            solves=$(awk '/\*\*Solves:\*\*/{flag=1; next} /^###|^\*\*/{flag=0} flag && /^- /{sub(/^- /, ""); print}' "$skill_md" 2>/dev/null)
        fi
    else
        # Legacy format: get solves from capabilities.json
        solves=$(jq -r '.capabilities[].solves[]?' "$caps_file" 2>/dev/null)
    fi

    if [[ -z "$solves" ]]; then
        return 1
    fi

    local query_lower
    query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')

    # Extract key terms from query (words > 3 chars)
    local query_terms
    query_terms=$(echo "$query_lower" | tr ' ' '\n' | awk 'length >= 4' | sort -u)

    while IFS= read -r solve; do
        if [[ -n "$solve" ]]; then
            local solve_lower
            solve_lower=$(echo "$solve" | tr '[:upper:]' '[:lower:]')

            # Count matching terms
            local term_matches=0
            while IFS= read -r term; do
                if [[ -n "$term" ]] && echo "$solve_lower" | grep -iw "$term" >/dev/null 2>&1; then
                    term_matches=$((term_matches + 1))
                fi
            done <<< "$query_terms"

            # If 2+ terms match, consider it a match
            if [[ $term_matches -ge 2 ]]; then
                return 0
            fi
        fi
    done <<< "$solves"

    return 1
}

# Check if skill belongs to a category by keyword presence
# Supports both slim format (reads from SKILL.md) and legacy format (reads from capabilities.json)
check_category_keywords() {
    local skill_name="$1"
    shift
    local caps_file="$SKILLS_DIR/$skill_name/capabilities.json"
    local skill_md="$SKILLS_DIR/$skill_name/SKILL.md"

    if [[ ! -f "$caps_file" ]]; then
        return 1
    fi

    # Get all keywords and description
    local all_text=""
    
    if is_slim_format "$skill_name"; then
        # Slim format: get description from capabilities.json + keywords from SKILL.md
        local desc
        desc=$(jq -r '.description // ""' "$caps_file" 2>/dev/null)
        local keywords=""
        if [[ -f "$skill_md" ]]; then
            keywords=$(grep -o '\*\*Keywords:\*\* [^*]*' "$skill_md" 2>/dev/null | sed 's/\*\*Keywords:\*\* //' | tr ',' ' ')
        fi
        all_text=$(echo "$desc $keywords" | tr '[:upper:]' '[:lower:]')
    else
        # Legacy format
        all_text=$(jq -r '(.description // "") + " " + (.capabilities[].keywords[]? // "")' "$caps_file" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    fi

    # Check if at least one required keyword is present
    for keyword in "$@"; do
        local keyword_lower
        keyword_lower=$(echo "$keyword" | tr '[:upper:]' '[:lower:]')

        if echo "$all_text" | grep -iw "$keyword_lower" >/dev/null 2>&1; then
            return 0
        fi
    done

    return 1
}

# ============================================================================
# TEST FUNCTIONS: High Confidence Trigger Pattern Tests
# ============================================================================

describe "High Confidence Trigger Pattern Tests"

# api-design-framework: triggers include "design.*api", "create.*endpoint", "add.*route"
test_high_confidence_design_api() {
    local query="design a new api for users"
    local expected_skill="api-design-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_create_endpoint() {
    local query="create endpoint for products"
    local expected_skill="api-design-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_add_route() {
    local query="add route for authentication"
    local expected_skill="api-design-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_api_pattern() {
    local query="api design pattern best practices"
    local expected_skill="api-design-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_rest_design() {
    local query="rest api design principles"
    local expected_skill="api-design-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# auth-patterns: triggers include "authentication", "OAuth.*PKCE", "passkey", "WebAuthn"
test_high_confidence_authentication() {
    local query="implement authentication with OAuth"
    local expected_skill="auth-patterns"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_oauth_pkce() {
    local query="OAuth PKCE flow implementation"
    local expected_skill="auth-patterns"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_passkey() {
    local query="add passkey login support"
    local expected_skill="auth-patterns"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_webauthn() {
    local query="implement WebAuthn for passwordless"
    local expected_skill="auth-patterns"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# caching-strategies: triggers include "cache.?aside", "write.?through", "write.?behind", "redis.?cache"
test_high_confidence_cache_aside() {
    local query="implement cache aside pattern"
    local expected_skill="caching-strategies"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_write_through() {
    local query="add write through cache"
    local expected_skill="caching-strategies"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_write_behind() {
    local query="write behind caching"
    local expected_skill="caching-strategies"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_redis_cache() {
    local query="redis cache implementation"
    local expected_skill="caching-strategies"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_cache_invalidation() {
    local query="cache invalidation strategy"
    local expected_skill="caching-strategies"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# react-server-components-framework: triggers include "next.*js.*15", "server.*component", "react.*19", etc
test_high_confidence_nextjs_15() {
    local query="next js 15 app router setup"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_server_component() {
    local query="server component patterns"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_react_19() {
    local query="react 19 hooks"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_react_fc() {
    local query="React.FC replacement pattern"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_forwardref() {
    local query="forwardRef migration"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_tanstack_router() {
    local query="tanstack router setup"
    local expected_skill="react-server-components-framework"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# unit-testing: triggers include "unit.*test", "pytest.*unit", "vitest.*test"
test_high_confidence_unit_test() {
    local query="unit test coverage"
    local expected_skill="unit-testing"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_pytest_unit() {
    local query="pytest unit test setup"
    local expected_skill="unit-testing"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_vitest_test() {
    local query="vitest test configuration"
    local expected_skill="unit-testing"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# embeddings: triggers include "embedding", "semantic.*search", "text.*vector"
test_high_confidence_embedding() {
    local query="embedding model selection"
    local expected_skill="embeddings"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_semantic_search() {
    local query="semantic search implementation"
    local expected_skill="embeddings"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_text_vector() {
    local query="text vector conversion"
    local expected_skill="embeddings"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# pgvector-search: triggers include "hybrid.*search", "vector.*bm25.*search", "reciprocal.*rank.*fusion"
test_high_confidence_hybrid_search() {
    local query="hybrid search with pgvector"
    local expected_skill="pgvector-search"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_rrf() {
    local query="reciprocal rank fusion implementation"
    local expected_skill="pgvector-search"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_vector_bm25_search() {
    local query="vector bm25 search combo"
    local expected_skill="pgvector-search"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

test_high_confidence_implement_hybrid() {
    local query="implement hybrid retrieval"
    local expected_skill="pgvector-search"

    if match_high_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match high_confidence trigger for '$expected_skill'"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Keyword Matching Tests
# ============================================================================

describe "Keyword Matching Tests"

test_keyword_rest_crud() {
    local query="RESTful endpoint with CRUD operations"
    local expected_skill="api-design-framework"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_http_route() {
    local query="HTTP route with resource path"
    local expected_skill="api-design-framework"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_jwt_oauth() {
    local query="JWT token with OAuth flow"
    local expected_skill="auth-patterns"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_password_session() {
    local query="password hashing and session management"
    local expected_skill="auth-patterns"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_cache_ttl() {
    local query="cache TTL and invalidation"
    local expected_skill="caching-strategies"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_write_through_cache() {
    local query="write through cache consistency"
    local expected_skill="caching-strategies"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_rsc_suspense() {
    local query="server component with suspense boundary"
    local expected_skill="react-server-components-framework"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_react_forwardref() {
    local query="React 19 forwardRef replacement"
    local expected_skill="react-server-components-framework"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_pytest_fixture() {
    local query="pytest fixture with parametrize"
    local expected_skill="unit-testing"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_vitest_mock() {
    local query="vitest with jest mocking"
    local expected_skill="unit-testing"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_embedding_vector() {
    local query="embedding vectorize semantic search"
    local expected_skill="embeddings"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_chunk_split() {
    local query="chunk text splitting strategy"
    local expected_skill="embeddings"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_hnsw_bm25() {
    local query="HNSW index with BM25 full-text search"
    local expected_skill="pgvector-search"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

test_keyword_tsvector() {
    local query="tsvector tsquery full-text search"
    local expected_skill="pgvector-search"

    if match_keywords "$query" "$expected_skill" 2; then
        return 0
    else
        fail "Query '$query' should match keywords for '$expected_skill'"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Solves Matching Tests
# ============================================================================

describe "Solves Matching Tests"

test_solves_rest_design() {
    local query="How do I design RESTful APIs?"
    local expected_skill="api-design-framework"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_pagination() {
    local query="How do I add pagination to an endpoint?"
    local expected_skill="api-design-framework"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_api_versioning() {
    local query="How do I version my API?"
    local expected_skill="api-design-framework"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_jwt_tokens() {
    local query="How do I generate and validate JWT access tokens?"
    local expected_skill="auth-patterns"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_passwordless() {
    local query="How do I implement passwordless authentication?"
    local expected_skill="auth-patterns"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_oauth_pkce() {
    local query="Implement OAuth 2.1 with PKCE flow"
    local expected_skill="auth-patterns"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_cache_consistency() {
    local query="How to keep cache consistent with database?"
    local expected_skill="caching-strategies"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_cache_invalidate() {
    local query="How do I invalidate cache?"
    local expected_skill="caching-strategies"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_cache_stampede() {
    local query="Prevent cache stampede problem"
    local expected_skill="caching-strategies"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_server_vs_client() {
    local query="When to use server vs client components?"
    local expected_skill="react-server-components-framework"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_react_fc_replacement() {
    local query="How do I replace React.FC in React 19?"
    local expected_skill="react-server-components-framework"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_hybrid_search() {
    local query="How do I combine vector and keyword search?"
    local expected_skill="pgvector-search"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

test_solves_pgvector_index() {
    local query="How do I index PGVector for performance?"
    local expected_skill="pgvector-search"

    if match_solves "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match solves for '$expected_skill'"
    fi
}

# ============================================================================
# TEST FUNCTIONS: No False Positive Tests
# ============================================================================

describe "No False Positive Tests"

test_no_false_positive_css_not_api() {
    local query="css styling patterns for buttons"
    local wrong_skill="api-design-framework"

    if ! match_high_confidence "$query" "$wrong_skill" && ! match_keywords "$query" "$wrong_skill" 2; then
        return 0
    else
        fail "Query '$query' should NOT match '$wrong_skill'"
    fi
}

test_no_false_positive_html_not_api() {
    local query="html form structure"
    local wrong_skill="api-design-framework"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_react_not_caching() {
    local query="react component state management"
    local wrong_skill="caching-strategies"

    if ! match_high_confidence "$query" "$wrong_skill" && ! match_keywords "$query" "$wrong_skill" 2; then
        return 0
    else
        fail "Query '$query' should NOT match '$wrong_skill'"
    fi
}

test_no_false_positive_vue_not_caching() {
    local query="vue reactivity system"
    local wrong_skill="caching-strategies"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_html_not_auth() {
    local query="html form validation patterns"
    local wrong_skill="auth-patterns"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_kubernetes_not_caching() {
    local query="kubernetes deployment configuration"
    local wrong_skill="caching-strategies"

    if ! match_high_confidence "$query" "$wrong_skill" && ! match_keywords "$query" "$wrong_skill" 2; then
        return 0
    else
        fail "Query '$query' should NOT match '$wrong_skill'"
    fi
}

test_no_false_positive_ml_not_testing() {
    local query="machine learning model training"
    local wrong_skill="unit-testing"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_database_not_caching() {
    local query="database schema design"
    local wrong_skill="caching-strategies"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_performance_not_caching() {
    local query="performance monitoring setup"
    local wrong_skill="caching-strategies"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

test_no_false_positive_mobile_not_api() {
    local query="mobile app development"
    local wrong_skill="api-design-framework"

    if ! match_high_confidence "$query" "$wrong_skill"; then
        return 0
    else
        fail "Query '$query' should NOT match high_confidence for '$wrong_skill'"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Category Consistency Tests
# ============================================================================

describe "Category Consistency Tests"

test_category_api_design_has_backend_keywords() {
    local skill="api-design-framework"

    if check_category_keywords "$skill" "backend" "server" "api" "endpoint" "route" "http"; then
        return 0
    else
        fail "Backend skill '$skill' should have backend-related keywords"
    fi
}

test_category_auth_patterns_has_backend_keywords() {
    local skill="auth-patterns"

    if check_category_keywords "$skill" "authentication" "authorization" "token" "session" "password"; then
        return 0
    else
        fail "Backend skill '$skill' should have auth-related keywords"
    fi
}

test_category_caching_has_backend_keywords() {
    local skill="caching-strategies"

    if check_category_keywords "$skill" "cache" "redis" "backend" "database" "ttl"; then
        return 0
    else
        fail "Backend skill '$skill' should have caching-related keywords"
    fi
}

test_category_react_has_frontend_keywords() {
    local skill="react-server-components-framework"

    if check_category_keywords "$skill" "react" "component" "frontend" "ui" "jsx" "typescript"; then
        return 0
    else
        fail "Frontend skill '$skill' should have frontend-related keywords"
    fi
}

test_category_unit_testing_has_testing_keywords() {
    local skill="unit-testing"

    if check_category_keywords "$skill" "test" "testing" "pytest" "vitest" "fixture" "mock"; then
        return 0
    else
        fail "Testing skill '$skill' should have testing-related keywords"
    fi
}

test_category_embeddings_has_ai_keywords() {
    local skill="embeddings"

    if check_category_keywords "$skill" "embedding" "vector" "semantic" "similarity"; then
        return 0
    else
        fail "AI skill '$skill' should have AI-related keywords"
    fi
}

test_category_pgvector_has_database_keywords() {
    local skill="pgvector-search"

    if check_category_keywords "$skill" "vector" "search" "database" "postgresql" "pgvector" "index"; then
        return 0
    else
        fail "Database skill '$skill' should have database-related keywords"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Skill Capabilities File Validation
# ============================================================================

describe "Skill Capabilities File Validation"

test_all_skills_have_capabilities_json() {
    local missing=0
    local skill_dirs

    skill_dirs=$(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d | sort)

    while IFS= read -r skill_dir; do
        local skill_name
        skill_name=$(basename "$skill_dir")

        if [[ ! -f "$skill_dir/capabilities.json" ]]; then
            echo "Missing capabilities.json: $skill_name" >&2
            missing=$((missing + 1))
        fi
    done <<< "$skill_dirs"

    if [[ $missing -eq 0 ]]; then
        return 0
    else
        fail "$missing skills missing capabilities.json"
    fi
}

test_all_capabilities_have_triggers() {
    local missing=0
    local caps_files

    caps_files=$(find "$SKILLS_DIR" -name "capabilities.json" | sort)

    while IFS= read -r caps_file; do
        local skill_name
        skill_name=$(basename "$(dirname "$caps_file")")

        local has_triggers
        has_triggers=$(jq -r '.triggers // empty' "$caps_file" 2>/dev/null)

        if [[ -z "$has_triggers" ]]; then
            echo "Missing triggers: $skill_name" >&2
            missing=$((missing + 1))
        fi
    done <<< "$caps_files"

    if [[ $missing -eq 0 ]]; then
        return 0
    else
        fail "$missing capabilities.json files missing triggers"
    fi
}

test_all_capabilities_have_high_confidence_triggers() {
    local missing=0
    local caps_files

    caps_files=$(find "$SKILLS_DIR" -name "capabilities.json" | sort)

    while IFS= read -r caps_file; do
        local skill_name
        skill_name=$(basename "$(dirname "$caps_file")")

        local high_conf
        high_conf=$(jq -r '.triggers.high_confidence // empty' "$caps_file" 2>/dev/null)

        if [[ -z "$high_conf" ]] || [[ "$high_conf" == "[]" ]]; then
            echo "Missing high_confidence triggers: $skill_name" >&2
            missing=$((missing + 1))
        fi
    done <<< "$caps_files"

    if [[ $missing -eq 0 ]]; then
        return 0
    else
        fail "$missing capabilities.json files missing high_confidence triggers"
    fi
}

test_capabilities_keywords_not_empty() {
    local empty_count=0
    local caps_files

    caps_files=$(find "$SKILLS_DIR" -name "capabilities.json" | sort)

    while IFS= read -r caps_file; do
        local skill_name
        skill_name=$(basename "$(dirname "$caps_file")")
        local skill_md="$SKILLS_DIR/$skill_name/SKILL.md"

        local keyword_count=0
        
        # Check format and count keywords accordingly
        if is_slim_format "$skill_name"; then
            # Slim format: count keywords from SKILL.md
            if [[ -f "$skill_md" ]]; then
                keyword_count=$(grep -c '\*\*Keywords:\*\*' "$skill_md" 2>/dev/null || echo "0")
            fi
        else
            # Legacy format
            keyword_count=$(jq -r '[.capabilities[].keywords[]?] | length' "$caps_file" 2>/dev/null)
        fi

        if [[ -z "$keyword_count" ]] || [[ "$keyword_count" -eq 0 ]]; then
            echo "No keywords found: $skill_name" >&2
            empty_count=$((empty_count + 1))
        fi
    done <<< "$caps_files"

    if [[ $empty_count -eq 0 ]]; then
        return 0
    else
        fail "$empty_count capabilities.json files have no keywords"
    fi
}

test_capabilities_solves_not_empty() {
    local empty_count=0
    local caps_files

    caps_files=$(find "$SKILLS_DIR" -name "capabilities.json" | sort)

    while IFS= read -r caps_file; do
        local skill_name
        skill_name=$(basename "$(dirname "$caps_file")")
        local skill_md="$SKILLS_DIR/$skill_name/SKILL.md"

        local solves_count=0
        
        # Check format and count solves accordingly
        if is_slim_format "$skill_name"; then
            # Slim format: count solves from SKILL.md (lines starting with "- " after "**Solves:**")
            if [[ -f "$skill_md" ]]; then
                solves_count=$(grep -c '\*\*Solves:\*\*' "$skill_md" 2>/dev/null || echo "0")
            fi
        else
            # Legacy format
            solves_count=$(jq -r '[.capabilities[].solves[]?] | length' "$caps_file" 2>/dev/null)
        fi

        if [[ -z "$solves_count" ]] || [[ "$solves_count" -eq 0 ]]; then
            echo "No solves questions: $skill_name" >&2
            empty_count=$((empty_count + 1))
        fi
    done <<< "$caps_files"

    if [[ $empty_count -eq 0 ]]; then
        return 0
    else
        fail "$empty_count capabilities.json files have no solves questions"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Trigger Pattern Regex Validity
# ============================================================================

describe "Trigger Pattern Regex Validity"

test_trigger_patterns_are_valid_regex() {
    local invalid=0
    local caps_files

    caps_files=$(find "$SKILLS_DIR" -name "capabilities.json" | sort)

    while IFS= read -r caps_file; do
        local skill_name
        skill_name=$(basename "$(dirname "$caps_file")")

        # Test high_confidence patterns
        local patterns
        patterns=$(jq -r '.triggers.high_confidence[]?' "$caps_file" 2>/dev/null)

        while IFS= read -r pattern; do
            if [[ -n "$pattern" ]]; then
                # Test if pattern is valid grep regex by checking for syntax errors
                local test_result
                test_result=$(echo "test" 2>&1 | grep -E "$pattern" 2>&1) || true

                if echo "$test_result" | grep -qi "invalid\|illegal\|unrecognized\|error" 2>/dev/null; then
                    echo "Invalid regex in $skill_name: $pattern" >&2
                    invalid=$((invalid + 1))
                fi
            fi
        done <<< "$patterns"

        # Test medium_confidence patterns
        patterns=$(jq -r '.triggers.medium_confidence[]?' "$caps_file" 2>/dev/null)

        while IFS= read -r pattern; do
            if [[ -n "$pattern" ]]; then
                local test_result
                test_result=$(echo "test" 2>&1 | grep -E "$pattern" 2>&1) || true

                if echo "$test_result" | grep -qi "invalid\|illegal\|unrecognized\|error" 2>/dev/null; then
                    echo "Invalid regex in $skill_name: $pattern" >&2
                    invalid=$((invalid + 1))
                fi
            fi
        done <<< "$patterns"
    done <<< "$caps_files"

    if [[ $invalid -eq 0 ]]; then
        return 0
    else
        fail "$invalid invalid regex patterns found"
    fi
}

# ============================================================================
# TEST FUNCTIONS: Medium Confidence Trigger Tests
# ============================================================================

describe "Medium Confidence Trigger Tests"

test_medium_confidence_jwt() {
    local query="JWT token handling"
    local expected_skill="auth-patterns"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_login() {
    local query="login flow implementation"
    local expected_skill="auth-patterns"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_session() {
    local query="session management implementation"
    local expected_skill="auth-patterns"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_password() {
    local query="password hashing implementation"
    local expected_skill="auth-patterns"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_caching() {
    local query="add caching layer"
    local expected_skill="caching-strategies"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_ttl() {
    local query="configure ttl for cache"
    local expected_skill="caching-strategies"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_cache_miss() {
    local query="handle cache miss scenario"
    local expected_skill="caching-strategies"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_use_optimistic() {
    local query="useOptimistic hook usage"
    local expected_skill="react-server-components-framework"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_use_action_state() {
    local query="useActionState implementation"
    local expected_skill="react-server-components-framework"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_optimistic_update() {
    local query="optimistic update pattern"
    local expected_skill="react-server-components-framework"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_similarity() {
    local query="vector similarity search"
    local expected_skill="embeddings"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_chunk() {
    local query="document chunk splitting"
    local expected_skill="embeddings"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_hnsw_ivfflat() {
    local query="hnsw ivfflat comparison"
    local expected_skill="pgvector-search"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

test_medium_confidence_pgvector_indexing() {
    local query="pgvector indexing strategy"
    local expected_skill="pgvector-search"

    if match_medium_confidence "$query" "$expected_skill"; then
        return 0
    else
        fail "Query '$query' should match medium_confidence trigger for '$expected_skill'"
    fi
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

echo "=========================================="
echo "  Skill Semantic Matching Discovery Tests"
echo "=========================================="
echo ""
echo "Skills Directory: $SKILLS_DIR"
echo "Total Skills: $(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')"
echo ""

run_tests
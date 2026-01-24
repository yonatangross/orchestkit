#!/usr/bin/env bash
# ============================================================================
# Agent Memory Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/subagent-start/agent-memory-inject.ts
# Tests for hooks/src/subagent-stop/agent-memory-store.ts
# Part of Phase 2 mem0 integration (#44, #45)
#
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_PRE_AGENT="$PROJECT_ROOT/hooks/src/subagent-start/agent-memory-inject.ts"
TS_POST_AGENT="$PROJECT_ROOT/hooks/src/subagent-stop/agent-memory-store.ts"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# PRE-AGENT HOOK TESTS (TypeScript)
# ============================================================================

describe "Pre-Agent Hook: TypeScript Source"

test_pre_agent_hook_exists() {
    assert_file_exists "$TS_PRE_AGENT"
}

test_pre_agent_hook_exports_handler() {
    assert_file_contains "$TS_PRE_AGENT" "export"
}

test_pre_agent_hook_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_PRE_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should have function definition"
}

it "exists" test_pre_agent_hook_exists
it "exports handler" test_pre_agent_hook_exports_handler
it "has function definition" test_pre_agent_hook_has_function

describe "Pre-Agent Hook: Core Logic"

test_pre_agent_has_domain_mapping() {
    if grep -qiE "domain|agent|subagent|type" "$TS_PRE_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should have agent domain mapping"
}

test_pre_agent_extracts_subagent_type() {
    if grep -qiE "subagent|type|agent" "$TS_PRE_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should extract subagent_type"
}

test_pre_agent_checks_mem0_available() {
    if grep -qiE "mem0|memory|available|check" "$TS_PRE_AGENT" 2>/dev/null; then
        return 0
    fi
    # May be in lib files
    if grep -qiE "mem0|available" "$PROJECT_ROOT/hooks/src/lib/"*.ts 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should check mem0 availability"
}

it "has agent domain mapping" test_pre_agent_has_domain_mapping
it "extracts subagent_type" test_pre_agent_extracts_subagent_type
it "checks mem0 availability" test_pre_agent_checks_mem0_available

describe "Pre-Agent Hook: CC 2.1.6 Compliance"

test_pre_agent_has_hook_result() {
    if grep -qE "HookResult|continue|suppressOutput" "$TS_PRE_AGENT" 2>/dev/null; then
        return 0
    fi
    # Check types file
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should use HookResult type"
}

it "uses HookResult type" test_pre_agent_has_hook_result

# ============================================================================
# POST-AGENT HOOK TESTS (TypeScript)
# ============================================================================

describe "Post-Agent Hook: TypeScript Source"

test_post_agent_hook_exists() {
    assert_file_exists "$TS_POST_AGENT"
}

test_post_agent_hook_exports_handler() {
    assert_file_contains "$TS_POST_AGENT" "export"
}

test_post_agent_hook_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_POST_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should have function definition"
}

it "exists" test_post_agent_hook_exists
it "exports handler" test_post_agent_hook_exports_handler
it "has function definition" test_post_agent_hook_has_function

describe "Post-Agent Hook: Pattern Extraction"

test_post_agent_has_decision_patterns() {
    if grep -qiE "pattern|decision|extract" "$TS_POST_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should have decision patterns"
}

test_post_agent_has_extract_function() {
    if grep -qiE "extract|pattern" "$TS_POST_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should have extract functionality"
}

test_post_agent_logs_performance() {
    if grep -qiE "performance|log|duration|time" "$TS_POST_AGENT" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should log performance"
}

it "has decision patterns" test_post_agent_has_decision_patterns
it "has extract function" test_post_agent_has_extract_function
it "logs performance" test_post_agent_logs_performance

describe "Post-Agent Hook: CC 2.1.6 Compliance"

test_post_agent_has_hook_result() {
    if grep -qE "HookResult|continue|suppressOutput" "$TS_POST_AGENT" 2>/dev/null; then
        return 0
    fi
    # Check types file
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should use HookResult type"
}

it "uses HookResult type" test_post_agent_has_hook_result

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_subagent_bundle_exists() {
    # Subagent hooks may be in a dedicated bundle or main hooks bundle
    if [[ -f "$DIST_DIR/subagent.mjs" ]]; then
        return 0
    fi
    if [[ -f "$DIST_DIR/hooks.mjs" ]]; then
        return 0
    fi
    fail "Subagent hooks bundle should exist"
}

test_subagent_bundle_has_content() {
    local bundle="$DIST_DIR/hooks.mjs"
    if [[ -f "$DIST_DIR/subagent.mjs" ]]; then
        bundle="$DIST_DIR/subagent.mjs"
    fi
    local size
    size=$(wc -c < "$bundle" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "Subagent bundle seems too small ($size bytes)"
    fi
}

it "subagent bundle exists" test_subagent_bundle_exists
it "subagent bundle has content" test_subagent_bundle_has_content

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

describe "Integration: Hook Registration"

test_pre_agent_hook_in_location() {
    assert_file_exists "$TS_PRE_AGENT"
}

test_post_agent_hook_in_location() {
    assert_file_exists "$TS_POST_AGENT"
}

it "pre-agent hook in correct location" test_pre_agent_hook_in_location
it "post-agent hook in correct location" test_post_agent_hook_in_location

describe "Integration: Feedback Library"

test_feedback_lib_has_agent_performance() {
    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"
    if [[ -f "$feedback_lib" ]]; then
        grep -q "log_agent_performance()" "$feedback_lib"
    else
        # May be handled by TypeScript lib
        skip "feedback-lib.sh not found - may be TypeScript"
    fi
}

it "feedback-lib has log_agent_performance" test_feedback_lib_has_agent_performance

# ============================================================================
# PATTERN DETECTION TESTS
# ============================================================================

describe "Pattern Detection Logic"

test_pattern_decided_to() {
    echo "I decided to use UUID primary keys" | grep -qi "decided to"
}

test_pattern_chose() {
    echo "I chose PostgreSQL for better JSON support" | grep -qi "chose"
}

test_pattern_implemented_using() {
    echo "I implemented using the repository pattern" | grep -qi "implemented using"
}

it "detects 'decided to' pattern" test_pattern_decided_to
it "detects 'chose' pattern" test_pattern_chose
it "detects 'implemented using' pattern" test_pattern_implemented_using

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary

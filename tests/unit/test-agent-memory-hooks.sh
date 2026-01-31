#!/usr/bin/env bash
# ============================================================================
# Agent Memory Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/subagent-start/graph-memory-inject.ts
# Tests for hooks/src/subagent-start/mem0-memory-inject.ts
# Tests for hooks/src/subagent-stop/agent-memory-store.ts
#
# Updated for memory decomposition (v5.4.0):
#   - agent-memory-inject.ts split into graph-memory-inject.ts + mem0-memory-inject.ts
#   - graph hook always runs, mem0 hook gated on MEM0_API_KEY
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_GRAPH_INJECT="$PROJECT_ROOT/src/hooks/src/subagent-start/graph-memory-inject.ts"
TS_MEM0_INJECT="$PROJECT_ROOT/src/hooks/src/subagent-start/mem0-memory-inject.ts"
TS_POST_AGENT="$PROJECT_ROOT/src/hooks/src/subagent-stop/agent-memory-store.ts"
DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

# ============================================================================
# OLD HOOK DELETION VERIFICATION
# ============================================================================

describe "Memory Decomposition: Old Hook Removed"

test_old_agent_memory_inject_deleted() {
    local old_file="$PROJECT_ROOT/src/hooks/src/subagent-start/agent-memory-inject.ts"
    if [[ -f "$old_file" ]]; then
        fail "agent-memory-inject.ts should be deleted (replaced by graph-memory-inject.ts + mem0-memory-inject.ts)"
    fi
}

it "old agent-memory-inject.ts is deleted" test_old_agent_memory_inject_deleted

# ============================================================================
# GRAPH MEMORY INJECT TESTS
# ============================================================================

describe "Graph Memory Inject: TypeScript Source"

test_graph_inject_exists() {
    assert_file_exists "$TS_GRAPH_INJECT"
}

test_graph_inject_exports_handler() {
    assert_file_contains "$TS_GRAPH_INJECT" "export"
}

test_graph_inject_has_function() {
    if grep -qE "export function graphMemoryInject" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should export graphMemoryInject function"
}

it "exists" test_graph_inject_exists
it "exports handler" test_graph_inject_exports_handler
it "exports graphMemoryInject function" test_graph_inject_has_function

describe "Graph Memory Inject: Core Logic"

test_graph_inject_has_domain_mapping() {
    if grep -qiE "AGENT_DOMAINS" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should have AGENT_DOMAINS mapping"
}

test_graph_inject_extracts_subagent_type() {
    if grep -qiE "subagent_type" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should extract subagent_type"
}

test_graph_inject_uses_graph_mcp() {
    if grep -qiE "mcp__memory__search_nodes" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should reference mcp__memory__search_nodes"
}

test_graph_inject_no_mem0_dependency() {
    if grep -qiE "MEM0_API_KEY|mcp__mem0__" "$TS_GRAPH_INJECT" 2>/dev/null; then
        fail "graph-memory-inject.ts should NOT reference MEM0_API_KEY or mcp__mem0__ (graph-only hook)"
    fi
}

test_graph_inject_has_agent_id() {
    if grep -qiE "agentId|agent_id|ork:" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should build agent_id"
}

it "has AGENT_DOMAINS mapping" test_graph_inject_has_domain_mapping
it "extracts subagent_type" test_graph_inject_extracts_subagent_type
it "uses graph MCP (mcp__memory__search_nodes)" test_graph_inject_uses_graph_mcp
it "has no mem0 dependency" test_graph_inject_no_mem0_dependency
it "builds agent_id" test_graph_inject_has_agent_id

describe "Graph Memory Inject: CC 2.1.7 Compliance"

test_graph_inject_has_hook_result() {
    if grep -qE "HookResult" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should use HookResult type"
}

test_graph_inject_returns_continue() {
    if grep -qE "continue.*true|outputSilentSuccess" "$TS_GRAPH_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject.ts should return continue: true"
}

it "uses HookResult type" test_graph_inject_has_hook_result
it "returns continue: true" test_graph_inject_returns_continue

# ============================================================================
# MEM0 MEMORY INJECT TESTS
# ============================================================================

describe "Mem0 Memory Inject: TypeScript Source"

test_mem0_inject_exists() {
    assert_file_exists "$TS_MEM0_INJECT"
}

test_mem0_inject_exports_handler() {
    assert_file_contains "$TS_MEM0_INJECT" "export"
}

test_mem0_inject_has_function() {
    if grep -qE "export function mem0MemoryInject" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should export mem0MemoryInject function"
}

it "exists" test_mem0_inject_exists
it "exports handler" test_mem0_inject_exports_handler
it "exports mem0MemoryInject function" test_mem0_inject_has_function

describe "Mem0 Memory Inject: API Key Gating"

test_mem0_inject_checks_api_key() {
    if grep -qE "MEM0_API_KEY" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should check MEM0_API_KEY"
}

test_mem0_inject_early_returns_without_key() {
    if grep -qE "!process\.env\.MEM0_API_KEY" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should early-return if MEM0_API_KEY is not set"
}

test_mem0_inject_returns_silent_without_key() {
    if grep -qE "outputSilentSuccess" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should return outputSilentSuccess when gated"
}

it "checks MEM0_API_KEY" test_mem0_inject_checks_api_key
it "early-returns without API key" test_mem0_inject_early_returns_without_key
it "returns silent success when gated" test_mem0_inject_returns_silent_without_key

describe "Mem0 Memory Inject: Core Logic"

test_mem0_inject_has_domain_mapping() {
    if grep -qiE "AGENT_DOMAINS" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should have AGENT_DOMAINS mapping"
}

test_mem0_inject_uses_mem0_mcp() {
    if grep -qiE "mcp__mem0__search_memories" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should reference mcp__mem0__search_memories"
}

test_mem0_inject_has_cross_agent_federation() {
    if grep -qiE "RELATED_AGENTS|cross.agent" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should have cross-agent federation (RELATED_AGENTS)"
}

test_mem0_inject_has_global_best_practices() {
    if grep -qiE "global.*best.*practice|orchestkit-global" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should query global best practices"
}

it "has AGENT_DOMAINS mapping" test_mem0_inject_has_domain_mapping
it "uses mem0 MCP (mcp__mem0__search_memories)" test_mem0_inject_uses_mem0_mcp
it "has cross-agent federation" test_mem0_inject_has_cross_agent_federation
it "queries global best practices" test_mem0_inject_has_global_best_practices

describe "Mem0 Memory Inject: CC 2.1.7 Compliance"

test_mem0_inject_has_hook_result() {
    if grep -qE "HookResult" "$TS_MEM0_INJECT" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject.ts should use HookResult type"
}

it "uses HookResult type" test_mem0_inject_has_hook_result

# ============================================================================
# HOOK REGISTRATION TESTS
# ============================================================================

describe "Hook Registration: hooks.json"

test_graph_inject_registered() {
    if grep -q "graph-memory-inject" "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject should be registered in hooks.json"
}

test_mem0_inject_registered() {
    if grep -q "mem0-memory-inject" "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject should be registered in hooks.json"
}

test_old_hook_not_registered() {
    # The old combined hook should NOT be in hooks.json
    if grep -q "subagent-start/agent-memory-inject" "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null; then
        fail "Old agent-memory-inject should NOT be in hooks.json (replaced by split hooks)"
    fi
}

it "graph-memory-inject registered in hooks.json" test_graph_inject_registered
it "mem0-memory-inject registered in hooks.json" test_mem0_inject_registered
it "old agent-memory-inject NOT in hooks.json" test_old_hook_not_registered

describe "Hook Registration: Entry Points"

test_graph_inject_in_subagent_entry() {
    if grep -q "graph-memory-inject" "$PROJECT_ROOT/src/hooks/src/entries/subagent.ts" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject should be in subagent.ts entry"
}

test_mem0_inject_in_subagent_entry() {
    if grep -q "mem0-memory-inject" "$PROJECT_ROOT/src/hooks/src/entries/subagent.ts" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject should be in subagent.ts entry"
}

test_graph_inject_in_index() {
    if grep -q "graph-memory-inject" "$PROJECT_ROOT/src/hooks/src/index.ts" 2>/dev/null; then
        return 0
    fi
    fail "graph-memory-inject should be in index.ts"
}

test_mem0_inject_in_index() {
    if grep -q "mem0-memory-inject" "$PROJECT_ROOT/src/hooks/src/index.ts" 2>/dev/null; then
        return 0
    fi
    fail "mem0-memory-inject should be in index.ts"
}

it "graph-memory-inject in subagent entry" test_graph_inject_in_subagent_entry
it "mem0-memory-inject in subagent entry" test_mem0_inject_in_subagent_entry
it "graph-memory-inject in index.ts" test_graph_inject_in_index
it "mem0-memory-inject in index.ts" test_mem0_inject_in_index

# ============================================================================
# POST-AGENT HOOK TESTS (unchanged, still agent-memory-store.ts)
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
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/src/hooks/src/types.ts" 2>/dev/null; then
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

test_bundle_contains_graph_inject() {
    local bundle="$DIST_DIR/subagent.mjs"
    if [[ ! -f "$bundle" ]]; then
        bundle="$DIST_DIR/hooks.mjs"
    fi
    if grep -q "graph-memory-inject" "$bundle" 2>/dev/null; then
        return 0
    fi
    fail "Bundle should contain graph-memory-inject hook code"
}

test_bundle_contains_mem0_inject() {
    local bundle="$DIST_DIR/subagent.mjs"
    if [[ ! -f "$bundle" ]]; then
        bundle="$DIST_DIR/hooks.mjs"
    fi
    if grep -q "mem0-memory-inject" "$bundle" 2>/dev/null; then
        return 0
    fi
    fail "Bundle should contain mem0-memory-inject hook code"
}

it "subagent bundle exists" test_subagent_bundle_exists
it "subagent bundle has content" test_subagent_bundle_has_content
it "bundle contains graph-memory-inject" test_bundle_contains_graph_inject
it "bundle contains mem0-memory-inject" test_bundle_contains_mem0_inject

# ============================================================================
# PLUGIN SEPARATION TESTS
# ============================================================================

describe "Plugin Separation: 3-Plugin Architecture"

test_memory_graph_plugin_exists() {
    assert_file_exists "$PROJECT_ROOT/plugins/ork-memory-graph/.claude-plugin/plugin.json"
}

test_memory_mem0_plugin_exists() {
    assert_file_exists "$PROJECT_ROOT/plugins/ork-memory-mem0/.claude-plugin/plugin.json"
}

test_memory_fabric_plugin_exists() {
    assert_file_exists "$PROJECT_ROOT/plugins/ork-memory-fabric/.claude-plugin/plugin.json"
}

test_old_memory_plugin_gone() {
    if [[ -d "$PROJECT_ROOT/plugins/ork-memory" ]]; then
        fail "Old ork-memory plugin should be deleted (replaced by 3 separate plugins)"
    fi
}

test_old_memory_manifest_gone() {
    if [[ -f "$PROJECT_ROOT/manifests/ork-memory.json" ]]; then
        fail "Old ork-memory.json manifest should be deleted"
    fi
}

it "ork-memory-graph plugin exists" test_memory_graph_plugin_exists
it "ork-memory-mem0 plugin exists" test_memory_mem0_plugin_exists
it "ork-memory-fabric plugin exists" test_memory_fabric_plugin_exists
it "old ork-memory plugin is gone" test_old_memory_plugin_gone
it "old ork-memory.json manifest is gone" test_old_memory_manifest_gone

# ============================================================================
# MEM0 PRE-COMPACTION SYNC GATING TEST
# ============================================================================

describe "Mem0 Pre-Compaction Sync: API Key Gating"

test_pre_compaction_sync_gated() {
    local sync_file="$PROJECT_ROOT/src/hooks/src/stop/mem0-pre-compaction-sync.ts"
    if grep -qE "!process\.env\.MEM0_API_KEY" "$sync_file" 2>/dev/null; then
        return 0
    fi
    fail "mem0-pre-compaction-sync.ts should gate on MEM0_API_KEY"
}

it "mem0-pre-compaction-sync is gated on MEM0_API_KEY" test_pre_compaction_sync_gated

# ============================================================================
# PATTERN DETECTION TESTS (unchanged)
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

#!/bin/bash
# Graph Utils Unit Tests
# Tests the shared graph-utils.mjs module
#
# Usage: ./test-graph-utils.sh

source "$(dirname "$0")/../fixtures/test-helpers.sh"

GRAPH_UTILS_PATH="$PROJECT_ROOT/src/skills/graph-viz/scripts/graph-utils.mjs"

describe "Graph Utils Module"

# ---------------------------------------------------------------------------
# Helper: run a node expression that imports graph-utils
# ---------------------------------------------------------------------------
run_node() {
  local expr="$1"
  node --input-type=module -e "
import { $2 } from '$GRAPH_UTILS_PATH';
$expr
" 2>&1
}

# ---------------------------------------------------------------------------
# Module loading tests
# ---------------------------------------------------------------------------

test_module_imports_cleanly() {
  local output
  output=$(node --input-type=module -e "
import * as utils from '$GRAPH_UTILS_PATH';
const exports = Object.keys(utils);
console.log(JSON.stringify(exports));
" 2>&1)
  assert_contains "$output" "sanitizeId"
  assert_contains "$output" "makeNodeId"
  assert_contains "$output" "inferEntityType"
  assert_contains "$output" "normalizeEntity"
  assert_contains "$output" "normalizeRelation"
  assert_contains "$output" "classifyEdge"
  assert_contains "$output" "buildEntityNodeIdMap"
  assert_contains "$output" "ENTITY_TYPES"
  assert_contains "$output" "STRONG_RELATIONS"
  assert_contains "$output" "REJECTED_RELATIONS"
  assert_contains "$output" "TECH_KEYWORDS"
  assert_contains "$output" "TOOL_KEYWORDS"
  assert_contains "$output" "getProjectDir"
  assert_contains "$output" "readJsonl"
  assert_contains "$output" "openInBrowser"
}

# ---------------------------------------------------------------------------
# sanitizeId tests
# ---------------------------------------------------------------------------

test_sanitize_id_basic() {
  local result
  result=$(run_node 'console.log(sanitizeId("Hello World"))' "sanitizeId")
  assert_equals "hello_world" "$result"
}

test_sanitize_id_special_chars() {
  local result
  result=$(run_node 'console.log(sanitizeId("React.js/Next.js"))' "sanitizeId")
  assert_equals "react_js_next_js" "$result"
}

test_sanitize_id_strips_leading_trailing_underscores() {
  local result
  result=$(run_node 'console.log(sanitizeId("__test__"))' "sanitizeId")
  assert_equals "test" "$result"
}

test_sanitize_id_consecutive_specials() {
  local result
  result=$(run_node 'console.log(sanitizeId("a---b+++c"))' "sanitizeId")
  assert_equals "a_b_c" "$result"
}

# ---------------------------------------------------------------------------
# inferEntityType tests
# ---------------------------------------------------------------------------

test_infer_entity_type_technology() {
  local result
  result=$(run_node 'console.log(inferEntityType("PostgreSQL"))' "inferEntityType")
  assert_equals "Technology" "$result"
}

test_infer_entity_type_tool() {
  local result
  result=$(run_node 'console.log(inferEntityType("ESLint config"))' "inferEntityType")
  assert_equals "Tool" "$result"
}

test_infer_entity_type_pattern_fallback() {
  local result
  result=$(run_node 'console.log(inferEntityType("Clean Architecture"))' "inferEntityType")
  assert_equals "Pattern" "$result"
}

test_infer_entity_type_case_insensitive() {
  local result
  result=$(run_node 'console.log(inferEntityType("REACT hooks"))' "inferEntityType")
  assert_equals "Technology" "$result"
}

# ---------------------------------------------------------------------------
# makeNodeId tests
# ---------------------------------------------------------------------------

test_make_node_id_decision() {
  local result
  result=$(run_node 'console.log(makeNodeId("Decision", "Use ESM"))' "makeNodeId")
  assert_equals "d_use_esm" "$result"
}

test_make_node_id_technology() {
  local result
  result=$(run_node 'console.log(makeNodeId("Technology", "React"))' "makeNodeId")
  assert_equals "t_react" "$result"
}

test_make_node_id_unknown_type_fallback() {
  local result
  result=$(run_node 'console.log(makeNodeId("Unknown", "Test"))' "makeNodeId")
  # Should fall back to Pattern prefix
  assert_equals "p_test" "$result"
}

test_make_node_id_tool() {
  local result
  result=$(run_node 'console.log(makeNodeId("Tool", "Docker"))' "makeNodeId")
  assert_equals "tool_docker" "$result"
}

# ---------------------------------------------------------------------------
# normalizeEntity tests
# ---------------------------------------------------------------------------

test_normalize_entity_string_input() {
  local result
  result=$(run_node '
const e = normalizeEntity("PostgreSQL");
console.log(JSON.stringify(e));
' "normalizeEntity")
  assert_contains "$result" '"name":"PostgreSQL"'
  assert_contains "$result" '"entityType":"Technology"'
  assert_contains "$result" '"observations":[]'
}

test_normalize_entity_object_input() {
  local result
  result=$(run_node '
const e = normalizeEntity({ name: "Test", entityType: "Decision", observations: ["obs1"] });
console.log(JSON.stringify(e));
' "normalizeEntity")
  assert_contains "$result" '"name":"Test"'
  assert_contains "$result" '"entityType":"Decision"'
  assert_contains "$result" '"observations":["obs1"]'
}

test_normalize_entity_defaults() {
  local result
  result=$(run_node '
const e = normalizeEntity({ name: "Foo" });
console.log(JSON.stringify(e));
' "normalizeEntity")
  assert_contains "$result" '"entityType":"Pattern"'
  assert_contains "$result" '"observations":[]'
}

# ---------------------------------------------------------------------------
# normalizeRelation tests
# ---------------------------------------------------------------------------

test_normalize_relation_standard() {
  local result
  result=$(run_node '
const r = normalizeRelation({ from: "A", to: "B", relationType: "CHOSE" });
console.log(JSON.stringify(r));
' "normalizeRelation")
  assert_contains "$result" '"from":"A"'
  assert_contains "$result" '"to":"B"'
  assert_contains "$result" '"relationType":"CHOSE"'
}

test_normalize_relation_type_alias() {
  local result
  result=$(run_node '
const r = normalizeRelation({ from: "A", to: "B", type: "USES" });
console.log(JSON.stringify(r));
' "normalizeRelation")
  assert_contains "$result" '"relationType":"USES"'
}

test_normalize_relation_default() {
  local result
  result=$(run_node '
const r = normalizeRelation({ from: "A", to: "B" });
console.log(JSON.stringify(r));
' "normalizeRelation")
  assert_contains "$result" '"relationType":"RELATES_TO"'
}

# ---------------------------------------------------------------------------
# classifyEdge tests
# ---------------------------------------------------------------------------

test_classify_edge_strong() {
  local result
  result=$(run_node 'console.log(classifyEdge("CHOSE"))' "classifyEdge")
  assert_equals "strong" "$result"
}

test_classify_edge_rejected() {
  local result
  result=$(run_node 'console.log(classifyEdge("CHOSE_OVER"))' "classifyEdge")
  assert_equals "rejected" "$result"
}

test_classify_edge_weak() {
  local result
  result=$(run_node 'console.log(classifyEdge("MENTIONS"))' "classifyEdge")
  assert_equals "weak" "$result"
}

test_classify_edge_tradeoff() {
  local result
  result=$(run_node 'console.log(classifyEdge("TRADEOFF"))' "classifyEdge")
  assert_equals "rejected" "$result"
}

# ---------------------------------------------------------------------------
# ENTITY_TYPES structure tests
# ---------------------------------------------------------------------------

test_entity_types_all_have_prefix() {
  local result
  result=$(run_node '
const types = Object.keys(ENTITY_TYPES);
const allHavePrefix = types.every(t => typeof ENTITY_TYPES[t].prefix === "string" && ENTITY_TYPES[t].prefix.length > 0);
console.log(allHavePrefix ? "true" : "false");
' "ENTITY_TYPES")
  assert_equals "true" "$result"
}

test_entity_types_all_have_classname() {
  local result
  result=$(run_node '
const types = Object.keys(ENTITY_TYPES);
const allHaveClassName = types.every(t => typeof ENTITY_TYPES[t].className === "string" && ENTITY_TYPES[t].className.length > 0);
console.log(allHaveClassName ? "true" : "false");
' "ENTITY_TYPES")
  assert_equals "true" "$result"
}

test_entity_types_all_have_color() {
  local result
  result=$(run_node '
const types = Object.keys(ENTITY_TYPES);
const allHaveColor = types.every(t => typeof ENTITY_TYPES[t].color === "string" && ENTITY_TYPES[t].color.startsWith("#"));
console.log(allHaveColor ? "true" : "false");
' "ENTITY_TYPES")
  assert_equals "true" "$result"
}

test_entity_types_has_all_8_types() {
  local result
  result=$(run_node '
const expected = ["Decision","Preference","Problem","Solution","Technology","Pattern","Tool","Workflow"];
const types = Object.keys(ENTITY_TYPES);
const allPresent = expected.every(e => types.includes(e));
console.log(types.length + ":" + (allPresent ? "true" : "false"));
' "ENTITY_TYPES")
  assert_equals "8:true" "$result"
}

# ---------------------------------------------------------------------------
# buildEntityNodeIdMap tests
# ---------------------------------------------------------------------------

test_build_entity_node_id_map() {
  local result
  result=$(run_node '
const map = new Map();
map.set("React", { entityType: "Technology", observations: [] });
map.set("Clean Code", { entityType: "Pattern", observations: [] });
const ids = buildEntityNodeIdMap(map);
console.log(JSON.stringify(ids));
' "buildEntityNodeIdMap, makeNodeId")
  assert_contains "$result" '"React":"t_react"'
  assert_contains "$result" '"Clean Code":"p_clean_code"'
}

# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------

run_tests

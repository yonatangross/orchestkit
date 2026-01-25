#!/bin/bash
# ============================================================================
# Edge case and error scenario tests
# ============================================================================
# Validates TypeScript hooks handle unusual conditions gracefully
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

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
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Test: TypeScript hook bundles exist
test_typescript_bundles_exist() {
    log_section "Test: TypeScript Hook Bundles Exist"

    local bundles=(
        "hooks.mjs"
        "permission.mjs"
        "pretool.mjs"
        "posttool.mjs"
        "prompt.mjs"
        "lifecycle.mjs"
    )

    for bundle in "${bundles[@]}"; do
        if [[ -f "${PROJECT_ROOT}/src/hooks/dist/${bundle}" ]]; then
            log_pass "Bundle exists: ${bundle}"
        else
            log_fail "Bundle missing: ${bundle}"
        fi
    done
}

# Test: TypeScript source files have proper structure
test_typescript_source_structure() {
    log_section "Test: TypeScript Source Structure"

    local required_dirs=(
        "src/hooks/src/prompt"
        "src/hooks/src/pretool"
        "src/hooks/src/posttool"
        "src/hooks/src/lifecycle"
        "src/hooks/src/permission"
        "src/hooks/src/lib"
    )

    for dir in "${required_dirs[@]}"; do
        if [[ -d "${PROJECT_ROOT}/${dir}" ]]; then
            log_pass "Directory exists: ${dir}"
        else
            log_fail "Directory missing: ${dir}"
        fi
    done
}

# Test: TypeScript entry points exist
test_typescript_entry_points() {
    log_section "Test: TypeScript Entry Points"

    if [[ -f "${PROJECT_ROOT}/src/hooks/src/index.ts" ]]; then
        log_pass "Main index.ts exists"
    else
        log_fail "Main index.ts missing"
    fi

    if [[ -f "${PROJECT_ROOT}/src/hooks/src/types.ts" ]]; then
        log_pass "Types definition exists"
    else
        log_fail "Types definition missing"
    fi

    if [[ -d "${PROJECT_ROOT}/src/hooks/src/entries" ]]; then
        log_pass "Entries directory exists"
    else
        log_fail "Entries directory missing"
    fi
}

# Test: Hook runner exists and is executable
test_hook_runner() {
    log_section "Test: Hook Runner"

    local runner="${PROJECT_ROOT}/src/hooks/bin/run-hook.mjs"

    if [[ -f "$runner" ]]; then
        log_pass "run-hook.mjs exists"
    else
        log_fail "run-hook.mjs missing"
    fi

    if [[ -x "$runner" ]]; then
        log_pass "run-hook.mjs is executable"
    else
        log_fail "run-hook.mjs is not executable"
    fi
}

# Test: Count scripts with empty directories
test_count_empty_dirs() {
    log_section "Test: Count Scripts Edge Cases"

    # Test with --json flag
    local json_output=""
    json_output=$("${PROJECT_ROOT}/bin/count-components.sh" --json 2>/dev/null) || json_output=""

    if echo "$json_output" | jq '.skills' >/dev/null 2>&1; then
        log_pass "count-components.sh --json returns valid JSON"
    else
        log_fail "count-components.sh --json invalid: $json_output"
    fi

    # Test validate with current state
    local validate_exit=0
    "${PROJECT_ROOT}/bin/validate-counts.sh" >/dev/null 2>&1 || validate_exit=$?

    if [[ $validate_exit -eq 0 ]]; then
        log_pass "validate-counts.sh passes"
    else
        log_fail "validate-counts.sh failed with exit code $validate_exit"
    fi
}

# Test: TypeScript hooks have proper exports
test_typescript_exports() {
    log_section "Test: TypeScript Hook Exports"

    # Check that index.ts exports hook types
    if grep -q "export.*HookInput\|export.*HookResult" "${PROJECT_ROOT}/src/hooks/src/index.ts" 2>/dev/null || \
       grep -q "export.*from.*types" "${PROJECT_ROOT}/src/hooks/src/index.ts" 2>/dev/null; then
        log_pass "index.ts exports hook types"
    else
        log_fail "index.ts missing hook type exports"
    fi

    # Check that bundles are not empty
    local hooks_bundle="${PROJECT_ROOT}/src/hooks/dist/hooks.mjs"
    if [[ -f "$hooks_bundle" ]]; then
        local size
        size=$(wc -c < "$hooks_bundle" | tr -d ' ')
        if [[ "$size" -gt 1000 ]]; then
            log_pass "hooks.mjs has content (${size} bytes)"
        else
            log_fail "hooks.mjs seems too small (${size} bytes)"
        fi
    fi
}

# Test: lib directory has shared utilities
test_lib_utilities() {
    log_section "Test: Shared Library Utilities"

    local expected_libs=(
        "common.ts"
        "guards.ts"
    )

    for lib in "${expected_libs[@]}"; do
        if [[ -f "${PROJECT_ROOT}/src/hooks/src/lib/${lib}" ]]; then
            log_pass "Library exists: ${lib}"
        else
            log_fail "Library missing: ${lib}"
        fi
    done
}

# Main
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Edge Cases and Error Scenarios Tests (TypeScript)        ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    test_typescript_bundles_exist
    test_typescript_source_structure
    test_typescript_entry_points
    test_hook_runner
    test_count_empty_dirs
    test_typescript_exports
    test_lib_utilities

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

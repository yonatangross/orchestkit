#!/usr/bin/env bash
# Test suite for memory sync subcommand (formerly mem0-sync skill)
# Validates skill structure and hook integration
#
# Part of Mem0 Pro Integration - Auto-Sync Feature
# NOTE: mem0-sync has been consolidated into the memory skill as 'memory sync'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Set up environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

assert_file_exists() {
    local file="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -f "$file" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Missing: $file"
        return 1
    fi
}

assert_dir_exists() {
    local dir="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -d "$dir" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Missing directory: $dir"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$haystack" == *"$needle"* ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Missing: '$needle'"
        return 1
    fi
}

assert_json_valid() {
    local json="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$json" | jq -e '.' >/dev/null 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Invalid JSON"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: Skill Directory Structure
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing memory sync (formerly mem0-sync)"
echo "=========================================="

SKILL_DIR="$PROJECT_ROOT/src/skills/memory"

assert_dir_exists "$SKILL_DIR" "memory skill directory exists"
assert_file_exists "$SKILL_DIR/SKILL.md" "SKILL.md exists"

# Check that the memory skill documents sync subcommand
TESTS_RUN=$((TESTS_RUN + 1))
if grep -qi "sync" "$SKILL_DIR/SKILL.md" 2>/dev/null; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: memory SKILL.md contains sync subcommand"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: memory SKILL.md should document sync subcommand"
fi

# Check references directory for sync-related content
assert_dir_exists "$SKILL_DIR/references" "references/ directory exists"

# -----------------------------------------------------------------------------
# Test: Reference Files
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Reference Files"
echo "=========================================="

# References are now under memory skill directory
# Check that memory references directory has content
TESTS_RUN=$((TESTS_RUN + 1))
if ls "$SKILL_DIR/references/"*.md >/dev/null 2>&1; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: memory/references/ has markdown files"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: memory/references/ should have reference files"
fi

# -----------------------------------------------------------------------------
# Test: Template File
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Memory Skill Structure"
echo "=========================================="

# Verify the memory skill has scripts (migrated from graph-viz)
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -d "$SKILL_DIR/scripts" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: memory/scripts/ directory exists"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: memory/scripts/ directory should exist (graph-viz migration)"
fi

# -----------------------------------------------------------------------------
# Test: Hook Integration (mem0-pre-compaction-sync.sh)
# Stop hooks only support: continue, suppressOutput, stopReason, systemMessage
# (No hookSpecificOutput for Stop events - v1.5.0 compliance)
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Hook Integration"
echo "=========================================="

HOOK="$PROJECT_ROOT/src/hooks/src/stop/mem0-pre-compaction-sync.ts"

# Test hook file exists
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -f "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.ts exists"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.ts should exist"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total tests: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}SOME TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
fi

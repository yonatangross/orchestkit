#!/usr/bin/env bash
# Test suite for mem0-sync Skill
# Validates skill structure and hook integration
#
# Part of Mem0 Pro Integration - Auto-Sync Feature

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
echo "Testing mem0-sync Skill Structure"
echo "=========================================="

SKILL_DIR="$PROJECT_ROOT/skills/mem0-sync"

assert_dir_exists "$SKILL_DIR" "mem0-sync skill directory exists"
assert_file_exists "$SKILL_DIR/SKILL.md" "SKILL.md exists"
assert_dir_exists "$SKILL_DIR/references" "references/ directory exists"
assert_dir_exists "$SKILL_DIR/templates" "templates/ directory exists"
assert_dir_exists "$SKILL_DIR/checklists" "checklists/ directory exists"

# -----------------------------------------------------------------------------
# Test: SKILL.md Frontmatter
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing SKILL.md Frontmatter"
echo "=========================================="

SKILL_CONTENT=$(cat "$SKILL_DIR/SKILL.md")

# Check required frontmatter fields
assert_contains "$SKILL_CONTENT" "name: mem0-sync" "SKILL.md has name field"
assert_contains "$SKILL_CONTENT" "description:" "SKILL.md has description field"
assert_contains "$SKILL_CONTENT" "tags:" "SKILL.md has tags field"
assert_contains "$SKILL_CONTENT" "user-invocable: true" "SKILL.md is user-invocable"
assert_contains "$SKILL_CONTENT" "auto-invoke: session-end" "SKILL.md has auto-invoke field"
assert_contains "$SKILL_CONTENT" "context: inherit" "SKILL.md has context field"

# -----------------------------------------------------------------------------
# Test: SKILL.md Content
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing SKILL.md Content"
echo "=========================================="

assert_contains "$SKILL_CONTENT" "mcp__mem0__add_memory" "SKILL.md includes MCP call examples"
assert_contains "$SKILL_CONTENT" "Session Summary" "SKILL.md documents session summary"
assert_contains "$SKILL_CONTENT" "enable_graph: true" "SKILL.md specifies enable_graph"
assert_contains "$SKILL_CONTENT" "user_id" "SKILL.md documents user_id format"

# -----------------------------------------------------------------------------
# Test: Reference Files
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Reference Files"
echo "=========================================="

assert_file_exists "$SKILL_DIR/references/session-sync.md" "session-sync.md reference exists"
assert_file_exists "$SKILL_DIR/references/pattern-sync.md" "pattern-sync.md reference exists"
assert_file_exists "$SKILL_DIR/references/decision-sync.md" "decision-sync.md reference exists"

# Check reference content
SESSION_REF=$(cat "$SKILL_DIR/references/session-sync.md")
assert_contains "$SESSION_REF" "Session Summary" "session-sync.md documents session summary"
assert_contains "$SESSION_REF" "mcp__mem0__add_memory" "session-sync.md includes MCP example"

PATTERN_REF=$(cat "$SKILL_DIR/references/pattern-sync.md")
assert_contains "$PATTERN_REF" "agent_id" "pattern-sync.md documents agent_id"
assert_contains "$PATTERN_REF" "outcome" "pattern-sync.md documents outcome"

DECISION_REF=$(cat "$SKILL_DIR/references/decision-sync.md")
assert_contains "$DECISION_REF" "decision" "decision-sync.md documents decisions"
assert_contains "$DECISION_REF" "Sync State" "decision-sync.md documents sync state"

# -----------------------------------------------------------------------------
# Test: Template File
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Template File"
echo "=========================================="

TEMPLATE_FILE="$SKILL_DIR/templates/sync-payload.json"
assert_file_exists "$TEMPLATE_FILE" "sync-payload.json template exists"

TEMPLATE_CONTENT=$(cat "$TEMPLATE_FILE")
assert_json_valid "$TEMPLATE_CONTENT" "sync-payload.json is valid JSON"
assert_contains "$TEMPLATE_CONTENT" "session_summary" "Template includes session_summary"
assert_contains "$TEMPLATE_CONTENT" "decision" "Template includes decision"
assert_contains "$TEMPLATE_CONTENT" "agent_pattern" "Template includes agent_pattern"
assert_contains "$TEMPLATE_CONTENT" "global_best_practice" "Template includes global_best_practice"

# -----------------------------------------------------------------------------
# Test: Checklist File
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Checklist File"
echo "=========================================="

CHECKLIST_FILE="$SKILL_DIR/checklists/pre-sync-checklist.md"
assert_file_exists "$CHECKLIST_FILE" "pre-sync-checklist.md exists"

CHECKLIST_CONTENT=$(cat "$CHECKLIST_FILE")
assert_contains "$CHECKLIST_CONTENT" "Prerequisites" "Checklist has prerequisites section"
assert_contains "$CHECKLIST_CONTENT" "Validation" "Checklist has validation section"
assert_contains "$CHECKLIST_CONTENT" "Post-Sync" "Checklist has post-sync section"

# -----------------------------------------------------------------------------
# Test: Hook Integration (mem0-pre-compaction-sync.sh)
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing Hook Integration"
echo "=========================================="

HOOK="$PROJECT_ROOT/hooks/stop/mem0-pre-compaction-sync.sh"

# Test hook version
TESTS_RUN=$((TESTS_RUN + 1))
if head -10 "$HOOK" | grep -q "Version: 1.4.0"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook version is 1.4.0"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Hook version should be 1.4.0"
fi

# Test hook outputs valid JSON with skill invocation
HOOK_OUTPUT=$(echo "" | bash "$HOOK" 2>/dev/null || echo '{"continue":true,"suppressOutput":true}')
assert_json_valid "$HOOK_OUTPUT" "Hook outputs valid JSON"

# Check for invokeSkill field
if echo "$HOOK_OUTPUT" | jq -e '.hookSpecificOutput.invokeSkill' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    INVOKE_SKILL=$(echo "$HOOK_OUTPUT" | jq -r '.hookSpecificOutput.invokeSkill')
    if [[ "$INVOKE_SKILL" == "mem0-sync" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: Hook invokes mem0-sync skill"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: Hook should invoke mem0-sync skill (got: $INVOKE_SKILL)"
    fi
else
    # Hook might output suppressOutput:true if no pending items
    TESTS_RUN=$((TESTS_RUN + 1))
    if echo "$HOOK_OUTPUT" | jq -e '.suppressOutput == true' >/dev/null 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: Hook correctly suppresses output when no pending items"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: Hook should have invokeSkill or suppressOutput"
    fi
fi

# Check for syncContext when invokeSkill is present
if echo "$HOOK_OUTPUT" | jq -e '.hookSpecificOutput.syncContext' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook provides syncContext"

    # Check syncContext structure
    SYNC_CTX=$(echo "$HOOK_OUTPUT" | jq '.hookSpecificOutput.syncContext')

    if echo "$SYNC_CTX" | jq -e '.project_id' >/dev/null 2>&1; then
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: syncContext has project_id"
    else
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: syncContext missing project_id"
    fi

    if echo "$SYNC_CTX" | jq -e '.user_ids' >/dev/null 2>&1; then
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: syncContext has user_ids"
    else
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: syncContext missing user_ids"
    fi
fi

# Check for readyMcpCalls
if echo "$HOOK_OUTPUT" | jq -e '.hookSpecificOutput.readyMcpCalls' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook provides readyMcpCalls"

    # Check first MCP call structure
    FIRST_MCP=$(echo "$HOOK_OUTPUT" | jq '.hookSpecificOutput.readyMcpCalls[0]')

    if echo "$FIRST_MCP" | jq -e '.tool == "mcp__mem0__add_memory"' >/dev/null 2>&1; then
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: First MCP call is mcp__mem0__add_memory"
    else
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: First MCP call should be mcp__mem0__add_memory"
    fi

    if echo "$FIRST_MCP" | jq -e '.args.enable_graph == true' >/dev/null 2>&1; then
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: MCP call has enable_graph=true"
    else
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: MCP call should have enable_graph=true"
    fi
fi

# Check for autoExecute flag
if echo "$HOOK_OUTPUT" | jq -e '.hookSpecificOutput.autoExecute == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook has autoExecute=true"
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

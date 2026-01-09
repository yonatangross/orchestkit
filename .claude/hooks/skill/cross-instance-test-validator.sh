#!/bin/bash
# =============================================================================
# cross-instance-test-validator.sh
# BLOCKING: Ensure test coverage when code is split across instances
# =============================================================================
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only validate implementation files (not tests)
IS_TEST_FILE=false
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || [[ "$FILE_PATH" =~ test_.*\.py$ ]]; then
    IS_TEST_FILE=true
fi

# Skip test files and non-code files
if [[ "$IS_TEST_FILE" == "true" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|py)$ ]]; then
    exit 0
fi

ERRORS=()
WARNINGS=()

# =============================================================================
# 1. FIND CORRESPONDING TEST FILE
# =============================================================================

find_test_file() {
    local impl_file="$1"
    local test_file=""
    
    if [[ "$impl_file" =~ \.(ts|tsx|js|jsx)$ ]]; then
        # TypeScript/JavaScript test patterns
        # Try .test.ts, .test.tsx, .spec.ts, etc.
        local base="${impl_file%.*}"
        local ext="${impl_file##*.}"
        
        # Check common patterns
        for pattern in ".test.$ext" ".spec.$ext" ".test.ts" ".test.tsx"; do
            if [[ -f "${base}${pattern}" ]]; then
                test_file="${base}${pattern}"
                break
            fi
        done
        
        # Check __tests__ directory
        if [[ -z "$test_file" ]]; then
            local dir=$(dirname "$impl_file")
            local filename=$(basename "$impl_file")
            local base_filename="${filename%.*}"
            
            for pattern in "$dir/__tests__/${base_filename}.test.$ext" \
                           "$dir/__tests__/${base_filename}.spec.$ext" \
                           "$dir/__tests__/${filename}"; do
                if [[ -f "$pattern" ]]; then
                    test_file="$pattern"
                    break
                fi
            done
        fi
        
    elif [[ "$impl_file" =~ \.py$ ]]; then
        # Python test patterns
        local dir=$(dirname "$impl_file")
        local filename=$(basename "$impl_file")
        
        # Try test_*.py pattern
        local test_filename="test_${filename}"
        if [[ -f "$dir/$test_filename" ]]; then
            test_file="$dir/$test_filename"
        fi
        
        # Try tests/ directory
        if [[ -z "$test_file" ]]; then
            local parent_dir=$(dirname "$dir")
            if [[ -f "$parent_dir/tests/$test_filename" ]]; then
                test_file="$parent_dir/tests/$test_filename"
            elif [[ -f "$dir/tests/$test_filename" ]]; then
                test_file="$dir/tests/$test_filename"
            fi
        fi
    fi
    
    echo "$test_file"
}

TEST_FILE=$(find_test_file "$FILE_PATH")

# =============================================================================
# 2. EXTRACT TESTABLE UNITS (Functions/Classes/Methods)
# =============================================================================

extract_testable_units() {
    local content="$1"
    local file_path="$2"
    
    if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
        # TypeScript/JavaScript: Extract exported functions and classes
        echo "$content" | grep -oE "export (function|class|const|async function)\s+[A-Za-z_][A-Za-z0-9_]*" | \
            awk '{print $NF}' | sort -u
    elif [[ "$file_path" =~ \.py$ ]]; then
        # Python: Extract public functions and classes (not starting with _)
        echo "$content" | grep -oE "^(def|class)\s+[A-Za-z][A-Za-z0-9_]*" | \
            awk '{print $NF}' | sort -u
    fi
}

TESTABLE_UNITS=$(extract_testable_units "$CONTENT" "$FILE_PATH")

# =============================================================================
# 3. CHECK TEST COVERAGE FOR NEW CODE
# =============================================================================

if [[ -n "$TESTABLE_UNITS" ]]; then
    UNIT_COUNT=$(echo "$TESTABLE_UNITS" | wc -l | tr -d ' ')
    
    if [[ -z "$TEST_FILE" ]]; then
        ERRORS+=("TEST COVERAGE: No test file found for implementation")
        ERRORS+=("  Implementation: $FILE_PATH")
        ERRORS+=("  Expected test file:")
        
        if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
            BASE="${FILE_PATH%.*}"
            EXT="${FILE_PATH##*.}"
            ERRORS+=("    - ${BASE}.test.${EXT}")
            ERRORS+=("    - $(dirname "$FILE_PATH")/__tests__/$(basename "$FILE_PATH")")
        elif [[ "$FILE_PATH" =~ \.py$ ]]; then
            FILENAME=$(basename "$FILE_PATH")
            ERRORS+=("    - $(dirname "$FILE_PATH")/test_${FILENAME}")
            ERRORS+=("    - $(dirname "$(dirname "$FILE_PATH")")/tests/test_${FILENAME}")
        fi
        
        ERRORS+=("")
        ERRORS+=("  Found $UNIT_COUNT testable units:")
        while IFS= read -r unit; do
            [[ -z "$unit" ]] && continue
            ERRORS+=("    - $unit")
        done <<< "$TESTABLE_UNITS"
        
    else
        # Test file exists - check if new units are tested
        TEST_CONTENT=$(cat "$TEST_FILE" 2>/dev/null || echo "")
        UNTESTED_UNITS=()
        
        while IFS= read -r unit; do
            [[ -z "$unit" ]] && continue
            
            # Check if unit is mentioned in test file
            if ! echo "$TEST_CONTENT" | grep -qE "\b$unit\b" 2>/dev/null; then
                UNTESTED_UNITS+=("$unit")
            fi
        done <<< "$TESTABLE_UNITS"
        
        if [[ ${#UNTESTED_UNITS[@]} -gt 0 ]]; then
            WARNINGS+=("TEST COVERAGE: New units without tests")
            WARNINGS+=("  Implementation: $FILE_PATH")
            WARNINGS+=("  Test file: $TEST_FILE")
            WARNINGS+=("")
            WARNINGS+=("  Untested units (${#UNTESTED_UNITS[@]}/$UNIT_COUNT):")
            for unit in "${UNTESTED_UNITS[@]}"; do
                WARNINGS+=("    - $unit")
            done
            WARNINGS+=("")
            WARNINGS+=("  Add tests before committing")
        fi
    fi
fi

# =============================================================================
# 4. CHECK FOR SPLIT IMPLEMENTATION ACROSS WORKTREES
# =============================================================================

# If this file implements an interface or extends a base class,
# check if tests exist in other worktrees

if git worktree list >/dev/null 2>&1; then
    WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)
    
    if [[ -n "$WORKTREES" ]]; then
        # Check if this file implements/extends something
        IMPLEMENTS=""
        EXTENDS=""
        
        if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
            IMPLEMENTS=$(echo "$CONTENT" | grep -oE "implements\s+[A-Za-z_][A-Za-z0-9_]*" | awk '{print $2}' | head -1)
            EXTENDS=$(echo "$CONTENT" | grep -oE "extends\s+[A-Za-z_][A-Za-z0-9_]*" | awk '{print $2}' | head -1)
        elif [[ "$FILE_PATH" =~ \.py$ ]]; then
            EXTENDS=$(echo "$CONTENT" | grep -oE "class\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)" | \
                grep -oE "\([^)]*\)" | tr -d '()' | awk '{print $1}' | head -1)
        fi
        
        if [[ -n "$IMPLEMENTS" || -n "$EXTENDS" ]]; then
            BASE_TYPE="${IMPLEMENTS:-$EXTENDS}"
            
            # Check if base type has tests in other worktrees
            REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
            if [[ -n "$REPO_ROOT" ]]; then
                while IFS= read -r worktree; do
                    [[ -z "$worktree" ]] && continue
                    
                    # Search for tests of base type
                    BASE_TESTS=$(find "$worktree" -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*.py" \) \
                        -exec grep -l "$BASE_TYPE" {} \; 2>/dev/null | head -3 || true)
                    
                    if [[ -n "$BASE_TESTS" ]]; then
                        WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                        WARNINGS+=("SPLIT IMPLEMENTATION: Tests for base type exist in other worktree")
                        WARNINGS+=("  Base type: $BASE_TYPE")
                        WARNINGS+=("  Worktree branch: $WORKTREE_BRANCH")
                        WARNINGS+=("  Test files:")
                        while IFS= read -r test_file; do
                            REL_TEST=$(realpath --relative-to="$worktree" "$test_file" 2>/dev/null || echo "$test_file")
                            WARNINGS+=("    - $REL_TEST")
                        done <<< "$BASE_TESTS"
                        WARNINGS+=("  Ensure test coverage is coordinated across branches")
                        WARNINGS+=("")
                        break
                    fi
                done <<< "$WORKTREES"
            fi
        fi
    fi
fi

# =============================================================================
# 5. CHECK FOR INTEGRATION TEST NEEDS
# =============================================================================

# Check if this code has dependencies that span multiple worktrees
check_integration_needs() {
    local content="$1"
    local file_path="$2"
    
    # Check for cross-boundary calls
    CROSS_BOUNDARY=false
    
    if [[ "$file_path" =~ /routers/ ]] && echo "$content" | grep -qE "from.*services.*import" 2>/dev/null; then
        CROSS_BOUNDARY=true
    fi
    
    if [[ "$file_path" =~ /services/ ]] && echo "$content" | grep -qE "from.*repositories.*import" 2>/dev/null; then
        CROSS_BOUNDARY=true
    fi
    
    if [[ "$CROSS_BOUNDARY" == "true" ]]; then
        # Check if integration tests exist
        REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
        if [[ -n "$REPO_ROOT" ]]; then
            INTEGRATION_TESTS=$(find "$REPO_ROOT" -type f \( -name "*integration*.test.*" -o -name "*integration*.spec.*" -o -name "test_*integration*.py" \) 2>/dev/null | head -1)
            
            if [[ -z "$INTEGRATION_TESTS" ]]; then
                WARNINGS+=("INTEGRATION TESTS: Cross-layer calls detected")
                WARNINGS+=("  File: $file_path")
                WARNINGS+=("  Recommendation: Add integration tests for end-to-end flows")
                WARNINGS+=("  Especially important in multi-instance development")
                WARNINGS+=("")
            fi
        fi
    fi
}

check_integration_needs "$CONTENT" "$FILE_PATH"

# =============================================================================
# 6. REPORT FINDINGS
# =============================================================================

# Block on missing tests for new code
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "❌ BLOCKED: Missing test coverage" >&2
    echo "" >&2
    echo "Critical Issues:" >&2
    for error in "${ERRORS[@]}"; do
        echo "  $error" >&2
    done
    echo "" >&2
    echo "Add tests before committing to ensure quality across all instances" >&2
    exit 1
fi

# Warn about test gaps
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  WARNING: Test coverage issues detected" >&2
    echo "" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning" >&2
    done
    echo "" >&2
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Cross-instance tests validated","continue":true}'
exit 0

#!/bin/bash
# analyze-codebase.sh - Gather metrics for complexity assessment
# Usage: ./analyze-codebase.sh [target-path]

set -e

TARGET="${1:-.}"

# Resolve to absolute path
if [[ "$TARGET" != /* ]]; then
    TARGET="$(pwd)/$TARGET"
fi

# Check if target exists
if [[ ! -e "$TARGET" ]]; then
    echo "ERROR: Target path does not exist: $TARGET"
    exit 1
fi

# Determine if target is file or directory
if [[ -f "$TARGET" ]]; then
    IS_FILE=true
    TARGET_DIR="$(dirname "$TARGET")"
else
    IS_FILE=false
    TARGET_DIR="$TARGET"
fi

echo "=== CODEBASE METRICS ==="
echo "Target: $TARGET"
echo "Type: $(if $IS_FILE; then echo 'File'; else echo 'Directory'; fi)"
echo "Date: $(date +%Y-%m-%d)"
echo ""

# Get git root if available
GIT_ROOT=$(git -C "$TARGET_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -n "$GIT_ROOT" ]]; then
    echo "Project: $(basename "$GIT_ROOT")"
else
    echo "Project: (not a git repository)"
fi
echo ""

echo "=== FILE COUNTS ==="

if $IS_FILE; then
    echo "Target is a single file"
    TOTAL_FILES=1
    EXTENSION="${TARGET##*.}"
    echo "Extension: .$EXTENSION"
else
    # Count source files by type
    PY_COUNT=$(find "$TARGET" -type f -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
    TS_COUNT=$(find "$TARGET" -type f -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
    TSX_COUNT=$(find "$TARGET" -type f -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
    JS_COUNT=$(find "$TARGET" -type f -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
    JSX_COUNT=$(find "$TARGET" -type f -name "*.jsx" 2>/dev/null | wc -l | tr -d ' ')

    TOTAL_FILES=$((PY_COUNT + TS_COUNT + TSX_COUNT + JS_COUNT + JSX_COUNT))

    echo "Python files (.py): $PY_COUNT"
    echo "TypeScript files (.ts): $TS_COUNT"
    echo "TSX files (.tsx): $TSX_COUNT"
    echo "JavaScript files (.js): $JS_COUNT"
    echo "JSX files (.jsx): $JSX_COUNT"
    echo "Total source files: $TOTAL_FILES"
fi
echo ""

echo "=== LINES OF CODE ==="

if $IS_FILE; then
    LOC=$(wc -l < "$TARGET" | tr -d ' ')
    echo "Lines in file: $LOC"
else
    # Count lines of code
    if [[ $TOTAL_FILES -gt 0 ]]; then
        LOC=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
        echo "Total lines of code: ${LOC:-0}"
    else
        LOC=0
        echo "Total lines of code: 0"
    fi
fi
echo ""

echo "=== TEST FILES ==="

if $IS_FILE; then
    if [[ "$TARGET" == *test* ]] || [[ "$TARGET" == *spec* ]]; then
        echo "Target is a test file"
        TEST_COUNT=1
    else
        echo "Target is not a test file"
        TEST_COUNT=0
    fi
else
    TEST_COUNT=$(find "$TARGET" -type f \( -name "*test*.py" -o -name "*test*.ts" -o -name "*.spec.*" -o -name "*_test.py" -o -name "*_test.ts" \) 2>/dev/null | wc -l | tr -d ' ')
    echo "Test files found: $TEST_COUNT"
fi
echo ""

echo "=== DEPENDENCIES (IMPORTS) ==="

if $IS_FILE; then
    IMPORT_COUNT=$(grep -c -E "^import |^from .* import " "$TARGET" 2>/dev/null || echo "0")
else
    IMPORT_COUNT=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec grep -h -E "^import |^from .* import " {} \; 2>/dev/null | wc -l | tr -d ' ')
fi
echo "Import statements: $IMPORT_COUNT"

# Unique imports (deduplicated)
if $IS_FILE; then
    UNIQUE_IMPORTS=$(grep -E "^import |^from .* import " "$TARGET" 2>/dev/null | awk '{print $2}' | cut -d'.' -f1 | sort -u | wc -l | tr -d ' ')
else
    UNIQUE_IMPORTS=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -exec grep -h -E "^import |^from .* import " {} \; 2>/dev/null | awk '{print $2}' | cut -d'.' -f1 | sort -u | wc -l | tr -d ' ')
fi
echo "Unique modules imported: $UNIQUE_IMPORTS"
echo ""

echo "=== GIT ACTIVITY ==="

if [[ -n "$GIT_ROOT" ]]; then
    # Recent commits affecting this path
    RECENT_COMMITS=$(git -C "$TARGET_DIR" log --oneline --since="1 week ago" -- "$TARGET" 2>/dev/null | wc -l | tr -d ' ')
    echo "Commits (last 7 days): $RECENT_COMMITS"

    # Contributors
    CONTRIBUTORS=$(git -C "$TARGET_DIR" log --format='%an' -- "$TARGET" 2>/dev/null | sort -u | wc -l | tr -d ' ')
    echo "Unique contributors: $CONTRIBUTORS"

    # Last modified
    LAST_MODIFIED=$(git -C "$TARGET_DIR" log -1 --format='%ar' -- "$TARGET" 2>/dev/null || echo "unknown")
    echo "Last modified: $LAST_MODIFIED"
else
    echo "Not a git repository"
fi
echo ""

echo "=== COMPLEXITY INDICATORS ==="

# Cyclomatic complexity indicators (simple heuristics)
if $IS_FILE; then
    IF_COUNT=$(grep -c -E "^\s*(if |elif |else:)" "$TARGET" 2>/dev/null) || IF_COUNT=0
    FOR_COUNT=$(grep -c -E "^\s*(for |while )" "$TARGET" 2>/dev/null) || FOR_COUNT=0
    TRY_COUNT=$(grep -c -E "^\s*(try:|except |except:)" "$TARGET" 2>/dev/null) || TRY_COUNT=0
    FUNC_COUNT=$(grep -c -E "^\s*(def |async def |function |const .* = )" "$TARGET" 2>/dev/null) || FUNC_COUNT=0
    CLASS_COUNT=$(grep -c -E "^\s*(class )" "$TARGET" 2>/dev/null) || CLASS_COUNT=0
else
    IF_COUNT=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" \) -exec grep -h -E "^\s*(if |elif |else:)" {} \; 2>/dev/null | wc -l | tr -d ' ')
    FOR_COUNT=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" \) -exec grep -h -E "^\s*(for |while )" {} \; 2>/dev/null | wc -l | tr -d ' ')
    TRY_COUNT=$(find "$TARGET" -type f \( -name "*.py" \) -exec grep -h -E "^\s*(try:|except )" {} \; 2>/dev/null | wc -l | tr -d ' ')
    FUNC_COUNT=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" \) -exec grep -h -E "^\s*(def |async def |function |const .* = \()" {} \; 2>/dev/null | wc -l | tr -d ' ')
    CLASS_COUNT=$(find "$TARGET" -type f \( -name "*.py" -o -name "*.ts" \) -exec grep -h -E "^\s*(class )" {} \; 2>/dev/null | wc -l | tr -d ' ')
fi

echo "Conditionals (if/elif/else): $IF_COUNT"
echo "Loops (for/while): $FOR_COUNT"
echo "Error handling (try/except): $TRY_COUNT"
echo "Functions/methods: $FUNC_COUNT"
echo "Classes: $CLASS_COUNT"
echo ""

echo "=== SUMMARY ==="
echo "Files: $TOTAL_FILES"
echo "Lines: ${LOC:-0}"
echo "Tests: $TEST_COUNT"
echo "Imports: $UNIQUE_IMPORTS"
echo "Functions: $FUNC_COUNT"
echo "Classes: $CLASS_COUNT"

# Calculate simple complexity score suggestion
if [[ ${LOC:-0} -lt 50 ]]; then
    LOC_SCORE=1
elif [[ ${LOC:-0} -lt 200 ]]; then
    LOC_SCORE=2
elif [[ ${LOC:-0} -lt 500 ]]; then
    LOC_SCORE=3
elif [[ ${LOC:-0} -lt 1500 ]]; then
    LOC_SCORE=4
else
    LOC_SCORE=5
fi

if [[ $TOTAL_FILES -eq 1 ]]; then
    FILE_SCORE=1
elif [[ $TOTAL_FILES -le 3 ]]; then
    FILE_SCORE=2
elif [[ $TOTAL_FILES -le 10 ]]; then
    FILE_SCORE=3
elif [[ $TOTAL_FILES -le 25 ]]; then
    FILE_SCORE=4
else
    FILE_SCORE=5
fi

if [[ $UNIQUE_IMPORTS -eq 0 ]]; then
    DEP_SCORE=1
elif [[ $UNIQUE_IMPORTS -eq 1 ]]; then
    DEP_SCORE=2
elif [[ $UNIQUE_IMPORTS -le 3 ]]; then
    DEP_SCORE=3
elif [[ $UNIQUE_IMPORTS -le 6 ]]; then
    DEP_SCORE=4
else
    DEP_SCORE=5
fi

echo ""
echo "=== SUGGESTED SCORES ==="
echo "Lines of Code Score: $LOC_SCORE/5"
echo "Files Affected Score: $FILE_SCORE/5"
echo "Dependencies Score: $DEP_SCORE/5"
echo ""
echo "Note: Unknowns, Cross-Cutting Concerns, and Risk Level require human assessment."

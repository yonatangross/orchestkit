#!/bin/bash
# =============================================================================
# merge-conflict-predictor.sh
# WARNING: Predict merge conflicts before commit
# =============================================================================
set -euo pipefail

# Source common utilities (includes safe grep functions)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only run if we're in a git worktree environment
if ! git worktree list >/dev/null 2>&1; then
    exit 0
fi

WARNINGS=()
CONFLICTS=()

# =============================================================================
# 1. CHECK FOR CONCURRENT MODIFICATIONS
# =============================================================================

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
[[ -z "$REPO_ROOT" ]] && exit 0

REL_PATH=$(realpath --relative-to="$REPO_ROOT" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# Get all worktrees
WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)

[[ -z "$WORKTREES" ]] && exit 0

# Check each worktree for modifications to the same file
while IFS= read -r worktree; do
    [[ -z "$worktree" ]] && continue

    # Skip current worktree
    CURRENT_WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
    [[ "$worktree" == "$CURRENT_WORKTREE" ]] && continue

    WORKTREE_FILE="$worktree/$REL_PATH"

    # Check if file exists and is modified in other worktree
    if [[ -f "$WORKTREE_FILE" ]]; then
        # Get branch name
        WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

        # Check if file is modified (staged or unstaged)
        if (cd "$worktree" && git status --short "$REL_PATH" 2>/dev/null | grep -qE "^.M|^M.|^A"); then
            CONFLICTS+=("$worktree|$WORKTREE_BRANCH|modified")

            # Get the diff to analyze overlap
            OTHER_CONTENT=$(cat "$WORKTREE_FILE" 2>/dev/null || echo "")

            # Check for overlapping changes (same line numbers modified)
            check_overlap "$CONTENT" "$OTHER_CONTENT" "$WORKTREE_BRANCH"
        fi

        # Check if file exists in other worktree but not in base
        if ! (cd "$worktree" && git ls-files --error-unmatch "$REL_PATH" >/dev/null 2>&1); then
            # File is new in other worktree too
            CONFLICTS+=("$worktree|$WORKTREE_BRANCH|new")
        fi
    fi
done <<< "$WORKTREES"

# =============================================================================
# 2. ANALYZE OVERLAPPING CHANGES
# =============================================================================

check_overlap() {
    local new_content="$1"
    local other_content="$2"
    local other_branch="$3"

    # Create temp files for diff
    local temp_new=$(mktemp)
    local temp_other=$(mktemp)

    echo "$new_content" > "$temp_new"
    echo "$other_content" > "$temp_other"

    # Get diff hunks
    local diff_output=$(diff -u "$temp_other" "$temp_new" 2>/dev/null || true)

    # Count changed lines
    local lines_changed=$(echo "$diff_output" | grep -cE "^[\+\-]" 2>/dev/null || echo "0")

    # Analyze for conflicting patterns
    if [[ $lines_changed -gt 10 ]]; then
        WARNINGS+=("OVERLAP: Significant changes in both branches ($lines_changed lines)")
        WARNINGS+=("  Branch: $other_branch")
        WARNINGS+=("  High risk of merge conflict")
        WARNINGS+=("")

        # Check for same function/class modifications
        local new_functions=$(echo "$new_content" | grep -oE "(function|class|def)\s+[A-Za-z_][A-Za-z0-9_]*" | sort -u)
        local other_functions=$(echo "$other_content" | grep -oE "(function|class|def)\s+[A-Za-z_][A-Za-z0-9_]*" | sort -u)

        local common_functions=$(comm -12 <(echo "$new_functions") <(echo "$other_functions"))

        if [[ -n "$common_functions" ]]; then
            WARNINGS+=("  Overlapping functions/classes:")
            while IFS= read -r func; do
                [[ -z "$func" ]] && continue
                WARNINGS+=("    - $func")
            done <<< "$common_functions"
            WARNINGS+=("")
        fi
    fi

    rm -f "$temp_new" "$temp_other"
}

# =============================================================================
# 3. CHECK BASE BRANCH DIVERGENCE
# =============================================================================

# Get base branch (usually main or master)
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Check if current branch has diverged significantly from base
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]]; then
    # Count commits ahead/behind
    AHEAD=$(git rev-list --count "$BASE_BRANCH".."$CURRENT_BRANCH" 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count "$CURRENT_BRANCH".."$BASE_BRANCH" 2>/dev/null || echo "0")

    if [[ $BEHIND -gt 10 ]]; then
        WARNINGS+=("DIVERGENCE: Current branch is $BEHIND commits behind $BASE_BRANCH")
        WARNINGS+=("  Consider rebasing before continuing development")
        WARNINGS+=("  This reduces merge conflict risk")
        WARNINGS+=("")
    fi

    # Check if file was modified in base branch since we diverged
    MERGE_BASE=$(git merge-base "$CURRENT_BRANCH" "$BASE_BRANCH" 2>/dev/null || echo "")
    if [[ -n "$MERGE_BASE" ]]; then
        BASE_CHANGES=$(git log --oneline "$MERGE_BASE".."$BASE_BRANCH" -- "$REL_PATH" 2>/dev/null | wc -l | tr -d ' ')

        if [[ $BASE_CHANGES -gt 0 ]]; then
            WARNINGS+=("BASE CHANGES: File modified $BASE_CHANGES times in $BASE_BRANCH since branch point")
            WARNINGS+=("  File: $REL_PATH")
            WARNINGS+=("  Review base branch changes before merging")
            WARNINGS+=("")
        fi
    fi
fi

# =============================================================================
# 4. CHECK FOR API CONTRACT CHANGES
# =============================================================================

# If this file exports a public API, check if signature changes conflict
check_api_conflicts() {
    local content="$1"
    local file_path="$2"

    # Extract public exports
    local exports=""

    if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
        exports=$(echo "$content" | grep -oE "export (function|class|interface|type|const)\s+[A-Za-z_][A-Za-z0-9_]*" | awk '{print $NF}')
    elif [[ "$file_path" =~ \.py$ ]]; then
        # Check for public functions/classes (not starting with _)
        exports=$(echo "$content" | grep -oE "^(def|class)\s+[A-Za-z][A-Za-z0-9_]*" | awk '{print $NF}')
    fi

    if [[ -n "$exports" ]]; then
        # Check if these exports are used in other worktrees
        while IFS= read -r worktree; do
            [[ -z "$worktree" ]] && continue

            CURRENT_WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
            [[ "$worktree" == "$CURRENT_WORKTREE" ]] && continue

            WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

            while IFS= read -r export_name; do
                [[ -z "$export_name" ]] && continue

                # Search for usage in other worktree
                # SEC-FIX: Use grep -Fw for safe word-boundary matching with fixed strings
                # Export names are extracted from code and may contain special characters
                # that would cause shell parsing errors if passed to grep directly
                USAGES=$(find "$worktree" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" \) \
                    ! -path "*/node_modules/*" \
                    ! -path "*/.venv/*" \
                    ! -path "*/dist/*" \
                    -exec grep -Flw -- "$export_name" {} \; 2>/dev/null | head -3 || true)

                if [[ -n "$USAGES" ]]; then
                    WARNINGS+=("API USAGE: Export '$export_name' is used in branch: $WORKTREE_BRANCH")
                    WARNINGS+=("  Files using this export:")
                    while IFS= read -r usage_file; do
                        REL_USAGE=$(realpath --relative-to="$worktree" "$usage_file" 2>/dev/null || echo "$usage_file")
                        WARNINGS+=("    - $REL_USAGE")
                    done <<< "$USAGES"
                    WARNINGS+=("  Coordinate API changes across branches")
                    WARNINGS+=("")
                fi
            done <<< "$exports"
        done <<< "$WORKTREES"
    fi
}

check_api_conflicts "$CONTENT" "$FILE_PATH"

# =============================================================================
# 5. CHECK FOR IMPORT/EXPORT CONSISTENCY
# =============================================================================

# Check if this file's imports are consistent across worktrees
check_import_consistency() {
    local content="$1"

    # Extract imports
    local imports=""

    if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
        imports=$(echo "$content" | grep -E "^import.*from ['\"]" | sort)
    elif [[ "$FILE_PATH" =~ \.py$ ]]; then
        imports=$(echo "$content" | grep -E "^(from|import)\s" | sort)
    fi

    if [[ -n "$imports" ]]; then
        # Check if other worktrees have different import patterns for same file
        while IFS= read -r worktree; do
            [[ -z "$worktree" ]] && continue

            CURRENT_WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
            [[ "$worktree" == "$CURRENT_WORKTREE" ]] && continue

            WORKTREE_FILE="$worktree/$REL_PATH"
            if [[ -f "$WORKTREE_FILE" ]]; then
                OTHER_IMPORTS=""
                OTHER_CONTENT=$(cat "$WORKTREE_FILE" 2>/dev/null || echo "")

                if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
                    OTHER_IMPORTS=$(echo "$OTHER_CONTENT" | grep -E "^import.*from ['\"]" | sort)
                elif [[ "$FILE_PATH" =~ \.py$ ]]; then
                    OTHER_IMPORTS=$(echo "$OTHER_CONTENT" | grep -E "^(from|import)\s" | sort)
                fi

                # Compare imports
                if [[ "$imports" != "$OTHER_IMPORTS" ]]; then
                    WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

                    WARNINGS+=("IMPORT DIVERGENCE: Different imports in branch: $WORKTREE_BRANCH")
                    WARNINGS+=("  File: $REL_PATH")
                    WARNINGS+=("  Review import consistency before merging")
                    WARNINGS+=("")
                fi
            fi
        done <<< "$WORKTREES"
    fi
}

check_import_consistency "$CONTENT"

# =============================================================================
# 6. REPORT FINDINGS
# =============================================================================

if [[ ${#CONFLICTS[@]} -gt 0 ]]; then
    echo "⚠️  MERGE CONFLICT RISK: Concurrent modifications detected" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    echo "Modified in other worktrees:" >&2

    for conflict in "${CONFLICTS[@]}"; do
        IFS='|' read -r worktree branch status <<< "$conflict"
        echo "  Branch: $branch" >&2
        echo "  Status: $status" >&2
        echo "  Path: $worktree" >&2
        echo "" >&2
    done

    echo "Recommendations:" >&2
    echo "  1. Coordinate changes with other instances" >&2
    echo "  2. Consider splitting work to avoid overlapping files" >&2
    echo "  3. Communicate before merging" >&2
    echo "" >&2
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  WARNING: Potential merge issues detected" >&2
    echo "" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning" >&2
    done
fi

# Don't block, just warn
# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Merge conflicts predicted","continue":true}'
exit 0
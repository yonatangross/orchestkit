#!/bin/bash
# =============================================================================
# multi-instance-quality-gate.sh
# CC 2.1.2 Compliant: includes continue field in all outputs
# Pre-commit quality gate for multi-instance Claude Code environments
# =============================================================================
set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Get inputs
TOOL_NAME=$(get_tool_name)
COMMAND=$(get_field '.tool_input.command')

# Only run for git commit commands
if [[ "$TOOL_NAME" != "Bash" ]] || [[ ! "$COMMAND" =~ git.*commit ]]; then
    echo '{"continue": true}'
    exit 0
fi

# Skip if amending or fixup
if [[ "$COMMAND" =~ --amend|--fixup ]]; then
    echo '{"continue": true}'
    exit 0
fi

echo "Running multi-instance quality gates..." >&2

# =============================================================================
# 1. GET STAGED FILES
# =============================================================================

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
cd "$PROJECT_ROOT"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")

if [[ -z "$STAGED_FILES" ]]; then
    echo "No files staged for commit" >&2
    echo '{"systemMessage":"No files staged","continue": true}'
    exit 0
fi

echo "" >&2
echo "Checking $(echo "$STAGED_FILES" | wc -l | tr -d ' ') staged files..." >&2

# =============================================================================
# 2. RUN QUALITY GATES ON EACH FILE
# =============================================================================

ERRORS_FOUND=false
WARNINGS_FOUND=false

# Create temp directory for hook I/O
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

run_gate() {
    local file_path="$1"
    local hook_script="$2"
    local hook_name="$3"

    [[ ! -f "$hook_script" ]] && return 0

    # Get file content
    local content=$(git show ":$file_path" 2>/dev/null || cat "$file_path" 2>/dev/null || echo "")
    [[ -z "$content" ]] && return 0

    # Create hook input
    local input_json=$(cat <<EOF
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "$PROJECT_ROOT/$file_path"
  },
  "tool_output": {
    "content": $(echo "$content" | jq -Rs .)
  }
}
EOF
)

    # Set environment variables for hook
    export TOOL_INPUT_FILE_PATH="$PROJECT_ROOT/$file_path"
    export TOOL_OUTPUT_CONTENT="$content"

    # Run hook and capture output
    local output_file="$TEMP_DIR/${hook_name}_output.txt"
    local exit_code=0

    echo "$input_json" | bash "$hook_script" 2>"$output_file" || exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        # Hook blocked
        cat "$output_file" >&2
        return 1
    elif [[ -s "$output_file" ]]; then
        # Hook warned
        cat "$output_file" >&2
        return 2
    fi

    return 0
}

echo "" >&2

while IFS= read -r file_path; do
    [[ -z "$file_path" ]] && continue

    # Skip non-code files
    if [[ ! "$file_path" =~ \.(ts|tsx|js|jsx|py)$ ]]; then
        continue
    fi

    echo "Checking: $file_path" >&2

    # Gate 1: Duplicate code detection
    if run_gate "$file_path" "$PROJECT_ROOT/.claude/hooks/skill/duplicate-code-detector.sh" "duplicate-detector"; then
        :
    elif [[ $? -eq 1 ]]; then
        ERRORS_FOUND=true
    else
        WARNINGS_FOUND=true
    fi

    # Gate 2: Pattern consistency
    if run_gate "$file_path" "$PROJECT_ROOT/.claude/hooks/skill/pattern-consistency-enforcer.sh" "pattern-enforcer"; then
        :
    elif [[ $? -eq 1 ]]; then
        ERRORS_FOUND=true
    else
        WARNINGS_FOUND=true
    fi

    # Gate 3: Test coverage
    if run_gate "$file_path" "$PROJECT_ROOT/.claude/hooks/skill/cross-instance-test-validator.sh" "test-validator"; then
        :
    elif [[ $? -eq 1 ]]; then
        ERRORS_FOUND=true
    else
        WARNINGS_FOUND=true
    fi

    # Gate 4: Merge conflict prediction (non-blocking)
    run_gate "$file_path" "$PROJECT_ROOT/.claude/hooks/skill/merge-conflict-predictor.sh" "conflict-predictor" || true

done <<< "$STAGED_FILES"

# =============================================================================
# 3. CHECK CROSS-FILE CONSISTENCY
# =============================================================================

echo "" >&2
echo "Checking cross-file consistency..." >&2

# Check for naming conflicts across staged files
check_naming_conflicts() {
    local temp_names="$TEMP_DIR/names.txt"

    while IFS= read -r file_path; do
        [[ -z "$file_path" ]] && continue
        [[ ! "$file_path" =~ \.(ts|tsx|js|jsx|py)$ ]] && continue

        local content=$(git show ":$file_path" 2>/dev/null || echo "")

        # Extract function/class names with file path
        if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
            echo "$content" | grep -oE "(export )?(function|class|const)\s+[A-Za-z_][A-Za-z0-9_]*" | \
                awk -v file="$file_path" '{print $NF ":" file}' >> "$temp_names"
        elif [[ "$file_path" =~ \.py$ ]]; then
            echo "$content" | grep -oE "^(def|class)\s+[A-Za-z_][A-Za-z0-9_]*" | \
                awk -v file="$file_path" '{print $NF ":" file}' >> "$temp_names"
        fi
    done <<< "$STAGED_FILES"

    if [[ -f "$temp_names" ]]; then
        # Find duplicates
        local duplicates=$(sort "$temp_names" | awk -F: '{print $1}' | uniq -d)

        if [[ -n "$duplicates" ]]; then
            echo "" >&2
            echo "WARNING: Duplicate names in this commit:" >&2
            while IFS= read -r dup_name; do
                [[ -z "$dup_name" ]] && continue
                echo "" >&2
                echo "  Name: $dup_name" >&2
                echo "  Found in:" >&2
                grep "^$dup_name:" "$temp_names" | cut -d: -f2 | while read -r dup_file; do
                    echo "    - $dup_file" >&2
                done
            done <<< "$duplicates"
            echo "" >&2
            WARNINGS_FOUND=true
        fi
    fi
}

check_naming_conflicts

# =============================================================================
# 4. CHECK WORKTREE COORDINATION
# =============================================================================

if git worktree list >/dev/null 2>&1; then
    WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' | wc -l | tr -d ' ')

    if [[ $WORKTREES -gt 1 ]]; then
        echo "" >&2
        echo "Multi-worktree environment detected ($WORKTREES worktrees)" >&2

        # Check if any staged files are also modified in other worktrees
        CONCURRENT_MODS=()

        while IFS= read -r file_path; do
            [[ -z "$file_path" ]] && continue

            # Check other worktrees
            WORKTREE_LIST=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)
            CURRENT_WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

            while IFS= read -r worktree; do
                [[ -z "$worktree" ]] && continue
                [[ "$worktree" == "$CURRENT_WORKTREE" ]] && continue

                if [[ -f "$worktree/$file_path" ]]; then
                    if (cd "$worktree" && git status --short "$file_path" 2>/dev/null | grep -qE "^.M|^M."); then
                        WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                        CONCURRENT_MODS+=("$file_path:$WORKTREE_BRANCH")
                    fi
                fi
            done <<< "$WORKTREE_LIST"
        done <<< "$STAGED_FILES"

        if [[ ${#CONCURRENT_MODS[@]} -gt 0 ]]; then
            echo "" >&2
            echo "WARNING: Concurrent modifications detected:" >&2
            for mod in "${CONCURRENT_MODS[@]}"; do
                IFS=':' read -r file branch <<< "$mod"
                echo "  File: $file" >&2
                echo "  Also modified in branch: $branch" >&2
                echo "" >&2
            done
            WARNINGS_FOUND=true
        fi
    fi
fi

# =============================================================================
# 5. REPORT FINAL STATUS
# =============================================================================

echo "" >&2
echo "--------------------------------------------" >&2

if [[ "$ERRORS_FOUND" == "true" ]]; then
    echo "" >&2
    echo "COMMIT BLOCKED: Critical quality gate failures" >&2
    echo "" >&2
    echo "Fix the errors above and try again" >&2
    echo "" >&2
    echo '{"systemMessage":"Quality gate failed","continue":false}'
    exit 1
fi

if [[ "$WARNINGS_FOUND" == "true" ]]; then
    echo "" >&2
    echo "WARNINGS DETECTED: Review before committing" >&2
    echo "" >&2
    echo "Warnings don't block commits, but should be addressed" >&2
    echo "" >&2
fi

echo "Multi-instance quality gates passed" >&2
echo "" >&2

# Output systemMessage for user visibility
echo '{"systemMessage":"Quality gate passed","continue":true}'
exit 0
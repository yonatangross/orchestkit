#!/bin/bash
# =============================================================================
# duplicate-code-detector.sh
# BLOCKING: Detect duplicate/redundant code across worktrees
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

# Only validate code files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|py)$ ]]; then
    exit 0
fi

ERRORS=()
WARNINGS=()

# =============================================================================
# 1. DETECT EXACT DUPLICATES (Across all worktrees and main codebase)
# =============================================================================

# Extract function/class signatures from the content
extract_signatures() {
    local content="$1"
    
    if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
        # TypeScript/JavaScript: Extract function/class names
        echo "$content" | grep -oE "(function|class|const|export function|export class)\s+[A-Za-z_][A-Za-z0-9_]*" | sort -u
    elif [[ "$FILE_PATH" =~ \.py$ ]]; then
        # Python: Extract function/class names
        echo "$content" | grep -oE "^(def|class)\s+[A-Za-z_][A-Za-z0-9_]*" | sort -u
    fi
}

NEW_SIGNATURES=$(extract_signatures "$CONTENT")

# Check for duplicates in main repo
if [[ -n "$NEW_SIGNATURES" ]]; then
    # Get project root
    PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
    
    # Get all code files in the project (excluding node_modules, .venv, etc.)
    CODE_FILES=$(find "$PROJECT_ROOT" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/.venv/*" \
        ! -path "*/venv/*" \
        ! -path "*/__pycache__/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/.next/*" \
        ! -path "$FILE_PATH" \
        2>/dev/null || echo "")
    
    # Check for duplicate function/class names
    while IFS= read -r signature; do
        [[ -z "$signature" ]] && continue
        
        # Extract just the name
        NAME=$(echo "$signature" | awk '{print $NF}')
        
        # Search for this name in other files
        DUPLICATES=$(echo "$CODE_FILES" | xargs grep -l "\b$NAME\b" 2>/dev/null | head -5 || true)
        
        if [[ -n "$DUPLICATES" ]]; then
            # Check if it's a true duplicate (same signature)
            EXACT_MATCH=$(echo "$CODE_FILES" | xargs grep -h "$signature" 2>/dev/null | head -1 || true)
            
            if [[ -n "$EXACT_MATCH" ]]; then
                WARNINGS+=("DUPLICATE: '$NAME' already exists in:")
                while IFS= read -r dup_file; do
                    REL_PATH=$(realpath --relative-to="$PROJECT_ROOT" "$dup_file" 2>/dev/null || echo "$dup_file")
                    WARNINGS+=("  - $REL_PATH")
                done <<< "$DUPLICATES"
                WARNINGS+=("  Consider:")
                WARNINGS+=("    1. Reusing existing implementation")
                WARNINGS+=("    2. Extracting to shared utility")
                WARNINGS+=("    3. Using different name if intentionally different")
                WARNINGS+=("")
            fi
        fi
    done <<< "$NEW_SIGNATURES"
fi

# =============================================================================
# 2. DETECT COPY-PASTE CODE (Similar code blocks)
# =============================================================================

# Check for suspiciously similar code patterns
check_copypaste_patterns() {
    local content="$1"
    
    # Count repeated code blocks (3+ consecutive identical lines)
    REPEATED_BLOCKS=$(echo "$content" | awk '
        NR > 1 && $0 == prev { 
            count++
            if (count >= 3) print NR-2 ": " prev
        }
        { prev = $0; if ($0 != prev) count = 0 }
    ' | head -5)
    
    if [[ -n "$REPEATED_BLOCKS" ]]; then
        WARNINGS+=("COPY-PASTE: Repeated code blocks detected:")
        while IFS= read -r line; do
            WARNINGS+=("  Line $line")
        done <<< "$REPEATED_BLOCKS"
        WARNINGS+=("  Refactor repeated logic into functions")
        WARNINGS+=("")
    fi
}

check_copypaste_patterns "$CONTENT"

# =============================================================================
# 3. DETECT UTILITY FUNCTION DUPLICATION
# =============================================================================

# Check for common utility patterns that should be centralized
check_utility_patterns() {
    local content="$1"
    
    # TypeScript/JavaScript utility patterns
    if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
        # Check for date formatting (should use @/lib/dates)
        if echo "$content" | grep -qE "new Date.*toLocaleDateString" 2>/dev/null; then
            ERRORS+=("UTILITY: Direct date formatting detected")
            ERRORS+=("  Use centralized date utilities: import { formatDate } from '@/lib/dates'")
            ERRORS+=("")
        fi
        
        # Check for fetch wrappers (should use centralized API client)
        if echo "$content" | grep -qE "fetch\s*\(\s*['\"]" 2>/dev/null; then
            LOCAL_FETCH_COUNT=$(echo "$content" | grep -cE "fetch\s*\(\s*['\"]" 2>/dev/null || echo "0")
            if [[ $LOCAL_FETCH_COUNT -gt 2 ]]; then
                WARNINGS+=("UTILITY: Multiple fetch calls detected ($LOCAL_FETCH_COUNT)")
                WARNINGS+=("  Consider using centralized API client or custom hook")
                WARNINGS+=("")
            fi
        fi
        
        # Check for validation logic (should use Zod schemas)
        if echo "$content" | grep -qE "if\s*\([^)]*\.test\([^)]*\)" 2>/dev/null; then
            VALIDATION_COUNT=$(echo "$content" | grep -cE "if\s*\([^)]*\.test\([^)]*\)" 2>/dev/null || echo "0")
            if [[ $VALIDATION_COUNT -gt 3 ]]; then
                WARNINGS+=("UTILITY: Multiple inline validations detected ($VALIDATION_COUNT)")
                WARNINGS+=("  Use Zod schemas: const schema = z.object({...})")
                WARNINGS+=("")
            fi
        fi
    fi
    
    # Python utility patterns
    if [[ "$FILE_PATH" =~ \.py$ ]]; then
        # Check for JSON parsing (should use centralized utilities)
        if echo "$content" | grep -qE "json\.loads" 2>/dev/null; then
            JSON_COUNT=$(echo "$content" | grep -cE "json\.loads" 2>/dev/null || echo "0")
            if [[ $JSON_COUNT -gt 3 ]]; then
                WARNINGS+=("UTILITY: Multiple json.loads detected ($JSON_COUNT)")
                WARNINGS+=("  Consider centralized JSON handling with error recovery")
                WARNINGS+=("")
            fi
        fi
        
        # Check for environment variable access (should be centralized)
        if echo "$content" | grep -qE "os\.getenv|os\.environ" 2>/dev/null; then
            ENV_COUNT=$(echo "$content" | grep -cE "os\.getenv|os\.environ" 2>/dev/null || echo "0")
            if [[ $ENV_COUNT -gt 5 ]]; then
                WARNINGS+=("UTILITY: Multiple environment variable accesses ($ENV_COUNT)")
                WARNINGS+=("  Use Settings/Config class with Pydantic validation")
                WARNINGS+=("")
            fi
        fi
    fi
}

check_utility_patterns "$CONTENT"

# =============================================================================
# 4. CHECK FOR WORKTREE CONFLICTS (If worktrees are in use)
# =============================================================================

# Check if we're in a worktree environment
if git worktree list >/dev/null 2>&1; then
    WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)
    
    if [[ -n "$WORKTREES" ]]; then
        # Get relative path from repo root
        REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
        if [[ -n "$REPO_ROOT" ]]; then
            REL_PATH=$(realpath --relative-to="$REPO_ROOT" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
            
            # Check if this file is modified in other worktrees
            while IFS= read -r worktree; do
                [[ -z "$worktree" ]] && continue
                
                # Check if file exists and is modified in this worktree
                WORKTREE_FILE="$worktree/$REL_PATH"
                if [[ -f "$WORKTREE_FILE" ]]; then
                    # Check if modified (in git status)
                    if (cd "$worktree" && git status --short "$REL_PATH" 2>/dev/null | grep -q "^.M\|^M") then
                        WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                        WARNINGS+=("CONFLICT RISK: File also modified in worktree: $worktree")
                        WARNINGS+=("  Branch: $WORKTREE_BRANCH")
                        WARNINGS+=("  Coordinate changes to avoid merge conflicts")
                        WARNINGS+=("")
                    fi
                fi
            done <<< "$WORKTREES"
        fi
    fi
fi

# =============================================================================
# 5. REPORT FINDINGS
# =============================================================================

# Block on critical errors
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "❌ BLOCKED: Duplicate code violations detected" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    echo "Critical Issues:" >&2
    for error in "${ERRORS[@]}"; do
        echo "  $error" >&2
    done
    echo "" >&2
    echo "Reference: Multi-instance quality gates prevent code duplication" >&2
    exit 1
fi

# Warn but don't block
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  WARNING: Potential code duplication detected" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning" >&2
    done
    echo "" >&2
    echo "These are warnings - review before committing" >&2
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Duplicates checked","continue":true}'
exit 0

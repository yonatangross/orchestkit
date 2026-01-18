#!/usr/bin/env bash
# code-quality-gate.sh - Unified code quality checks before write
# Hook: PreToolUse (Write)
# Consolidates: complexity-gate.sh + type-check-on-save.sh
#
# Analyzes code quality BEFORE allowing write:
# - Checks function length (>50 lines = warning)
# - Checks cyclomatic complexity patterns (nested if/loops)
# - Checks for existing type errors in the file being modified (cached results)
#
# Outputs a SINGLE additionalContext with all quality issues.
#
# CC 2.1.9 Compliant: Uses additionalContext for quality warnings
# Version: 1.0.0

set -euo pipefail

# Read stdin BEFORE sourcing common.sh
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Self-guard: Only run for code files
guard_code_files || exit 0

# Self-guard: Skip internal/generated files
guard_skip_internal || exit 0

# Get file path and content
FILE_PATH=$(get_field '.tool_input.file_path')
CONTENT=$(get_field '.tool_input.content')

[[ -z "$FILE_PATH" || -z "$CONTENT" ]] && { output_silent_success; exit 0; }

# Configuration
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="${PROJECT_ROOT}/.claude/logs/code-quality-gate.log"
TYPE_CACHE_FILE="${PROJECT_ROOT}/.claude/cache/type-errors.json"

# Thresholds
MAX_FUNCTION_LINES=50
MAX_NESTING_DEPTH=4
MAX_CONDITIONALS_PER_FUNCTION=10

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$TYPE_CACHE_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [code-quality-gate] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# Get file extension
FILE_EXT="${FILE_PATH##*.}"
FILE_EXT_LOWER=$(printf '%s' "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# COMPLEXITY CHECKS (from complexity-gate.sh)
# =============================================================================

# Detect long functions
check_function_length() {
    local content="$1"
    local warnings=()

    case "$FILE_EXT_LOWER" in
        py)
            # Python: Find function definitions and count lines until next def/class or dedent
            local in_function=0
            local function_name=""
            local function_lines=0
            local base_indent=0

            while IFS= read -r line; do
                # Check for function definition
                if [[ "$line" =~ ^([[:space:]]*)def[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
                    # Save previous function if too long
                    if [[ $in_function -eq 1 && $function_lines -gt $MAX_FUNCTION_LINES ]]; then
                        warnings+=("Function '$function_name' is $function_lines lines (max: $MAX_FUNCTION_LINES)")
                    fi

                    in_function=1
                    function_name="${BASH_REMATCH[2]}"
                    base_indent=${#BASH_REMATCH[1]}
                    function_lines=1
                elif [[ "$line" =~ ^([[:space:]]*)class[[:space:]]+ ]]; then
                    # Class definition resets function tracking
                    if [[ $in_function -eq 1 && $function_lines -gt $MAX_FUNCTION_LINES ]]; then
                        warnings+=("Function '$function_name' is $function_lines lines (max: $MAX_FUNCTION_LINES)")
                    fi
                    in_function=0
                elif [[ $in_function -eq 1 ]]; then
                    # Count lines in function (skip empty lines)
                    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*$ ]]; then
                        ((function_lines++))
                    fi
                fi
            done <<< "$content"

            # Check last function
            if [[ $in_function -eq 1 && $function_lines -gt $MAX_FUNCTION_LINES ]]; then
                warnings+=("Function '$function_name' is $function_lines lines (max: $MAX_FUNCTION_LINES)")
            fi
            ;;

        ts|tsx|js|jsx|go|java|rs)
            # Brace-based languages: Count lines between braces
            local brace_count=0
            local function_lines=0
            local in_function=0
            local function_name=""

            while IFS= read -r line; do
                # Simple function detection
                if [[ "$line" =~ (function|func|fn)[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
                    function_name="${BASH_REMATCH[2]}"
                    in_function=1
                    function_lines=0
                    brace_count=0
                elif [[ "$line" =~ const[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(async[[:space:]]*)?\( ]]; then
                    function_name="${BASH_REMATCH[1]}"
                    in_function=1
                    function_lines=0
                    brace_count=0
                fi

                if [[ $in_function -eq 1 ]]; then
                    # Count braces
                    local open_braces="${line//[^\{]/}"
                    local close_braces="${line//[^\}]/}"
                    brace_count=$((brace_count + ${#open_braces} - ${#close_braces}))

                    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*$ ]]; then
                        ((function_lines++))
                    fi

                    # Function ended
                    if [[ $brace_count -le 0 && $function_lines -gt 0 ]]; then
                        if [[ $function_lines -gt $MAX_FUNCTION_LINES ]]; then
                            warnings+=("Function '$function_name' is $function_lines lines (max: $MAX_FUNCTION_LINES)")
                        fi
                        in_function=0
                    fi
                fi
            done <<< "$content"
            ;;
    esac

    # Only print if we have warnings (avoid unbound variable with set -u)
    if [[ ${#warnings[@]} -gt 0 ]]; then
        printf '%s\n' "${warnings[@]}"
    fi
}

# Check for deep nesting (cyclomatic complexity indicator)
check_nesting_depth() {
    local content="$1"
    local warnings=()
    local max_depth=0

    # Count nesting by indent levels or braces/keywords
    case "$FILE_EXT_LOWER" in
        py)
            # Python: Count indent levels
            while IFS= read -r line; do
                if [[ "$line" =~ ^([[:space:]]*)(if|for|while|with|try|elif|else|except|finally)[[:space:]:] ]]; then
                    local indent=${#BASH_REMATCH[1]}
                    local depth=$((indent / 4))  # Assume 4-space indent
                    if [[ $depth -gt $max_depth ]]; then
                        max_depth=$depth
                    fi
                fi
            done <<< "$content"
            ;;

        ts|tsx|js|jsx|go|java|rs)
            # Brace-based: Count brace depth at control structures
            local brace_depth=0
            while IFS= read -r line; do
                # Count braces
                local open_braces="${line//[^\{]/}"
                local close_braces="${line//[^\}]/}"
                brace_depth=$((brace_depth + ${#open_braces} - ${#close_braces}))

                # Check if this line has a control structure
                if [[ "$line" =~ (if|for|while|switch|try)[[:space:]]*\( ]]; then
                    if [[ $brace_depth -gt $max_depth ]]; then
                        max_depth=$brace_depth
                    fi
                fi
            done <<< "$content"
            ;;
    esac

    if [[ $max_depth -gt $MAX_NESTING_DEPTH ]]; then
        warnings+=("Deep nesting detected (depth: $max_depth, max: $MAX_NESTING_DEPTH)")
    fi

    # Only print if we have warnings (avoid unbound variable with set -u)
    if [[ ${#warnings[@]} -gt 0 ]]; then
        printf '%s\n' "${warnings[@]}"
    fi
}

# Count conditionals per function
check_conditionals() {
    local content="$1"
    local warnings=()

    # Count total conditionals as a simple heuristic
    # Use grep -c with explicit handling of non-match (exit code 1)
    local if_count
    if_count=$(echo "$content" | grep -cE '\b(if|elif|else if)\b' 2>/dev/null) || if_count=0
    local switch_count
    switch_count=$(echo "$content" | grep -cE '\b(switch|match)\b' 2>/dev/null) || switch_count=0
    local ternary_count
    ternary_count=$(echo "$content" | grep -cE '\?[^:]+:' 2>/dev/null) || ternary_count=0

    # Ensure counts are numeric
    if_count=${if_count:-0}
    switch_count=${switch_count:-0}
    ternary_count=${ternary_count:-0}

    local total_conditionals=$((if_count + switch_count + ternary_count))

    # Estimate functions (very rough)
    local function_count
    function_count=$(echo "$content" | grep -cE '\b(def|function|func|fn)\b' 2>/dev/null) || function_count=1
    function_count=${function_count:-1}
    [[ $function_count -eq 0 ]] && function_count=1

    local avg_conditionals=$((total_conditionals / function_count))

    if [[ $avg_conditionals -gt $MAX_CONDITIONALS_PER_FUNCTION ]]; then
        warnings+=("High cyclomatic complexity (~$avg_conditionals conditionals/function, consider refactoring)")
    fi

    # Only print if we have warnings (avoid unbound variable with set -u)
    if [[ ${#warnings[@]} -gt 0 ]]; then
        printf '%s\n' "${warnings[@]}"
    fi
}

# =============================================================================
# TYPE ERROR CHECKS (adapted from type-check-on-save.sh - uses cached results)
# =============================================================================

# Get cached type errors for a file
get_cached_type_errors() {
    local file="$1"

    # Check if cache file exists
    if [[ ! -f "$TYPE_CACHE_FILE" ]]; then
        echo ""
        return 0
    fi

    # Get errors for this file from cache (cached from previous PostToolUse runs)
    local file_basename
    file_basename=$(basename "$file")

    # Try to get cached errors for this file
    local cached_errors
    cached_errors=$(jq -r --arg f "$file_basename" '.[$f] // ""' "$TYPE_CACHE_FILE" 2>/dev/null || echo "")

    echo "$cached_errors"
}

# Check for existing type errors in project (quick check)
check_existing_type_errors() {
    local file="$1"
    local errors=""

    # First check cache
    local cached
    cached=$(get_cached_type_errors "$file")
    if [[ -n "$cached" ]]; then
        echo "$cached"
        return 0
    fi

    # If no cache, do a quick LSP-style check using existing .tsbuildinfo or pyright cache
    # This is intentionally lightweight - full type checking happens in PostToolUse

    case "$FILE_EXT_LOWER" in
        ts|tsx)
            # Check if tsconfig exists and there's a recent type check output
            if [[ -f "${PROJECT_ROOT}/tsconfig.json" ]]; then
                # Look for tsbuildinfo which contains incremental type info
                local buildinfo="${PROJECT_ROOT}/.tsbuildinfo"
                if [[ -f "$buildinfo" ]]; then
                    # Check if the file we're modifying has pending errors in tsbuildinfo
                    # This is a heuristic - real errors come from PostToolUse
                    :
                fi
            fi
            ;;
        py)
            # Check for pyright/mypy cache
            local pyright_cache="${PROJECT_ROOT}/.pyright"
            if [[ -d "$pyright_cache" ]]; then
                # Pyright cache exists - errors would be in PostToolUse cache
                :
            fi
            ;;
    esac

    echo "$errors"
}

# =============================================================================
# MAIN LOGIC - Collect all warnings
# =============================================================================

ALL_WARNINGS=()

# Run complexity checks
while IFS= read -r warning; do
    [[ -n "$warning" ]] && ALL_WARNINGS+=("$warning")
done < <(check_function_length "$CONTENT")

while IFS= read -r warning; do
    [[ -n "$warning" ]] && ALL_WARNINGS+=("$warning")
done < <(check_nesting_depth "$CONTENT")

while IFS= read -r warning; do
    [[ -n "$warning" ]] && ALL_WARNINGS+=("$warning")
done < <(check_conditionals "$CONTENT")

# Run type error check (cached)
TYPE_ERRORS=$(check_existing_type_errors "$FILE_PATH")
if [[ -n "$TYPE_ERRORS" ]]; then
    ALL_WARNINGS+=("$TYPE_ERRORS")
fi

# =============================================================================
# OUTPUT - Single additionalContext with all quality issues
# =============================================================================

if [[ ${#ALL_WARNINGS[@]} -gt 0 ]]; then
    log "Quality warnings for $FILE_PATH: ${ALL_WARNINGS[*]}"

    # Format all warnings into a single message
    QUALITY_MSG="Code quality: "
    for i in "${!ALL_WARNINGS[@]}"; do
        if [[ $i -gt 0 ]]; then
            QUALITY_MSG="$QUALITY_MSG | ${ALL_WARNINGS[$i]}"
        else
            QUALITY_MSG="$QUALITY_MSG${ALL_WARNINGS[$i]}"
        fi
    done

    # Truncate if too long (keep under 350 chars for combined message)
    if [[ ${#QUALITY_MSG} -gt 350 ]]; then
        QUALITY_MSG="${QUALITY_MSG:0:347}..."
    fi

    output_with_context "$QUALITY_MSG"
    exit 0
fi

log "No quality issues in $FILE_PATH"
output_silent_success
exit 0

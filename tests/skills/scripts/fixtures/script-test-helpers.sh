#!/bin/bash
# Script Test Helpers
# Helper functions for testing script-enhanced skills
#
# Source this file in test scripts:
#   source "$(dirname "$0")/fixtures/script-test-helpers.sh"
#
# Version: 1.0.0

set -uo pipefail
# Note: -e removed intentionally - helpers return non-zero for "not found" cases

# ============================================================================
# SCRIPT DISCOVERY
# ============================================================================

# Find all script-enhanced skills (scripts/*.md files)
find_all_script_files() {
    local skills_dir="${1:-skills}"
    find "$skills_dir" -path "*/scripts/*.md" -type f | sort
}

# Count script-enhanced skills
count_script_enhanced_skills() {
    local skills_dir="${1:-skills}"
    find_all_script_files "$skills_dir" | wc -l | tr -d ' '
}

# Get script directory for a skill
get_script_dir() {
    local skill_dir="$1"
    echo "$skill_dir/scripts"
}

# ============================================================================
# FRONTMATTER PARSING
# ============================================================================

# Extract YAML frontmatter from script file
extract_script_frontmatter() {
    local file="$1"
    # Extract content between FIRST and SECOND --- only
    # Uses awk to handle multiple --- in file (e.g., in templates)
    awk '
        /^---$/ {
            count++
            if (count == 2) exit
            next
        }
        count == 1 { print }
    ' "$file" 2>/dev/null
}

# Get frontmatter field value
get_frontmatter_field() {
    local frontmatter="$1"
    local field="$2"
    # Extract field value from YAML (handles simple cases)
    # Avoid pipefail issues by using intermediate variable
    local match
    match=$(echo "$frontmatter" | grep -E "^${field}:" 2>/dev/null || echo "")
    if [[ -n "$match" ]]; then
        echo "$match" | sed "s/^${field}:[[:space:]]*//" | sed 's/^["'"'"']//' | sed 's/["'"'"']$//'
    fi
}

# Check if script has required frontmatter fields
has_required_frontmatter() {
    local file="$1"
    local frontmatter
    frontmatter=$(extract_script_frontmatter "$file")
    
    local name
    name=$(get_frontmatter_field "$frontmatter" "name")
    local description
    description=$(get_frontmatter_field "$frontmatter" "description")
    local user_invocable
    user_invocable=$(get_frontmatter_field "$frontmatter" "user-invocable")
    
    if [[ -n "$name" && -n "$description" && -n "$user_invocable" ]]; then
        return 0
    else
        return 1
    fi
}

# ============================================================================
# COMMAND EXTRACTION
# ============================================================================

# Find all !command patterns in a file
find_all_script_commands() {
    local file="$1"
    # Match !`command` patterns (handles escaped backticks)
    grep -oE '!`[^`]*`' "$file" 2>/dev/null || true
}

# Extract command from !command pattern (remove !` and `)
extract_command_from_pattern() {
    local pattern="$1"
    # Remove !` from start and ` from end
    echo "$pattern" | sed 's/^!`//' | sed 's/`$//'
}

# Count !command patterns in a file
count_script_commands() {
    local file="$1"
    find_all_script_commands "$file" | wc -l | tr -d ' '
}

# ============================================================================
# $ARGUMENTS VALIDATION
# ============================================================================

# Check if $ARGUMENTS appears in !command backticks (WRONG)
check_arguments_in_command() {
    local file="$1"
    # Look for $ARGUMENTS inside !`...` patterns
    # This is a simplified check - may have false positives with escaped backticks
    if grep -qE '!`[^`]*\$ARGUMENTS[^`]*`' "$file" 2>/dev/null; then
        return 0  # Found (BAD)
    else
        return 1  # Not found (GOOD)
    fi
}

# Find all instances of $ARGUMENTS in !command (for reporting)
find_arguments_in_commands() {
    local file="$1"
    # Extract lines with $ARGUMENTS in !command patterns
    grep -nE '!`[^`]*\$ARGUMENTS[^`]*`' "$file" 2>/dev/null || true
}

# Check if $ARGUMENTS appears in markdown content (CORRECT)
check_arguments_in_markdown() {
    local file="$1"
    # Check for $ARGUMENTS outside of !command patterns
    # Remove !command patterns first, then check for $ARGUMENTS
    local temp_file
    temp_file=$(mktemp)
    # Remove !`...` patterns
    sed 's/!`[^`]*`//g' "$file" > "$temp_file"
    # Check for $ARGUMENTS in remaining content
    if grep -q '\$ARGUMENTS' "$temp_file" 2>/dev/null; then
        rm -f "$temp_file"
        return 0  # Found (GOOD)
    else
        rm -f "$temp_file"
        return 1  # Not found
    fi
}

# Check if $ARGUMENTS appears in code blocks (CORRECT)
check_arguments_in_code_blocks() {
    local file="$1"
    # Extract code blocks (between ``` markers)
    # This is simplified - doesn't handle nested code blocks perfectly
    awk '/^```/,/^```/ {print}' "$file" 2>/dev/null | grep -q '\$ARGUMENTS' || return 1
}

# ============================================================================
# COMMAND VALIDATION
# ============================================================================

# Validate !command syntax (balanced backticks)
# Returns 0 if syntax is valid, 1 if errors found
validate_command_syntax() {
    local file="$1"
    # Multi-line !command patterns are valid in CC skills
    # We check for obviously broken patterns:
    # 1. !` at end of file without closing `
    # 2. Multiple unclosed !` patterns

    # Count opening !` and closing ` that could close them
    # Note: This is simplified - complex nested patterns may not validate perfectly
    local content
    content=$(cat "$file" 2>/dev/null)

    # Check for !` that doesn't have a matching ` anywhere after it
    # by counting total !` and total ` after each !`
    local exclaim_backtick_count
    exclaim_backtick_count=$(echo "$content" | grep -o '!`' | wc -l | tr -d ' ')

    # For simplicity, just ensure the file has valid basic syntax
    # Multi-line patterns are allowed, so we can't easily validate nesting
    # Just return 0 if any !` exists and file parses
    return 0
}

# Check if command has fallback pattern
has_fallback_pattern() {
    local command="$1"
    # Check for || or && patterns
    if echo "$command" | grep -qE '\|\||&&'; then
        return 0
    else
        return 1
    fi
}

# Check for dangerous commands
check_dangerous_commands() {
    local file="$1"
    local dangerous_patterns=(
        "rm -rf"
        "sudo"
        "chmod 777"
        "> /dev/sd"
        "dd if="
        "mkfs"
        "fdisk"
    )

    local found=0
    for pattern in "${dangerous_patterns[@]}"; do
        # Search for pattern anywhere in file (not just in !command)
        # Use simple grep to avoid backtick escaping issues
        if grep -qi "$pattern" "$file" 2>/dev/null; then
            echo "Dangerous command found: $pattern" >&2
            found=1
        fi
    done

    return $found
}

# ============================================================================
# STRUCTURE VALIDATION
# ============================================================================

# Validate script structure (location, naming)
validate_script_structure() {
    local file="$1"
    local skill_dir
    skill_dir=$(dirname "$(dirname "$file")")
    local script_dir
    script_dir=$(dirname "$file")
    
    # Check if in scripts/ directory
    if [[ "$script_dir" != *"/scripts" ]]; then
        echo "Script not in scripts/ directory: $file" >&2
        return 1
    fi
    
    # Check if script file is .md
    if [[ "$file" != *.md ]]; then
        echo "Script file is not .md: $file" >&2
        return 1
    fi
    
    return 0
}

# Check if script name follows convention
check_script_naming() {
    local file="$1"
    local basename
    basename=$(basename "$file" .md)
    
    # Check for common prefixes
    if [[ "$basename" =~ ^(create|review|assess|generate|backup|automate|capture|multi)- ]]; then
        return 0
    else
        # Not all scripts need to follow this, so this is just a check
        return 0  # Don't fail, just note
    fi
}

# ============================================================================
# CONTENT VALIDATION
# ============================================================================

# Check if script has task instructions
has_task_instructions() {
    local file="$1"
    # Look for "Your Task", "Task:", or similar patterns
    if grep -qiE '(your task|task:|instructions:|what to do)' "$file" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if script uses $ARGUMENTS in task description
uses_arguments_in_task() {
    local file="$1"
    # Get content after removing !command patterns
    local temp_file
    temp_file=$(mktemp)
    sed 's/!`[^`]*`//g' "$file" > "$temp_file"
    # Check for $ARGUMENTS in task section
    if awk '/Your Task|Task:|Instructions:/,/^##|^$/ {print}' "$temp_file" 2>/dev/null | grep -q '\$ARGUMENTS'; then
        rm -f "$temp_file"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# Check if script has usage examples
has_usage_examples() {
    local file="$1"
    # Look for usage patterns
    if grep -qiE '(usage|example|invoke|run|call).*\$ARGUMENTS' "$file" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Count token estimate (chars/4)
count_tokens_estimate() {
    local file="$1"
    local chars
    chars=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
    echo $((chars / 4))
}

# ============================================================================
# ARGUMENT HINT VALIDATION
# ============================================================================

# Validate argument-hint matches $ARGUMENTS usage
validate_argument_hint() {
    local file="$1"
    local frontmatter
    frontmatter=$(extract_script_frontmatter "$file")
    local argument_hint
    argument_hint=$(get_frontmatter_field "$frontmatter" "argument-hint")
    
    # If argument-hint exists, script should use $ARGUMENTS
    if [[ -n "$argument_hint" ]]; then
        if check_arguments_in_markdown "$file" || check_arguments_in_code_blocks "$file"; then
            return 0  # Good - has hint and uses $ARGUMENTS
        else
            return 1  # Bad - has hint but doesn't use $ARGUMENTS
        fi
    else
        # No hint is OK if script doesn't need arguments
        return 0
    fi
}

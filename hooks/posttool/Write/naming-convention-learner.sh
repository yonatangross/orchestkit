#!/usr/bin/env bash
# naming-convention-learner.sh - Learn project naming conventions from written code
# Hook: PostToolUse/Write (#134)
# CC 2.1.7 Compliant
#
# Tracks:
# - Variable naming (camelCase, snake_case, PascalCase, SCREAMING_CASE)
# - Function naming patterns
# - Class naming patterns
# - File naming conventions
# - Constant naming
#
# Storage: .claude/feedback/naming-conventions.json
# Memory Fabric v2.1: Cross-project learning via patterns queue

set -euo pipefail

# Read hook input first
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Source Memory Fabric for cross-project learning (v2.1)
if [[ -f "$SCRIPT_DIR/../../_lib/memory-fabric.sh" ]]; then
    source "$SCRIPT_DIR/../../_lib/memory-fabric.sh"
fi

# Guard: Only run for code files
guard_code_files || exit 0

# Guard: Skip internal files
guard_skip_internal || exit 0

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

NAMING_PROFILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/naming-conventions.json"
LOG_FILE="${HOOK_LOG_DIR}/naming-convention-learner.log"

# Ensure directories exist
mkdir -p "$(dirname "$NAMING_PROFILE")" 2>/dev/null || true

log_naming() {
    log_hook "naming-convention-learner: $*"
}

# -----------------------------------------------------------------------------
# Naming Pattern Detection Functions
# -----------------------------------------------------------------------------

# Detect naming case from an identifier
detect_case() {
    local name="$1"

    # Skip if too short or contains only underscores/numbers
    [[ ${#name} -lt 2 ]] && echo "unknown" && return
    [[ "$name" =~ ^[_0-9]+$ ]] && echo "unknown" && return

    # Check patterns
    if [[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
        echo "SCREAMING_SNAKE_CASE"
    elif [[ "$name" =~ ^[A-Z][a-zA-Z0-9]*$ ]]; then
        echo "PascalCase"
    elif [[ "$name" =~ ^[a-z][a-zA-Z0-9]*$ && ! "$name" =~ _ ]]; then
        echo "camelCase"
    elif [[ "$name" =~ ^[a-z][a-z0-9_]*$ ]]; then
        echo "snake_case"
    elif [[ "$name" =~ ^_[a-z][a-z0-9_]*$ ]]; then
        echo "private_snake_case"
    elif [[ "$name" =~ ^__[a-z][a-z0-9_]*__$ ]]; then
        echo "dunder"
    else
        echo "mixed"
    fi
}

# Extract Python identifiers from code
extract_python_identifiers() {
    local content="$1"

    local vars=""
    local funcs=""
    local classes=""
    local consts=""

    # Extract function names (def name)
    funcs=$(echo "$content" | grep -oE 'def [a-zA-Z_][a-zA-Z0-9_]*' | sed 's/def //' | tr '\n' '|')

    # Extract class names (class Name)
    classes=$(echo "$content" | grep -oE 'class [A-Za-z_][a-zA-Z0-9_]*' | sed 's/class //' | tr '\n' '|')

    # Extract variable assignments (name = )
    vars=$(echo "$content" | grep -oE '^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=' | sed 's/[[:space:]]*=$//' | tr -d ' ' | tr '\n' '|')

    # Extract constants (UPPER_CASE = )
    consts=$(echo "$content" | grep -oE '^[A-Z][A-Z0-9_]*[[:space:]]*=' | sed 's/[[:space:]]*=$//' | tr '\n' '|')

    echo "functions:$funcs"
    echo "classes:$classes"
    echo "variables:$vars"
    echo "constants:$consts"
}

# Extract TypeScript/JavaScript identifiers from code
extract_js_identifiers() {
    local content="$1"

    local vars=""
    local funcs=""
    local classes=""
    local consts=""
    local interfaces=""
    local types=""

    # Extract function names (function name, const name = () =>, async function name)
    funcs=$(echo "$content" | grep -oE '(function|async function) [a-zA-Z_][a-zA-Z0-9_]*' | sed -E 's/(async )?function //' | tr '\n' '|')
    funcs="$funcs$(echo "$content" | grep -oE 'const [a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=[[:space:]]*\(' | sed 's/const //' | sed 's/[[:space:]]*=.*//' | tr '\n' '|')"

    # Extract class names
    classes=$(echo "$content" | grep -oE 'class [A-Za-z_][a-zA-Z0-9_]*' | sed 's/class //' | tr '\n' '|')

    # Extract interface names (TypeScript)
    interfaces=$(echo "$content" | grep -oE 'interface [A-Za-z_][a-zA-Z0-9_]*' | sed 's/interface //' | tr '\n' '|')

    # Extract type names (TypeScript)
    types=$(echo "$content" | grep -oE 'type [A-Za-z_][a-zA-Z0-9_]*' | sed 's/type //' | tr '\n' '|')

    # Extract const/let/var declarations
    vars=$(echo "$content" | grep -oE '(const|let|var) [a-zA-Z_][a-zA-Z0-9_]*' | sed -E 's/(const|let|var) //' | tr '\n' '|')

    echo "functions:$funcs"
    echo "classes:$classes"
    echo "interfaces:$interfaces"
    echo "types:$types"
    echo "variables:$vars"
}

# Extract Go identifiers from code
extract_go_identifiers() {
    local content="$1"

    # Extract function names (func name or func (receiver) name)
    local funcs
    funcs=$(echo "$content" | grep -oE 'func (\([^)]+\) )?[a-zA-Z_][a-zA-Z0-9_]*' | sed -E 's/func (\([^)]+\) )?//' | tr '\n' '|')

    # Extract type names (type Name struct/interface)
    local types
    types=$(echo "$content" | grep -oE 'type [A-Za-z_][a-zA-Z0-9_]*' | sed 's/type //' | tr '\n' '|')

    # Extract var/const declarations
    local vars
    vars=$(echo "$content" | grep -oE '(var|const) [a-zA-Z_][a-zA-Z0-9_]*' | sed -E 's/(var|const) //' | tr '\n' '|')

    echo "functions:$funcs"
    echo "types:$types"
    echo "variables:$vars"
}

# Count naming cases for a list of identifiers
count_cases() {
    local identifiers="$1"

    local camel=0
    local snake=0
    local pascal=0
    local screaming=0
    local private_snake=0
    local mixed=0

    # Handle empty identifiers
    if [[ -z "$identifiers" ]]; then
        echo "camelCase:0|snake_case:0|PascalCase:0|SCREAMING_SNAKE_CASE:0|private_snake_case:0|mixed:0"
        return
    fi

    # Split by | and count each case
    local NAMES=()
    IFS='|' read -ra NAMES <<< "$identifiers"
    for name in "${NAMES[@]:-}"; do
        [[ -z "$name" ]] && continue

        local case_type
        case_type=$(detect_case "$name")

        case "$case_type" in
            camelCase) ((camel++)) || true ;;
            snake_case) ((snake++)) || true ;;
            PascalCase) ((pascal++)) || true ;;
            SCREAMING_SNAKE_CASE) ((screaming++)) || true ;;
            private_snake_case) ((private_snake++)) || true ;;
            mixed) ((mixed++)) || true ;;
        esac
    done

    echo "camelCase:$camel|snake_case:$snake|PascalCase:$pascal|SCREAMING_SNAKE_CASE:$screaming|private_snake_case:$private_snake|mixed:$mixed"
}

# Detect file naming convention from file path
detect_file_naming() {
    local file_path="$1"

    local filename
    filename=$(basename "$file_path")
    filename="${filename%.*}"  # Remove extension

    if [[ "$filename" =~ ^[a-z][a-z0-9_]*$ ]]; then
        echo "snake_case"
    elif [[ "$filename" =~ ^[a-z][a-z0-9-]*$ ]]; then
        echo "kebab-case"
    elif [[ "$filename" =~ ^[A-Z][a-zA-Z0-9]*$ ]]; then
        echo "PascalCase"
    elif [[ "$filename" =~ ^[a-z][a-zA-Z0-9]*$ ]]; then
        echo "camelCase"
    else
        echo "mixed"
    fi
}

# -----------------------------------------------------------------------------
# Profile Management
# -----------------------------------------------------------------------------

# Initialize or load naming profile
load_profile() {
    if [[ ! -f "$NAMING_PROFILE" ]]; then
        cat > "$NAMING_PROFILE" << 'EOF'
{
  "version": "1.0.0",
  "last_updated": null,
  "samples_count": 0,
  "languages": {},
  "file_naming": {
    "snake_case": 0,
    "kebab-case": 0,
    "PascalCase": 0,
    "camelCase": 0,
    "mixed": 0
  },
  "detected_patterns": {
    "functions": {},
    "classes": {},
    "variables": {},
    "constants": {},
    "types": {}
  }
}
EOF
    fi
    cat "$NAMING_PROFILE"
}

# Update profile with new observations (uses atomic_json_update for multi-instance safety)
update_profile() {
    local language="$1"
    local file_naming="$2"
    local func_cases="$3"
    local class_cases="$4"
    local var_cases="$5"
    local const_cases="$6"
    local type_cases="$7"

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Parse case counts - use exact match with | boundaries
    parse_case_count() {
        local cases="$1"
        local case_name="$2"
        # Extract value using | as delimiter, match exactly case_name:N
        local result
        result=$(echo "|$cases|" | grep -oE "\|${case_name}:[0-9]+\|" | head -1 | tr -d '|' | cut -d: -f2)
        echo "${result:-0}" | tr -d '[:space:]'
    }

    local func_camel
    func_camel=$(parse_case_count "$func_cases" "camelCase")
    local func_snake
    func_snake=$(parse_case_count "$func_cases" "snake_case")
    local func_pascal
    func_pascal=$(parse_case_count "$func_cases" "PascalCase")

    local class_pascal
    class_pascal=$(parse_case_count "$class_cases" "PascalCase")
    local class_camel
    class_camel=$(parse_case_count "$class_cases" "camelCase")

    local var_camel
    var_camel=$(parse_case_count "$var_cases" "camelCase")
    local var_snake
    var_snake=$(parse_case_count "$var_cases" "snake_case")

    local const_screaming
    const_screaming=$(parse_case_count "$const_cases" "SCREAMING_SNAKE_CASE")
    local const_snake
    const_snake=$(parse_case_count "$const_cases" "snake_case")

    local type_pascal=$(parse_case_count "$type_cases" "PascalCase")

    # Build jq filter for atomic update
    local jq_filter='
       .last_updated = $ts |
       .samples_count += 1 |

       # Update file naming counts
       .file_naming[$file_naming] //= 0 |
       .file_naming[$file_naming] += 1 |

       # Initialize language entry if not exists
       .languages[$lang] //= {
         "samples": 0,
         "functions": { "camelCase": 0, "snake_case": 0, "PascalCase": 0 },
         "classes": { "PascalCase": 0, "camelCase": 0, "snake_case": 0 },
         "variables": { "camelCase": 0, "snake_case": 0 },
         "constants": { "SCREAMING_SNAKE_CASE": 0, "snake_case": 0 },
         "types": { "PascalCase": 0, "camelCase": 0 }
       } |

       # Update language-specific counts
       .languages[$lang].samples += 1 |
       .languages[$lang].functions.camelCase += $func_camel |
       .languages[$lang].functions.snake_case += $func_snake |
       .languages[$lang].functions.PascalCase += $func_pascal |
       .languages[$lang].classes.PascalCase += $class_pascal |
       .languages[$lang].classes.camelCase += $class_camel |
       .languages[$lang].variables.camelCase += $var_camel |
       .languages[$lang].variables.snake_case += $var_snake |
       .languages[$lang].constants.SCREAMING_SNAKE_CASE += $const_screaming |
       .languages[$lang].constants.snake_case += $const_snake |
       .languages[$lang].types.PascalCase += $type_pascal
    '

    # Use atomic_json_update for multi-instance safe write
    atomic_json_update "$NAMING_PROFILE" "$jq_filter" \
       --arg lang "$language" \
       --arg file_naming "$file_naming" \
       --argjson func_camel "${func_camel:-0}" \
       --argjson func_snake "${func_snake:-0}" \
       --argjson func_pascal "${func_pascal:-0}" \
       --argjson class_pascal "${class_pascal:-0}" \
       --argjson class_camel "${class_camel:-0}" \
       --argjson var_camel "${var_camel:-0}" \
       --argjson var_snake "${var_snake:-0}" \
       --argjson const_screaming "${const_screaming:-0}" \
       --argjson const_snake "${const_snake:-0}" \
       --argjson type_pascal "${type_pascal:-0}" \
       --arg ts "$timestamp"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Extract file path
    local file_path
    file_path=$(get_field '.tool_input.file_path // ""')

    if [[ -z "$file_path" ]]; then
        output_silent_success
        exit 0
    fi

    # Get file extension to determine language
    local ext="${file_path##*.}"
    local language=""

    case "$ext" in
        py) language="python" ;;
        ts|tsx) language="typescript" ;;
        js|jsx) language="javascript" ;;
        go) language="go" ;;
        rs) language="rust" ;;
        java) language="java" ;;
        *)
            output_silent_success
            exit 0
            ;;
    esac

    # Try to get file content from tool_input or read the file
    local content=""
    content=$(get_field '.tool_input.content // ""')

    if [[ -z "$content" && -f "${CLAUDE_PROJECT_DIR:-.}/$file_path" ]]; then
        content=$(head -150 "${CLAUDE_PROJECT_DIR:-.}/$file_path" 2>/dev/null) || true
    fi

    if [[ -z "$content" ]]; then
        output_silent_success
        exit 0
    fi

    # Detect file naming convention
    local file_naming
    file_naming=$(detect_file_naming "$file_path")

    # Extract identifiers based on language
    local identifiers=""
    case "$language" in
        python)
            identifiers=$(extract_python_identifiers "$content")
            ;;
        typescript|javascript)
            identifiers=$(extract_js_identifiers "$content")
            ;;
        go)
            identifiers=$(extract_go_identifiers "$content")
            ;;
        *)
            # Generic extraction - just look for common patterns
            identifiers="functions:|classes:|variables:|constants:|types:"
            ;;
    esac

    # Extract specific identifier lists
    local funcs=""
    local classes=""
    local vars=""
    local consts=""
    local types=""

    while IFS= read -r line; do
        case "$line" in
            functions:*) funcs="${line#functions:}" ;;
            classes:*) classes="${line#classes:}" ;;
            variables:*) vars="${line#variables:}" ;;
            constants:*) consts="${line#constants:}" ;;
            types:*|interfaces:*) types="${types}${line#*:}" ;;
        esac
    done <<< "$identifiers"

    # Count naming cases
    local func_cases
    func_cases=$(count_cases "$funcs")

    local class_cases
    class_cases=$(count_cases "$classes")

    local var_cases
    var_cases=$(count_cases "$vars")

    local const_cases
    const_cases=$(count_cases "$consts")

    local type_cases
    type_cases=$(count_cases "$types")

    # Load and update profile
    load_profile > /dev/null
    update_profile "$language" "$file_naming" "$func_cases" "$class_cases" \
                   "$var_cases" "$const_cases" "$type_cases"

    log_naming "Analyzed $language file ($file_path): file=$file_naming"

    # Store learned pattern in Memory Fabric for cross-project learning (v2.1)
    if type store_learned_pattern &>/dev/null; then
        # Determine dominant naming styles for summary
        local func_dominant=""
        local var_dominant=""
        local class_dominant=""

        # Extract dominant function naming style
        local func_snake func_camel
        func_snake=$(echo "$func_cases" | grep -oE 'snake_case:[0-9]+' | head -1 | cut -d: -f2 || echo "0")
        func_camel=$(echo "$func_cases" | grep -oE 'camelCase:[0-9]+' | head -1 | cut -d: -f2 || echo "0")
        if [[ "$func_snake" -gt "$func_camel" && "$func_snake" -gt 0 ]]; then
            func_dominant="snake_case"
        elif [[ "$func_camel" -gt 0 ]]; then
            func_dominant="camelCase"
        fi

        # Extract dominant variable naming style
        local var_snake var_camel
        var_snake=$(echo "$var_cases" | grep -oE 'snake_case:[0-9]+' | head -1 | cut -d: -f2 || echo "0")
        var_camel=$(echo "$var_cases" | grep -oE 'camelCase:[0-9]+' | head -1 | cut -d: -f2 || echo "0")
        if [[ "$var_snake" -gt "$var_camel" && "$var_snake" -gt 0 ]]; then
            var_dominant="snake_case"
        elif [[ "$var_camel" -gt 0 ]]; then
            var_dominant="camelCase"
        fi

        # Extract dominant class naming style
        local class_pascal
        class_pascal=$(echo "$class_cases" | grep -oE 'PascalCase:[0-9]+' | head -1 | cut -d: -f2 || echo "0")
        if [[ "$class_pascal" -gt 0 ]]; then
            class_dominant="PascalCase"
        fi

        # Build pattern summary
        local pattern_summary="${language}: files=${file_naming}"
        if [[ -n "$func_dominant" ]]; then
            pattern_summary="${pattern_summary} functions=${func_dominant}"
        fi
        if [[ -n "$var_dominant" ]]; then
            pattern_summary="${pattern_summary} variables=${var_dominant}"
        fi
        if [[ -n "$class_dominant" ]]; then
            pattern_summary="${pattern_summary} classes=${class_dominant}"
        fi

        store_learned_pattern "naming_convention" "$pattern_summary" "success" 2>/dev/null || true
    fi

    output_silent_success
}

main "$@"

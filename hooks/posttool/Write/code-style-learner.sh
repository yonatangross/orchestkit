#!/usr/bin/env bash
# code-style-learner.sh - Learn user's code style preferences from written code
# Hook: PostToolUse/Write (#133)
# CC 2.1.7 Compliant
#
# Tracks:
# - Indentation (tabs vs spaces, indent size)
# - Quote style (single vs double quotes)
# - Naming patterns (detected from code)
# - Import order (stdlib first, third-party, local)
#
# Storage: .claude/feedback/code-style-profile.json
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

STYLE_PROFILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/code-style-profile.json"
LOG_FILE="${HOOK_LOG_DIR}/code-style-learner.log"

# Ensure directories exist
mkdir -p "$(dirname "$STYLE_PROFILE")" 2>/dev/null || true

log_style() {
    log_hook "code-style-learner: $*"
}

# -----------------------------------------------------------------------------
# Style Detection Functions
# -----------------------------------------------------------------------------

# Detect indentation style from code content
detect_indentation() {
    local content="$1"
    local language="$2"

    # Count lines starting with tabs vs spaces
    local tab_count=0
    local space_count=0
    local space_2=0
    local space_4=0

    while IFS= read -r line; do
        if [[ "$line" =~ ^$'\t' ]]; then
            ((tab_count++)) || true
        elif [[ "$line" =~ ^'    ' ]]; then
            ((space_4++)) || true
            ((space_count++)) || true
        elif [[ "$line" =~ ^'  '[^' '] ]]; then
            ((space_2++)) || true
            ((space_count++)) || true
        fi
    done <<< "$content"

    local style="unknown"
    local size=4

    if [[ $tab_count -gt $space_count ]]; then
        style="tabs"
        size=1
    elif [[ $space_count -gt 0 ]]; then
        style="spaces"
        if [[ $space_2 -gt $space_4 ]]; then
            size=2
        else
            size=4
        fi
    fi

    echo "${style}|${size}"
}

# Detect quote style from code content
detect_quote_style() {
    local content="$1"
    local language="$2"

    local single_count=0
    local double_count=0

    # Count string literals (simple heuristic)
    single_count=$(echo "$content" | grep -o "'" | wc -l | tr -d ' ')
    double_count=$(echo "$content" | grep -o '"' | wc -l | tr -d ' ')

    local style="double"
    if [[ $single_count -gt $double_count ]]; then
        style="single"
    fi

    echo "$style"
}

# Detect semicolon usage (JS/TS)
detect_semicolon_style() {
    local content="$1"

    # Count lines ending with semicolons vs without
    local with_semi=0
    local without_semi=0

    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*// || "$line" =~ ^[[:space:]]*\* ]] && continue

        if [[ "$line" =~ \;[[:space:]]*$ ]]; then
            ((with_semi++)) || true
        elif [[ "$line" =~ [a-zA-Z0-9\)\]\'\"][[:space:]]*$ ]]; then
            ((without_semi++)) || true
        fi
    done <<< "$content"

    if [[ $with_semi -gt $without_semi ]]; then
        echo "always"
    else
        echo "omit"
    fi
}

# Detect trailing comma preference (JS/TS/Python)
detect_trailing_comma() {
    local content="$1"

    # Look for patterns like "],\n}" or "}\n]" (trailing comma before closing bracket)
    local trailing_count=0
    local no_trailing_count=0

    # Count commas followed by closing brackets
    trailing_count=$(echo "$content" | grep -c ',[[:space:]]*$' 2>/dev/null | tr -d '[:space:]' || echo 0)
    trailing_count=${trailing_count:-0}

    if [[ $trailing_count -gt 5 ]]; then
        echo "always"
    else
        echo "minimal"
    fi
}

# Detect Python-specific patterns
detect_python_patterns() {
    local content="$1"

    local type_hints="false"
    local docstring_style="unknown"

    # Check for type hints
    if echo "$content" | grep -qE '\) -> |: [A-Z][a-zA-Z]+(\[|$| =)'; then
        type_hints="true"
    fi

    # Check docstring style
    if echo "$content" | grep -qE '"""[^"]+"""'; then
        if echo "$content" | grep -qE ':param |:returns:|:raises:'; then
            docstring_style="sphinx"
        elif echo "$content" | grep -qE 'Args:|Returns:|Raises:'; then
            docstring_style="google"
        elif echo "$content" | grep -qE 'Parameters|Returns\n-+'; then
            docstring_style="numpy"
        else
            docstring_style="simple"
        fi
    fi

    echo "${type_hints}|${docstring_style}"
}

# -----------------------------------------------------------------------------
# Profile Management
# -----------------------------------------------------------------------------

# Initialize or load style profile
load_profile() {
    if [[ ! -f "$STYLE_PROFILE" ]]; then
        cat > "$STYLE_PROFILE" << 'EOF'
{
  "version": "1.0.0",
  "last_updated": null,
  "samples_count": 0,
  "languages": {},
  "global_preferences": {
    "indentation": { "style": "unknown", "size": 4, "confidence": 0 },
    "quotes": { "style": "unknown", "confidence": 0 }
  }
}
EOF
    fi
    cat "$STYLE_PROFILE"
}

# Update profile with new observations (uses atomic_json_update for multi-instance safety)
update_profile() {
    local language="$1"
    local indent_style="$2"
    local indent_size="$3"
    local quote_style="$4"
    local semi_style="$5"
    local trailing_comma="$6"
    local type_hints="$7"
    local docstring_style="$8"

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Build jq filter for atomic update
    local jq_filter='
       .last_updated = $ts |
       .samples_count += 1 |

       # Initialize language entry if not exists
       .languages[$lang] //= {
         "samples": 0,
         "indentation": { "tabs": 0, "spaces_2": 0, "spaces_4": 0 },
         "quotes": { "single": 0, "double": 0 },
         "semicolons": { "always": 0, "omit": 0 },
         "trailing_comma": { "always": 0, "minimal": 0 },
         "type_hints": { "used": 0, "not_used": 0 },
         "docstring_style": {}
       } |

       # Update language-specific counts
       .languages[$lang].samples += 1 |

       # Indentation
       (if $indent == "tabs" then
         .languages[$lang].indentation.tabs += 1
       elif $size == 2 then
         .languages[$lang].indentation.spaces_2 += 1
       else
         .languages[$lang].indentation.spaces_4 += 1
       end) |

       # Quotes
       (if $quote == "single" then
         .languages[$lang].quotes.single += 1
       else
         .languages[$lang].quotes.double += 1
       end) |

       # Semicolons (JS/TS only)
       (if $semi != "unknown" then
         (if $semi == "always" then
           .languages[$lang].semicolons.always += 1
         else
           .languages[$lang].semicolons.omit += 1
         end)
       else . end) |

       # Trailing comma
       (if $trail != "unknown" then
         (if $trail == "always" then
           .languages[$lang].trailing_comma.always += 1
         else
           .languages[$lang].trailing_comma.minimal += 1
         end)
       else . end) |

       # Type hints (Python)
       (if $hints == "true" then
         .languages[$lang].type_hints.used += 1
       elif $hints == "false" then
         .languages[$lang].type_hints.not_used += 1
       else . end) |

       # Docstring style (Python)
       (if $docs != "unknown" and $docs != "" then
         .languages[$lang].docstring_style[$docs] //= 0 |
         .languages[$lang].docstring_style[$docs] += 1
       else . end)
    '

    # Use atomic_json_update for multi-instance safe write
    atomic_json_update "$STYLE_PROFILE" "$jq_filter" \
       --arg lang "$language" \
       --arg indent "$indent_style" \
       --argjson size "$indent_size" \
       --arg quote "$quote_style" \
       --arg semi "$semi_style" \
       --arg trail "$trailing_comma" \
       --arg hints "$type_hints" \
       --arg docs "$docstring_style" \
       --arg ts "$timestamp"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Extract file path and content
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
        content=$(head -100 "${CLAUDE_PROJECT_DIR:-.}/$file_path" 2>/dev/null) || true
    fi

    if [[ -z "$content" ]]; then
        output_silent_success
        exit 0
    fi

    # Analyze the code
    local indent_info
    indent_info=$(detect_indentation "$content" "$language")
    local indent_style="${indent_info%%|*}"
    local indent_size="${indent_info##*|}"

    local quote_style
    quote_style=$(detect_quote_style "$content" "$language")

    local semi_style="unknown"
    local trailing_comma="unknown"
    local type_hints="unknown"
    local docstring_style="unknown"

    # Language-specific detection
    case "$language" in
        javascript|typescript)
            semi_style=$(detect_semicolon_style "$content")
            trailing_comma=$(detect_trailing_comma "$content")
            ;;
        python)
            local py_patterns
            py_patterns=$(detect_python_patterns "$content")
            type_hints="${py_patterns%%|*}"
            docstring_style="${py_patterns##*|}"
            trailing_comma=$(detect_trailing_comma "$content")
            ;;
    esac

    # Load and update profile
    load_profile > /dev/null
    update_profile "$language" "$indent_style" "$indent_size" "$quote_style" \
                   "$semi_style" "$trailing_comma" "$type_hints" "$docstring_style"

    log_style "Analyzed $language file: indent=$indent_style($indent_size) quotes=$quote_style"

    # Store learned pattern in Memory Fabric for cross-project learning (v2.1)
    if type store_learned_pattern &>/dev/null; then
        local pattern_summary="${language}: indent=${indent_style}(${indent_size}) quotes=${quote_style}"
        if [[ "$semi_style" != "unknown" ]]; then
            pattern_summary="${pattern_summary} semicolons=${semi_style}"
        fi
        if [[ "$trailing_comma" != "unknown" ]]; then
            pattern_summary="${pattern_summary} trailing_comma=${trailing_comma}"
        fi
        if [[ "$type_hints" == "true" ]]; then
            pattern_summary="${pattern_summary} type_hints=enabled"
        fi
        if [[ "$docstring_style" != "unknown" ]]; then
            pattern_summary="${pattern_summary} docstring=${docstring_style}"
        fi
        store_learned_pattern "code_style" "$pattern_summary" "success" 2>/dev/null || true
    fi

    output_silent_success
}

main "$@"

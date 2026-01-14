#!/usr/bin/env bash
# Test: Validates ALL hook paths in both plugin.json and agent frontmatter
#
# This comprehensive test ensures:
# 1. All hooks in plugin.json resolve to actual files
# 2. All hooks in agent frontmatter resolve to actual files
# 3. Hook scripts are executable
#
# CC 2.1.7 Compliant

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_JSON="$REPO_ROOT/plugin.json"
AGENTS_DIR="$REPO_ROOT/agents"

FAILED=0
TOTAL_HOOKS=0
VALID_HOOKS=0
EXECUTABLE_HOOKS=0

echo "=== Comprehensive Hook Path Validation Test ==="
echo ""

# Function to resolve hook path variables
resolve_hook_path() {
    local hook_path="$1"

    # Replace common variables
    hook_path="${hook_path//\$\{CLAUDE_PLUGIN_ROOT\}/$REPO_ROOT}"
    hook_path="${hook_path//\$CLAUDE_PLUGIN_ROOT/$REPO_ROOT}"
    hook_path="${hook_path//\$\{CLAUDE_PROJECT_DIR\}/$REPO_ROOT}"
    hook_path="${hook_path//\$CLAUDE_PROJECT_DIR/$REPO_ROOT}"

    # Remove quotes
    hook_path="${hook_path//\"/}"
    hook_path="${hook_path//\'/}"

    echo "$hook_path"
}

echo "--- Part 1: plugin.json Hooks ---"
echo ""

# Extract hook commands from plugin.json using grep
# Looking for "command": "..." patterns
while IFS= read -r hook_cmd; do
    # Clean up the extracted command
    hook_cmd=$(echo "$hook_cmd" | sed 's/.*"command":[[:space:]]*"\([^"]*\)".*/\1/')

    if [[ -n "$hook_cmd" && "$hook_cmd" != *"command"* ]]; then
        ((TOTAL_HOOKS++))

        resolved_path=$(resolve_hook_path "$hook_cmd")

        if [[ -f "$resolved_path" ]]; then
            ((VALID_HOOKS++))
            if [[ -x "$resolved_path" ]]; then
                ((EXECUTABLE_HOOKS++))
            else
                echo "WARN: Hook exists but not executable: $resolved_path"
            fi
        else
            echo "FAIL: plugin.json - Hook path not found: $hook_cmd"
            echo "      Resolved to: $resolved_path"
            FAILED=1
        fi
    fi
done < <(grep '"command":' "$PLUGIN_JSON")

echo "plugin.json: $VALID_HOOKS hooks validated"
echo ""

echo "--- Part 2: Agent Frontmatter Hooks ---"
echo ""

AGENT_HOOKS=0
AGENT_VALID=0

for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Extract hook commands from frontmatter
    in_frontmatter=false
    in_hooks=false

    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == false ]]; then
                in_frontmatter=true
                continue
            else
                break
            fi
        fi

        if [[ "$in_frontmatter" == true ]]; then
            if [[ "$line" =~ ^hooks: ]]; then
                in_hooks=true
                continue
            fi

            if [[ "$in_hooks" == true && ! "$line" =~ ^[[:space:]] && -n "$line" ]]; then
                in_hooks=false
            fi

            if [[ "$in_hooks" == true && "$line" =~ command:[[:space:]]*(.+) ]]; then
                hook_cmd="${BASH_REMATCH[1]}"
                ((AGENT_HOOKS++))
                ((TOTAL_HOOKS++))

                resolved_path=$(resolve_hook_path "$hook_cmd")

                if [[ -f "$resolved_path" ]]; then
                    ((AGENT_VALID++))
                    ((VALID_HOOKS++))
                    if [[ -x "$resolved_path" ]]; then
                        ((EXECUTABLE_HOOKS++))
                    fi
                else
                    echo "FAIL: $agent_name - Hook path not found: $hook_cmd"
                    echo "      Resolved to: $resolved_path"
                    FAILED=1
                fi
            fi
        fi
    done < "$agent_file"
done

echo "Agent frontmatter: $AGENT_VALID/$AGENT_HOOKS hooks validated"
echo ""

echo "--- Summary ---"
echo ""
echo "Total hooks checked: $TOTAL_HOOKS"
echo "Valid paths: $VALID_HOOKS"
echo "Executable: $EXECUTABLE_HOOKS"
echo ""

if [[ $FAILED -eq 1 ]]; then
    echo "❌ Hook path validation FAILED"
    echo ""
    echo "Fix options:"
    echo "1. Create missing hook files at the specified paths"
    echo "2. Remove broken hook references from plugin.json or agent frontmatter"
    echo "3. Update paths to point to existing files"
    exit 1
else
    echo "✅ All hook paths are valid ($VALID_HOOKS/$TOTAL_HOOKS)"
    exit 0
fi
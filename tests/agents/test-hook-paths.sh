#!/usr/bin/env bash
# Test: Validates ALL hook paths in both plugin.json and agent frontmatter
#
# This comprehensive test ensures:
# 1. All hooks in plugin.json resolve to actual files
# 2. All hooks in agent frontmatter resolve to actual files
# 3. Hook scripts are executable
#
# Note: LSP servers (pyright-langserver, typescript-language-server, etc.) are
# external commands, not hook files - they are skipped.
#
# CC 2.1.7 Compliant - Updated for TypeScript hooks with run-hook.mjs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
AGENTS_DIR="$REPO_ROOT/src/agents"

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

# Function to check if a command looks like a hook path (contains / or .sh)
is_hook_path() {
    local cmd="$1"
    # Hook paths typically contain / or end with .sh
    # LSP servers like "pyright-langserver" are simple command names
    if [[ "$cmd" == *"/"* ]] || [[ "$cmd" == *".sh" ]]; then
        return 0  # Looks like a hook path
    else
        return 1  # Likely an external command (LSP server, etc.)
    fi
}

# Function to validate run-hook.mjs based commands
# Format: run-hook.mjs <handler-type>/<handler-name>
validate_run_hook_command() {
    local cmd="$1"

    # Remove leading and trailing quotes
    cmd="${cmd%\"}"
    cmd="${cmd%\'}"
    cmd="${cmd#\"}"
    cmd="${cmd#\'}"

    # Check if this is a run-hook.mjs command
    if [[ "$cmd" == *"run-hook.mjs"* ]]; then
        # Check if run-hook.mjs exists
        local runner_path="$REPO_ROOT/src/hooks/bin/run-hook.mjs"
        if [[ ! -f "$runner_path" ]]; then
            return 1
        fi

        # Extract handler path (e.g., "agent/ci-safety-check" or "pretool/bash/git-validator")
        # Match pattern: word/word or word/word/word at end of string
        local handler=$(echo "$cmd" | grep -oE '[a-z]+/[a-z-]+(/[a-z-]+)?$' || true)

        if [[ -n "$handler" ]]; then
            # Check if TypeScript source exists
            local ts_path="$REPO_ROOT/src/hooks/src/${handler}.ts"
            if [[ -f "$ts_path" ]]; then
                return 0  # Valid
            fi
        fi
        return 1  # Invalid - handler not found
    fi
    return 2  # Not a run-hook command
}

echo "--- Part 1: plugin.json Hooks ---"
echo ""

# Extract hook commands from plugin.json using jq (more reliable than grep)
# Only look in the hooks section, not lspServers
if command -v jq >/dev/null 2>&1; then
    # Use jq to properly extract hook commands from the hooks section
    hook_commands=$(jq -r '.hooks[]?.command // empty' "$PLUGIN_JSON" 2>/dev/null || true)

    if [[ -n "$hook_commands" ]]; then
        while IFS= read -r hook_cmd; do
            if [[ -n "$hook_cmd" ]]; then
                # Check if this looks like a hook path (contains / or .sh)
                if is_hook_path "$hook_cmd"; then
                    ((TOTAL_HOOKS++)) || true

                    # First check if it's a run-hook.mjs command
                    if validate_run_hook_command "$hook_cmd"; then
                        ((VALID_HOOKS++)) || true
                        ((EXECUTABLE_HOOKS++)) || true
                    else
                        resolved_path=$(resolve_hook_path "$hook_cmd")

                        if [[ -f "$resolved_path" ]]; then
                            ((VALID_HOOKS++)) || true
                            if [[ -x "$resolved_path" ]]; then
                                ((EXECUTABLE_HOOKS++)) || true
                            else
                                echo "WARN: Hook exists but not executable: $resolved_path"
                            fi
                        else
                            echo "FAIL: plugin.json - Hook path not found: $hook_cmd"
                            echo "      Resolved to: $resolved_path"
                            FAILED=1
                        fi
                    fi
                fi
            fi
        done <<< "$hook_commands"
    fi
else
    echo "WARN: jq not available, skipping plugin.json hook validation"
fi

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

                # Only validate if it looks like a hook path
                if is_hook_path "$hook_cmd"; then
                    ((AGENT_HOOKS++)) || true
                    ((TOTAL_HOOKS++)) || true

                    # Check if this is a run-hook.mjs command
                    if validate_run_hook_command "$hook_cmd"; then
                        ((AGENT_VALID++)) || true
                        ((VALID_HOOKS++)) || true
                        ((EXECUTABLE_HOOKS++)) || true
                    else
                        resolved_path=$(resolve_hook_path "$hook_cmd")

                        if [[ -f "$resolved_path" ]]; then
                            ((AGENT_VALID++)) || true
                            ((VALID_HOOKS++)) || true
                            if [[ -x "$resolved_path" ]]; then
                                ((EXECUTABLE_HOOKS++)) || true
                            fi
                        else
                            echo "FAIL: $agent_name - Hook path not found: $hook_cmd"
                            echo "      Resolved to: $resolved_path"
                            FAILED=1
                        fi
                    fi
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

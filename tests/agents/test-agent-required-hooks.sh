#!/usr/bin/env bash
# Test: Validates agent hook paths resolve to actual files
#
# This test ensures that any hooks defined in agent frontmatter
# actually exist at the specified paths. Dead/broken hook paths
# waste tokens and provide no functionality.
#
# CC 2.1.7 Compliant

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

FAILED=0
TOTAL_HOOKS=0
VALID_HOOKS=0

echo "=== Agent Hook Path Validation Test ==="
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

for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)
    agent_errors=0

    # Extract hook commands from frontmatter (between --- markers)
    # Look for lines with 'command:' in the hooks section
    in_frontmatter=false
    in_hooks=false

    while IFS= read -r line; do
        # Track frontmatter boundaries
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == false ]]; then
                in_frontmatter=true
                continue
            else
                break  # End of frontmatter
            fi
        fi

        # Track hooks section
        if [[ "$in_frontmatter" == true ]]; then
            if [[ "$line" =~ ^hooks: ]]; then
                in_hooks=true
                continue
            fi

            # Check if we've left hooks section (non-indented line that's not a hook directive)
            if [[ "$in_hooks" == true && ! "$line" =~ ^[[:space:]] && -n "$line" ]]; then
                in_hooks=false
            fi

            # Extract command paths
            if [[ "$in_hooks" == true && "$line" =~ command:[[:space:]]*(.+) ]]; then
                hook_cmd="${BASH_REMATCH[1]}"
                ((TOTAL_HOOKS++)) || true

                # First try to validate as run-hook.mjs command
                if validate_run_hook_command "$hook_cmd"; then
                    ((VALID_HOOKS++)) || true
                else
                    # Fallback to file path resolution
                    resolved_path=$(resolve_hook_path "$hook_cmd")

                    if [[ -f "$resolved_path" ]]; then
                        ((VALID_HOOKS++)) || true
                    else
                        echo "FAIL: $agent_name - Hook path not found: $hook_cmd"
                        echo "      Resolved to: $resolved_path"
                        agent_errors=1
                        FAILED=1
                    fi
                fi
            fi
        fi
    done < "$agent_file"

    if [[ $agent_errors -eq 0 ]]; then
        # Count hooks for this agent
        hook_count=$(grep -c "command:" "$agent_file" 2>/dev/null || true); hook_count=${hook_count:-0}
        if [[ $hook_count -gt 0 ]]; then
            echo "PASS: $agent_name ($hook_count hooks validated)"
        else
            echo "PASS: $agent_name (no agent-specific hooks)"
        fi
    fi
done

echo ""
echo "Summary: $VALID_HOOKS/$TOTAL_HOOKS hook paths validated"
echo ""

if [[ $FAILED -eq 1 ]]; then
    echo "❌ Agent hook path validation FAILED"
    echo ""
    echo "Fix: Either create the missing hook files or remove the broken hook references."
    exit 1
else
    echo "✅ All agent hook paths are valid"
    exit 0
fi
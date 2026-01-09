#!/bin/bash
# Conflict Predictor - PreToolUse Hook for Bash
# CC 2.1.2 Compliant: includes continue field in all outputs
# Warns before git commit if potential conflicts exist with other worktrees
#
# Triggers on: git commit commands
# Action: WARN (does not block, just informs)
#
# Version: 1.0.0
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source coordination lib if available
if [[ -f "$SCRIPT_DIR/../../_lib/coordination.sh" ]]; then
    source "$SCRIPT_DIR/../../_lib/coordination.sh"
else
    echo '{"continue": true}'
    exit 0
fi

# Parse input
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check for git commit commands
if ! echo "$COMMAND" | grep -qE '^git\s+commit'; then
    echo '{"continue": true}'
    exit 0
fi

# Get coordination directory
COORD_DIR=$(get_coordination_dir)

if [[ ! -f "$COORD_DIR/registry.json" ]]; then
    echo '{"continue": true}'
    exit 0
fi

REGISTRY=$(cat "$COORD_DIR/registry.json")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
INSTANCE_ID=$(get_instance_id)

if [[ -z "$CURRENT_BRANCH" ]]; then
    echo '{"continue": true}'
    exit 0
fi

# Get other active branches
OTHER_BRANCHES=$(echo "$REGISTRY" | jq -r --arg current "$CURRENT_BRANCH" --arg id "$INSTANCE_ID" \
    '.instances | to_entries[] | select(.key != $id and .value.branch != $current) | .value.branch')

if [[ -z "$OTHER_BRANCHES" ]]; then
    echo '{"continue": true}'
    exit 0
fi

# Check for conflicts with each active branch
CONFLICTS=""

for branch in $OTHER_BRANCHES; do
    # Check if branch exists locally
    if ! git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
        continue
    fi

    # Get merge base
    MERGE_BASE=$(git merge-base HEAD "$branch" 2>/dev/null || echo "")
    if [[ -z "$MERGE_BASE" ]]; then
        continue
    fi

    # Check for conflicts using merge-tree
    CONFLICT_OUTPUT=$(git merge-tree "$MERGE_BASE" HEAD "$branch" 2>/dev/null || echo "")
    if echo "$CONFLICT_OUTPUT" | grep -qE '^<<<<<<<'; then
        CONFLICTS="$CONFLICTS  - $branch\n"
    fi
done

# If conflicts found, output warning (but don't block)
if [[ -n "$CONFLICTS" ]]; then
    echo "" >&2
    echo "+-------------------------------------------------------------------+" >&2
    echo "|  WARNING: POTENTIAL MERGE CONFLICTS DETECTED                      |" >&2
    echo "+-------------------------------------------------------------------+" >&2
    echo "|  Your branch may conflict with these active worktrees:            |" >&2
    echo -e "$CONFLICTS" | while read -r line; do
        printf "|  %-63s |\n" "$line" >&2
    done
    echo "|                                                                   |" >&2
    echo "|  Consider running: cc-worktree-sync --check-conflicts             |" >&2
    echo "+-------------------------------------------------------------------+" >&2
    echo "" >&2
fi

# Always allow the commit (this is just a warning)
# Output systemMessage for user visibility
echo '{"systemMessage":"Conflicts predicted","continue":true}'
exit 0
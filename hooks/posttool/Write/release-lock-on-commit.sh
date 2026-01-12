#!/bin/bash
# Release Lock on Commit - PostToolUse Hook
# Releases file locks after successful git commit
#
# Triggers on: Bash with git commit that succeeded
# Action: Release locks on committed files
#
# Version: 1.0.0
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source coordination lib if available
if [[ -f "$SCRIPT_DIR/../../_lib/coordination.sh" ]]; then
    source "$SCRIPT_DIR/../../_lib/coordination.sh"
else
    exit 0
fi

# This hook runs after Write tool - we don't release locks here
# Locks are released on session end or explicit release

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0

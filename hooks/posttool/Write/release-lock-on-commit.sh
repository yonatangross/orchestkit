#!/bin/bash
# Release Lock on Commit - PostToolUse Hook
# Releases file locks after successful git commit
#
# Triggers on: Bash with git commit that succeeded
# Action: Release locks on committed files
# CC 2.1.7 Compliant: Proper JSON output
#
# Version: 1.0.1
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities for output functions
source "$SCRIPT_DIR/../../_lib/common.sh"

# Source coordination lib if available
if [[ -f "$SCRIPT_DIR/../../_lib/coordination.sh" ]]; then
    source "$SCRIPT_DIR/../../_lib/coordination.sh"
else
    output_silent_success
    exit 0
fi

# This hook runs after Write tool - we don't release locks here
# Locks are released on session end or explicit release

# CC 2.1.7: Silent success
output_silent_success
exit 0

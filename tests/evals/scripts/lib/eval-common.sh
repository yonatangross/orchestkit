#!/bin/bash
# =============================================================================
# OrchestKit Eval Common Library
# =============================================================================
# Shared code between run-trigger-eval.sh and run-quality-eval.sh.
# Source this file at the top of each runner:
#   source "$SCRIPT_DIR/lib/eval-common.sh"
#
# Provides:
#   - set -uo pipefail
#   - Color variables
#   - CLEANUP_FILES array, cleanup(), trap
#   - check_deps()
#   - unset CLAUDECODE
#   - SKILL_NAME_RE validation regex
#   - run_with_timeout() portable timeout wrapper
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Cleanup (Ctrl+C safe)
# ---------------------------------------------------------------------------
CLEANUP_FILES=()
CLEANUP_DIRS=()
cleanup() {
    rm -f "${CLEANUP_FILES[@]}" 2>/dev/null
    rm -rf "${CLEANUP_DIRS[@]}" 2>/dev/null
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Skill name validation regex (SEC-001: prevent path traversal)
# ---------------------------------------------------------------------------
SKILL_NAME_RE='^[a-z0-9][a-z0-9-]*$'

# ---------------------------------------------------------------------------
# Ensure we are not inside a Claude Code session
# ---------------------------------------------------------------------------
unset CLAUDECODE 2>/dev/null || true

# ---------------------------------------------------------------------------
# Dependency checker
# ---------------------------------------------------------------------------
# Requires DRY_RUN to be set by the sourcing script before calling.
check_deps() {
    if ! command -v yq &> /dev/null; then
        echo -e "${RED}Error: yq is required (brew install yq)${NC}"
        exit 1
    fi
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required (brew install jq)${NC}"
        exit 1
    fi
    if ! command -v bc &> /dev/null; then
        echo -e "${RED}Error: bc is required (brew install bc)${NC}"
        exit 1
    fi
    if [[ "$DRY_RUN" == "false" ]] && ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}Warning: Claude CLI not found -- switching to dry-run mode${NC}"
        DRY_RUN=true
    fi
}

# ---------------------------------------------------------------------------
# Portable timeout (A6)
# ---------------------------------------------------------------------------
# macOS does not ship GNU timeout. Try gtimeout (brew coreutils) first,
# then fall back to a perl one-liner.
if command -v gtimeout &> /dev/null; then
    run_with_timeout() {
        local seconds="$1"; shift
        gtimeout "$seconds" "$@"
    }
elif command -v timeout &> /dev/null; then
    run_with_timeout() {
        local seconds="$1"; shift
        timeout "$seconds" "$@"
    }
else
    run_with_timeout() {
        local seconds="$1"; shift
        perl -e '
            use POSIX ":sys_wait_h";
            $SIG{ALRM} = sub { kill 9, $pid if $pid; exit 124; };
            alarm shift @ARGV;
            $pid = fork // die "fork: $!";
            if ($pid == 0) { exec @ARGV or die "exec: $!"; }
            waitpid($pid, 0);
            alarm 0;
            exit($? >> 8);
        ' "$seconds" "$@"
    }
fi

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
#   - BARE_MODE (CC 2.1.81: skip hooks/LSP for -p calls)
#   - GRADING_MODEL (Haiku by default, 12x cheaper than Sonnet)
#   - Content hash cache: compute_content_hash(), check_eval_cache(), save_eval_cache()
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
# Bare mode (CC 2.1.81+): skip hooks/LSP/plugin sync for faster -p calls.
# Requires ANTHROPIC_API_KEY (OAuth/keychain disabled in bare mode).
# ---------------------------------------------------------------------------
BARE_MODE=false
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    BARE_MODE=true
fi

# ---------------------------------------------------------------------------
# Grading model: Haiku is 12x cheaper than Sonnet for PASS/FAIL grading.
# Override with EVAL_GRADING_MODEL env var.
# ---------------------------------------------------------------------------
GRADING_MODEL="${EVAL_GRADING_MODEL:-haiku}"

# ---------------------------------------------------------------------------
# Content hash cache: skip re-eval if SKILL.md + .eval.yaml unchanged.
# Cache stored in tests/evals/results/skills/{skill}.{type}.hash
# Use --force to bypass cache.
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CACHE_DIR="$REPO_ROOT/tests/evals/results/skills"

# Compute SHA256 of SKILL.md + .eval.yaml for a skill
compute_content_hash() {
    local skill_id="$1"
    local skill_md="$REPO_ROOT/src/skills/$skill_id/SKILL.md"
    local eval_yaml="$REPO_ROOT/tests/evals/skills/$skill_id.eval.yaml"
    local hash_input=""

    if [[ -f "$skill_md" ]]; then
        hash_input+=$(shasum -a 256 "$skill_md" 2>/dev/null | awk '{print $1}')
    fi
    if [[ -f "$eval_yaml" ]]; then
        hash_input+=$(shasum -a 256 "$eval_yaml" 2>/dev/null | awk '{print $1}')
    fi

    echo -n "$hash_input" | shasum -a 256 | awk '{print $1}'
}

# Check if cached result matches current content hash.
# Returns 0 (cache hit) or 1 (cache miss).
# Args: skill_id, eval_type (trigger|quality)
check_eval_cache() {
    local skill_id="$1"
    local eval_type="$2"
    local hash_file="$CACHE_DIR/${skill_id}.${eval_type}.hash"

    [[ -f "$hash_file" ]] || return 1

    local cached_hash; cached_hash=$(cat "$hash_file" 2>/dev/null)
    local current_hash; current_hash=$(compute_content_hash "$skill_id")

    [[ "$cached_hash" == "$current_hash" ]]
}

# Save content hash after successful eval.
save_eval_cache() {
    local skill_id="$1"
    local eval_type="$2"
    mkdir -p "$CACHE_DIR"
    compute_content_hash "$skill_id" > "$CACHE_DIR/${skill_id}.${eval_type}.hash"
}

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

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
# Fresh subagent context per `claude -p` call (CC 2.1.121+, #1545).
# Each generation + grading invocation gets a forked session so harness state
# (memory MCP cache, .claude/chain/*.json on disk, ToolSearch deferred-tool
# cache, model picker prefs) does NOT leak across eval runs. This eliminates
# the cross-eval state-leak class that produced ~5-10% flaky retries and
# non-reproducible scores. Older CC silently ignores the env var (no-op).
# ---------------------------------------------------------------------------
export CLAUDE_CODE_FORK_SUBAGENT="${CLAUDE_CODE_FORK_SUBAGENT:-1}"

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

# ---------------------------------------------------------------------------
# W3C Trace Context (CC 2.1.110+)
# ---------------------------------------------------------------------------
# CC 2.1.110 auto-reads TRACEPARENT and TRACESTATE env vars in SDK/headless
# sessions for OpenTelemetry distributed trace propagation. Each eval
# invocation becomes a child span of a parent eval run, enabling end-to-end
# correlation in Langfuse / OTel backends without per-script instrumentation.
#
# We generate one traceparent per eval script run and export it so every
# `claude -p` call inherits it. Each grading call within a script shares
# the same trace_id but gets a fresh span_id.
#
# Skip by setting ORK_SKIP_TRACE_CONTEXT=1.
# ---------------------------------------------------------------------------
ORK_EVAL_TRACE_ID=""
ORK_EVAL_PARENT_SPAN_ID=""

ensure_trace_context() {
    [[ "${ORK_SKIP_TRACE_CONTEXT:-0}" == "1" ]] && return 0

    # Already set by a parent eval run — inherit.
    if [[ -n "${TRACEPARENT:-}" ]]; then
        # Format: 00-<32-hex trace_id>-<16-hex parent_id>-<2-hex flags>
        ORK_EVAL_TRACE_ID="$(echo "$TRACEPARENT" | awk -F- '{print $2}')"
        ORK_EVAL_PARENT_SPAN_ID="$(echo "$TRACEPARENT" | awk -F- '{print $3}')"
        return 0
    fi

    # Generate new trace + span id. Portable hex RNG — /dev/urandom + od.
    ORK_EVAL_TRACE_ID="$(od -An -N16 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n')"
    ORK_EVAL_PARENT_SPAN_ID="$(od -An -N8 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n')"

    [[ -z "$ORK_EVAL_TRACE_ID" || -z "$ORK_EVAL_PARENT_SPAN_ID" ]] && return 0

    export TRACEPARENT="00-${ORK_EVAL_TRACE_ID}-${ORK_EVAL_PARENT_SPAN_ID}-01"
    export TRACESTATE="${TRACESTATE:-orchestkit=eval}"
    echo -e "${BLUE}  Trace context: trace_id=${ORK_EVAL_TRACE_ID} parent_span=${ORK_EVAL_PARENT_SPAN_ID}${NC}" >&2
}

# ---------------------------------------------------------------------------
# Plugin error preflight (CC 2.1.111+)
# ---------------------------------------------------------------------------
# CC 2.1.111 added a `plugin_errors` array to the init event emitted by
# `--output-format stream-json`. When a plugin fails to load, it shows up
# there. Previously, the error was swallowed silently and evals ran
# against a degraded plugin set — producing false pass/fail signals.
#
# Call preflight_check_plugin_errors() before any eval loop. The result is
# cached in PREFLIGHT_CHECKED so additional calls in the same script are
# no-ops. Set ORK_SKIP_PLUGIN_ERROR_CHECK=1 to disable (e.g. for unit
# tests of the runners themselves).
# ---------------------------------------------------------------------------
PREFLIGHT_CHECKED=false

preflight_check_plugin_errors() {
    [[ "$PREFLIGHT_CHECKED" == "true" ]] && return 0
    PREFLIGHT_CHECKED=true

    if [[ "${ORK_SKIP_PLUGIN_ERROR_CHECK:-0}" == "1" ]]; then
        return 0
    fi

    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${YELLOW}  preflight: jq not found — skipping plugin_errors check${NC}" >&2
        return 0
    fi

    local tmp_out
    tmp_out=$(mktemp)
    CLEANUP_FILES+=("$tmp_out")

    # Minimal probe: ask Claude to emit its init event and stop immediately.
    # Timeout short — this should be fast.
    local probe_input='{"type":"user","message":{"role":"user","content":"noop"}}'
    if ! echo "$probe_input" | run_with_timeout 30 claude -p --output-format stream-json --input-format stream-json --verbose \
        > "$tmp_out" 2>/dev/null; then
        # Non-zero exit isn't fatal — we only care about what we can parse
        :
    fi

    # Find the first init event (type=="system" && subtype=="init")
    local errors_json
    errors_json=$(jq -s -c '
        map(select(.type=="system" and (.subtype=="init" or .event=="init")))
        | first
        | .plugin_errors // []
    ' "$tmp_out" 2>/dev/null || echo '[]')

    if [[ "$errors_json" == "null" || "$errors_json" == "[]" || -z "$errors_json" ]]; then
        return 0
    fi

    echo "" >&2
    echo -e "${RED}============================================================${NC}" >&2
    echo -e "${RED}  PLUGIN LOAD ERRORS DETECTED (CC stream-json init event)${NC}" >&2
    echo -e "${RED}============================================================${NC}" >&2
    echo "$errors_json" | jq -r '.[] | "  [\(.plugin // .name // "unknown")] \(.error // .message // .)"' >&2 || echo "$errors_json" >&2
    echo -e "${RED}============================================================${NC}" >&2
    echo -e "${RED}  Refusing to run evals against a degraded plugin set.${NC}" >&2
    echo -e "${YELLOW}  Fix the plugin errors above, or set ORK_SKIP_PLUGIN_ERROR_CHECK=1 to bypass.${NC}" >&2
    echo "" >&2
    exit 1
}

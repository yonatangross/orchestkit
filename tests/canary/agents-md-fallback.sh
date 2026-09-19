#!/usr/bin/env bash
# Canary: CC 2.1.277 built-in agents-md module, live codeword probe.
#
# What it proves, on the machine that runs it:
#   arm 1: a repo whose ONLY project instruction file is AGENTS.md gets its
#          codeword into the model's context (the fallback is real)
#   arm 2: a repo with both AGENTS.md and CLAUDE.md answers the CLAUDE.md
#          codeword (CLAUDE.md wins under the default instructionFiles value
#          claude-md-or-agents-md)
#
# Every tool that could READ the instruction file is disallowed, so the
# codeword can only reach the model through the instruction-file channel
# itself. That is the claim being probed, not the model's reading skill.
#
# Result semantics:
#   VERIFIED     non-empty answer carrying the expected codeword
#   REFUTED      non-empty answer NOT carrying the expected codeword
#   INCONCLUSIVE empty stdout or non-zero exit after retry; the claude call
#                itself failed, so nothing about the feature was measured
#
# Creates a throwaway git repo under $TMPDIR, removes it on exit, and writes
# no settings file. Requires the `claude` CLI on PATH (measured on 2.1.277).
#
# Lane L1, cc-mods adoption 2026-09-18. Matrix row: 2.1.277 in
# src/skills/doctor/references/version-compatibility.md.

set -uo pipefail

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-agentsmd-canary.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
    echo "SKIP: claude CLI not on PATH; canary not run"
    exit 0
fi

TIMEOUT_SECS=600
ATTEMPTS=2

CODEWORD_AGENTS="CANARY-AGENTS-$((RANDOM * 32768 + RANDOM))"
CODEWORD_CLAUDE="CANARY-CLAUDE-$((RANDOM * 32768 + RANDOM))"

PROMPT='This project may carry a project instruction file (CLAUDE.md or AGENTS.md). Reply with ONLY the codeword it contains, or NONE if you see no project instruction file. No other words.'

LAST_OUT=""
LAST_STDERR=""
LAST_RC=0

# One claude -p attempt. The prompt goes on stdin because --disallowedTools is
# a variadic option and would otherwise swallow a positional prompt into more
# deny rules, leaving -p to hang on an empty stdin. Timeout via a watchdog
# subshell so this stays portable to hosts without GNU timeout(1).
probe_once() {
    local out_file="$WORK/out.$RANDOM.log" err_file="$WORK/err.$RANDOM.log"
    printf '%s' "$PROMPT" | "$CLAUDE_BIN" -p --model haiku --no-session-persistence \
        --disallowedTools Read,Glob,Grep,Bash,Agent,WebFetch,ToolSearch \
        >"$out_file" 2>"$err_file" &
    local pid=$!
    (
        sleep "$TIMEOUT_SECS"
        kill -TERM "$pid" 2>/dev/null
        sleep 5
        kill -KILL "$pid" 2>/dev/null
    ) &
    local watcher=$!
    wait "$pid" 2>/dev/null
    LAST_RC=$?
    kill "$watcher" 2>/dev/null
    wait "$watcher" 2>/dev/null
    LAST_OUT="$(cat "$out_file" 2>/dev/null)"
    LAST_STDERR="$(tail -c 400 "$err_file" 2>/dev/null | tr '\n' ' ')"
}

# Retry once on a failed call (non-zero exit or empty stdout); a successful
# call with an empty answer is also a failed call, not a refutation.
probe() {
    local attempt
    for attempt in $(seq "$ATTEMPTS"); do
        probe_once
        if [ "$LAST_RC" -eq 0 ] && [ -n "$(printf '%s' "$LAST_OUT" | tr -d '[:space:]')" ]; then
            return 0
        fi
    done
    return "$LAST_RC"
}

report() {
    local expect="$1" fail_desc="$2" pass_desc="$3"
    if probe; then
        if printf '%s' "$LAST_OUT" | grep -qF "$expect"; then
            echo "VERIFIED ${pass_desc}"
            return 0
        fi
        echo "REFUTED ${fail_desc} (got: $(printf '%s' "$LAST_OUT" | head -c 120))"
        return 1
    fi
    echo "INCONCLUSIVE ${fail_desc}: claude -p exited ${LAST_RC} or produced no output after ${ATTEMPTS} attempts; stderr: ${LAST_STDERR:-<empty>}"
    return 1
}

mkdir -p "$WORK/repo"
cd "$WORK/repo" || exit 2
git init -q

cat > AGENTS.md <<EOF
# Project rules

The project codeword is ${CODEWORD_AGENTS}.
EOF

report "$CODEWORD_AGENTS" \
    "agents-md-fallback: AGENTS.md-only repo did not answer its codeword ${CODEWORD_AGENTS}" \
    "agents-md-fallback: AGENTS.md-only repo answered its codeword ${CODEWORD_AGENTS}"
ARM1=$?

cat > CLAUDE.md <<EOF
# Project rules

The project codeword is ${CODEWORD_CLAUDE}.
EOF

report "$CODEWORD_CLAUDE" \
    "claude-md-wins: repo with both files did not answer the CLAUDE.md codeword ${CODEWORD_CLAUDE}" \
    "claude-md-wins: repo with both files answered the CLAUDE.md codeword ${CODEWORD_CLAUDE}"
ARM2=$?

[ "$ARM1" -eq 0 ] && [ "$ARM2" -eq 0 ]

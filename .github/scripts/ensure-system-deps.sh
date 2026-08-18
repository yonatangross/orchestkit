#!/usr/bin/env bash
#
# Ensure system CLI tools are available, without paying for a package-manager
# round trip when they are already installed.
#
# Why this exists (issue #3545): six CI jobs on 2026-08-17/18 burned their
# entire timeout-minutes cap inside "Setup environment" and never reached a
# test. The cause was `apt-get update` hanging on an unreachable mirror. jq and
# rsync ship preinstalled on the ubuntu-latest runner image, so that apt call
# was pure overhead on every run that did not hang, and a full-cap job loss on
# the ones that did.
#
# Two properties matter here:
#   1. Skip the package manager entirely when every requested tool is present.
#   2. When an install is genuinely needed, bound it with `timeout` so a mirror
#      hang fails in minutes with a named cause instead of at the job cap.
#
# `timeout-minutes:` is silently ignored on steps inside a composite action
# (actions/runner#1979), so the bound has to be the `timeout` command.
#
# Usage:
#   .github/scripts/ensure-system-deps.sh jq rsync
#
# Arguments are command names. The command name is assumed to double as the
# package name, which holds for jq, rsync and ffmpeg.
#
# Environment:
#   SYSTEM_DEPS_TIMEOUT  seconds allowed per package-manager call (default 90).
#     apt takes two calls (update, then install), so the worst case is roughly
#     three minutes instead of the 20 to 30 minute job cap. Raise it for a
#     genuinely heavy package if one ever needs longer.

set -euo pipefail

TIMEOUT_SECS="${SYSTEM_DEPS_TIMEOUT:-90}"
LOG_PREFIX="ensure-system-deps:"

if [ "$#" -eq 0 ]; then
    echo "${LOG_PREFIX} no commands requested, nothing to do"
    exit 0
fi

# ---------------------------------------------------------------------------
# 1. Presence check. The common path exits here without touching apt/brew/choco.
# ---------------------------------------------------------------------------
missing=()
for cmd in "$@"; do
    if command -v "${cmd}" >/dev/null 2>&1; then
        echo "${LOG_PREFIX} ${cmd} already present at $(command -v "${cmd}")"
    else
        missing+=("${cmd}")
    fi
done

if [ "${#missing[@]}" -eq 0 ]; then
    echo "${LOG_PREFIX} all requested tools present, skipping package manager"
    exit 0
fi

echo "${LOG_PREFIX} missing tools: ${missing[*]}"

# ---------------------------------------------------------------------------
# 2. Resolve a watchdog. GNU coreutils `timeout` is present on Linux runners.
#    Bare macOS ships neither timeout nor gtimeout, so there the install runs
#    unbounded, which is exactly the status quo rather than a regression.
# ---------------------------------------------------------------------------
bound=()
if command -v timeout >/dev/null 2>&1; then
    bound=(timeout "${TIMEOUT_SECS}")
elif command -v gtimeout >/dev/null 2>&1; then
    bound=(gtimeout "${TIMEOUT_SECS}")
else
    echo "${LOG_PREFIX} WARNING no timeout command found, running install unbounded"
fi

run_bounded() {
    local label="$1"
    shift
    local status=0
    "${bound[@]+"${bound[@]}"}" "$@" || status=$?

    if [ "${status}" -eq 124 ]; then
        echo "${LOG_PREFIX} FAILED: ${label} exceeded ${TIMEOUT_SECS}s" >&2
        echo "${LOG_PREFIX} the package mirror is unreachable or throttled." >&2
        echo "${LOG_PREFIX} This is an infrastructure failure in setup, not a test failure. Re-run the job." >&2
        return 1
    fi

    if [ "${status}" -ne 0 ]; then
        echo "${LOG_PREFIX} FAILED: ${label} exited ${status}" >&2
        return 1
    fi

    return 0
}

# ---------------------------------------------------------------------------
# 3. Install only what is missing, through whichever manager this runner has.
# ---------------------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
    run_bounded "apt-get update" sudo apt-get update -qq
    run_bounded "apt-get install" sudo apt-get install -y "${missing[@]}"
elif command -v brew >/dev/null 2>&1; then
    run_bounded "brew install" brew install "${missing[@]}"
elif command -v choco >/dev/null 2>&1; then
    run_bounded "choco install" choco install "${missing[@]}" -y
else
    echo "${LOG_PREFIX} FAILED: no supported package manager found (apt-get, brew, choco)" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 4. Never let a silent no-op install pass. A later step dying with
#    "jq: command not found" is worse than failing here with the reason.
# ---------------------------------------------------------------------------
still_missing=()
for cmd in "${missing[@]}"; do
    command -v "${cmd}" >/dev/null 2>&1 || still_missing+=("${cmd}")
done

if [ "${#still_missing[@]}" -ne 0 ]; then
    echo "${LOG_PREFIX} FAILED: still missing after install: ${still_missing[*]}" >&2
    exit 1
fi

echo "${LOG_PREFIX} installed ${missing[*]}"

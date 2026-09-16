#!/usr/bin/env bash
# Run npm audit with a bounded retry for a stalled registry request.
#
# npm audit exits nonzero both for advisory findings and for operational errors,
# so retrying every nonzero result could hide a real critical vulnerability.
# GNU timeout gives a distinct status for the failure seen in CI: a registry
# request that never completes. Retry only that status and preserve all other
# npm exit statuses unchanged.
#
# GNU timeout is not a given. It ships on the CI runners, it does NOT ship on a
# stock macOS, and this script used to call it unconditionally: the shell then
# exited 127 before npm ever ran, and tests/security/test-npm-audit.sh reported
# that as "npm audit produced no usable JSON report" for all six lockfiles —
# a missing binary wearing the costume of a registry outage. Every developer
# push on macOS hit it, because bin/git-hooks/pre-push runs the security suite.
# So resolve a timeout implementation first (timeout, then gtimeout from
# coreutils), and fall back to a bash watchdog that reproduces GNU's exit 124.
#
# Usage: npm-audit-with-retry.sh [directory] [npm-audit arguments...]
#
# Environment:
#   NPM_AUDIT_TIMEOUT_SECONDS  Seconds per audit attempt (default: 60).
#   NPM_AUDIT_MAX_ATTEMPTS     Attempts for a timeout only (default: 3).
#   NPM_AUDIT_RETRY_DELAY_SECONDS  Initial retry delay in seconds (default: 5).
#     Each delay increases by this value and never exceeds 15 seconds.

set -euo pipefail

AUDIT_DIRECTORY="${1:-.}"
if [[ "$#" -gt 0 ]]; then
  shift
fi
AUDIT_ARGUMENTS=("$@")
if [[ "${#AUDIT_ARGUMENTS[@]}" -eq 0 ]]; then
  AUDIT_ARGUMENTS=(--audit-level=critical)
fi
TIMEOUT_SECONDS="${NPM_AUDIT_TIMEOUT_SECONDS:-60}"
MAX_ATTEMPTS="${NPM_AUDIT_MAX_ATTEMPTS:-3}"
MAX_RETRY_DELAY_SECONDS=15
RETRY_DELAY_SECONDS="${NPM_AUDIT_RETRY_DELAY_SECONDS:-5}"

is_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

if ! is_positive_integer "$TIMEOUT_SECONDS" || ! is_positive_integer "$MAX_ATTEMPTS"; then
  echo "npm-audit-with-retry: timeout and max attempts must be positive integers" >&2
  exit 2
fi

if ! [[ "$RETRY_DELAY_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "npm-audit-with-retry: retry delay must be a non-negative integer" >&2
  exit 2
fi

if [[ ! -d "$AUDIT_DIRECTORY" ]]; then
  echo "npm-audit-with-retry: directory not found: $AUDIT_DIRECTORY" >&2
  exit 2
fi

TIMEOUT_BIN=""
for candidate in timeout gtimeout; do
  # silent: best-effort — probing for an optional binary, absence IS the answer
  if command -v "$candidate" >/dev/null 2>&1; then
    TIMEOUT_BIN="$candidate"
    break
  fi
done

# Run "$@" under a wall-clock bound, reporting GNU timeout's 124 on expiry so
# the retry decision below reads the same status whichever path ran.
run_bounded() {
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" --signal=TERM --kill-after=10s "${TIMEOUT_SECONDS}s" "$@"
    return "$?"
  fi

  local command_pid watchdog_pid status=0
  "$@" &
  command_pid=$!
  (
    sleep "$TIMEOUT_SECONDS"
    # silent: post-cleanup — a finished audit leaves no pid to signal
    kill -TERM "$command_pid" 2>/dev/null
    sleep 10
    # silent: post-cleanup — same, after the kill-after grace period
    kill -KILL "$command_pid" 2>/dev/null
  ) &
  watchdog_pid=$!

  wait "$command_pid" || status=$?
  # silent: post-cleanup — the watchdog may already have exited on its own
  kill -TERM "$watchdog_pid" 2>/dev/null || true
  # silent: post-cleanup — reaping a watchdog we just signalled
  wait "$watchdog_pid" 2>/dev/null || true

  # 143 is 128+SIGTERM, which here can only be the watchdog firing. Report it
  # as 124 so a caller cannot tell the fallback from GNU timeout.
  [[ "$status" -eq 143 ]] && status=124
  return "$status"
}

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  echo "npm-audit-with-retry: attempt ${attempt}/${MAX_ATTEMPTS} in ${AUDIT_DIRECTORY}" >&2

  status=0
  (
    cd "$AUDIT_DIRECTORY"
    run_bounded npm audit "${AUDIT_ARGUMENTS[@]}"
  ) || status=$?

  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi

  # 124 is GNU timeout's normal expiration status. 137 is possible when the
  # audit ignores TERM and timeout has to send KILL after the grace period.
  if [[ "$status" -ne 124 && "$status" -ne 137 ]]; then
    echo "npm-audit-with-retry: npm audit exited ${status}; not retrying" >&2
    exit "$status"
  fi

  if [[ "$attempt" -eq "$MAX_ATTEMPTS" ]]; then
    echo "npm-audit-with-retry: npm audit timed out after ${MAX_ATTEMPTS} attempt(s)" >&2
    exit "$status"
  fi

  retry_delay=$((RETRY_DELAY_SECONDS * attempt))
  if [[ "$retry_delay" -gt "$MAX_RETRY_DELAY_SECONDS" ]]; then
    retry_delay="$MAX_RETRY_DELAY_SECONDS"
  fi

  echo "npm-audit-with-retry: registry request timed out after ${TIMEOUT_SECONDS}s; retrying in ${retry_delay}s" >&2
  sleep "$retry_delay"
done

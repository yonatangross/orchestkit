#!/usr/bin/env bash
# Run npm audit with a bounded retry for a stalled registry request.
#
# npm audit exits nonzero both for advisory findings and for operational errors,
# so retrying every nonzero result could hide a real critical vulnerability.
# GNU timeout gives a distinct status for the failure seen in CI: a registry
# request that never completes. Retry only that status and preserve all other
# npm exit statuses unchanged.
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

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  echo "npm-audit-with-retry: attempt ${attempt}/${MAX_ATTEMPTS} in ${AUDIT_DIRECTORY}" >&2

  status=0
  (
    cd "$AUDIT_DIRECTORY"
    timeout --signal=TERM --kill-after=10s "${TIMEOUT_SECONDS}s" \
      npm audit "${AUDIT_ARGUMENTS[@]}"
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

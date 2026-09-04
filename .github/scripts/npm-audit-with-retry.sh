#!/usr/bin/env bash
# Run npm audit with a bounded retry for a stalled registry request.
#
# npm audit exits nonzero both for advisory findings and for operational errors,
# so retrying every nonzero result could hide a real critical vulnerability.
# GNU timeout gives a distinct status for the failure seen in CI: a registry
# request that never completes. Retry only that status and preserve all other
# npm exit statuses unchanged.
#
# Usage: npm-audit-with-retry.sh [directory]
#
# Environment:
#   NPM_AUDIT_TIMEOUT_SECONDS  Seconds per audit attempt (default: 60).
#   NPM_AUDIT_MAX_ATTEMPTS     Attempts for a timeout only (default: 2).
#   NPM_AUDIT_RETRY_DELAY_SECONDS  Delay before retrying (default: 5).

set -euo pipefail

AUDIT_DIRECTORY="${1:-.}"
TIMEOUT_SECONDS="${NPM_AUDIT_TIMEOUT_SECONDS:-60}"
MAX_ATTEMPTS="${NPM_AUDIT_MAX_ATTEMPTS:-2}"
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
  echo "npm-audit-with-retry: attempt ${attempt}/${MAX_ATTEMPTS} in ${AUDIT_DIRECTORY}"

  status=0
  (
    cd "$AUDIT_DIRECTORY"
    timeout --signal=TERM --kill-after=10s "${TIMEOUT_SECONDS}s" \
      npm audit --audit-level=critical
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

  echo "npm-audit-with-retry: registry request timed out after ${TIMEOUT_SECONDS}s; retrying once" >&2
  sleep "$RETRY_DELAY_SECONDS"
done

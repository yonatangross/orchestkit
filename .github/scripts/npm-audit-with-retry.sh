#!/usr/bin/env bash
# Run npm audit with a bounded retry for a registry request that stalls or drops.
#
# npm audit exits nonzero both for advisory findings and for operational errors,
# so retrying every nonzero result could hide a real critical vulnerability.
# Two failures are transient, and only these two are retried:
#
#   1. A registry request that never completes. GNU timeout gives it a distinct
#      status (124, or 137 after the kill).
#   2. A registry request that fails outright, for example a dropped TLS
#      handshake. npm then exits 1 within seconds, the same status it uses for
#      "advisories found", so the status says nothing. The report does: it is a
#      JSON object with an "error" key whose text names the transport reason
#      (ECONNRESET, ETIMEDOUT, EAI_AGAIN, ECONNREFUSED, ENOTFOUND, socket hang
#      up, socket disconnected, network).
#
# A report WITHOUT an "error" key is never retried, whatever its advisory titles
# say, and every other npm exit status is preserved unchanged.
#
# To read the report this script captures npm's stdout for each attempt instead
# of streaming it. The stdout contract is unchanged for callers: exactly one
# report, the final attempt's. A discarded attempt prints nothing on stdout; its
# reason goes to stderr with the attempt count. Reading the report needs jq.
# Without jq nothing can be classified, so a failed report is handed on with
# npm's status as before (no retry, and never a pass).
#
# This is the one retry layer for the audit. Callers (audit-whole-tree.sh,
# tests/security/test-npm-audit.sh, ci.yml) must not wrap it in a retry of their
# own: stacked retries multiply the load on a registry that is already failing.
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
#   NPM_AUDIT_TIMEOUT_SECONDS  Seconds per audit attempt, applied to every
#     attempt including retries (default: 60).
#   NPM_AUDIT_MAX_ATTEMPTS     Total attempts, shared by timeouts and
#     network-class error reports (default: 3).
#   NPM_AUDIT_RETRY_DELAY_SECONDS  Initial retry delay in seconds (default: 5).
#     Each delay increases by this value and never exceeds 15 seconds, plus a
#     random jitter of at most a fifth of the delay (so a delay of 0 stays 0).

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
  # The watchdog's stdout goes to /dev/null: this function runs inside the
  # command substitution that captures the report, and a watchdog that kept the
  # pipe open would hold that capture until its sleep ended, long after npm did.
  (
    sleep "$TIMEOUT_SECONDS"
    # silent: post-cleanup — a finished audit leaves no pid to signal
    kill -TERM "$command_pid" 2>/dev/null
    sleep 10
    # silent: post-cleanup — same, after the kill-after grace period
    kill -KILL "$command_pid" 2>/dev/null
  ) >/dev/null &
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

HAVE_JQ=0
# silent: best-effort (probing for an optional binary, absence IS the answer)
if command -v jq >/dev/null 2>&1; then
  HAVE_JQ=1
fi

# network_error_reason <report>: for a network-class error report, print the
# text that names the reason and return 0. Return nonzero for anything else: an
# empty or non-JSON report, more than one JSON document, a report with no
# "error" key (advisories or a clean run), or an error that is not about the
# network. Only the report's own error fields are read, never advisory titles.
# jq's stderr is left alone: if the report is not JSON, its parse error says so.
# The report is piped, not passed as a here-string: a report can be megabytes.
network_error_reason() {
  [[ "$HAVE_JQ" -eq 1 && -n "$1" ]] || return 1
  printf '%s\n' "$1" | jq -ser '
    select(length == 1) | .[0]
    | select(type == "object" and has("error"))
    | [.message, (.error | if type == "object" then (.code, .summary, .detail) else . end)]
    | map(select(type == "string" and length > 0))
    | map(select(test("ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|ENOTFOUND|socket hang up|socket disconnected|network"; "i")))
    | first // empty
  '
}

# Hand the captured report of the final attempt to the caller, once.
emit_report() {
  if [[ -n "$report" ]]; then
    printf '%s\n' "$report"
  fi
}

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  echo "npm-audit-with-retry: attempt ${attempt}/${MAX_ATTEMPTS} in ${AUDIT_DIRECTORY}" >&2

  # run_bounded applies the per-attempt timeout to every attempt, retries included.
  status=0
  report="$(cd "$AUDIT_DIRECTORY" && run_bounded npm audit "${AUDIT_ARGUMENTS[@]}")" || status=$?

  if [[ "$status" -eq 0 ]]; then
    emit_report
    exit 0
  fi

  # 124 is GNU timeout's normal expiration status. 137 is possible when the
  # audit ignores TERM and timeout has to send KILL after the grace period.
  if [[ "$status" -eq 124 || "$status" -eq 137 ]]; then
    failure="registry request timed out after ${TIMEOUT_SECONDS}s"
    gave_up="npm audit timed out after ${MAX_ATTEMPTS} attempt(s)"
  elif reason="$(network_error_reason "$report")"; then
    failure="registry request failed (${reason})"
    gave_up="npm audit could not reach the registry after ${MAX_ATTEMPTS} attempt(s): ${reason}"
  else
    emit_report
    echo "npm-audit-with-retry: npm audit exited ${status}; not retrying" >&2
    exit "$status"
  fi

  if [[ "$attempt" -eq "$MAX_ATTEMPTS" ]]; then
    emit_report
    echo "npm-audit-with-retry: ${gave_up}" >&2
    exit "$status"
  fi

  retry_delay=$((RETRY_DELAY_SECONDS * attempt))
  if [[ "$retry_delay" -gt "$MAX_RETRY_DELAY_SECONDS" ]]; then
    retry_delay="$MAX_RETRY_DELAY_SECONDS"
  fi
  # Jitter, so callers that failed together do not all retry together. It
  # scales with the delay, so a delay of 0 stays 0.
  retry_delay=$((retry_delay + RANDOM % (retry_delay / 5 + 1)))

  echo "npm-audit-with-retry: ${failure}; retrying in ${retry_delay}s" >&2
  sleep "$retry_delay"
done

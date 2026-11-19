#!/usr/bin/env bash
# Regression coverage for the bounded dependency-audit wrapper. The fake npm
# and timeout commands make the outcomes deterministic and network-free.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WRAPPER="$PROJECT_ROOT/.github/scripts/npm-audit-with-retry.sh"

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/ork-audit-retry.XXXXXX")"
trap 'rm -rf "$tmpdir"' EXIT

mkdir -p "$tmpdir/bin" "$tmpdir/project"

cat > "$tmpdir/bin/timeout" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
while [[ "$1" == --* || "$1" =~ ^[0-9]+s$ ]]; do
  shift
done
exec "$@"
EOF

cat > "$tmpdir/bin/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$NPM_STUB_ARGS"
count=0
[[ -f "$NPM_STUB_COUNT" ]] && count="$(cat "$NPM_STUB_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" > "$NPM_STUB_COUNT"
# Optional canned stdout for this attempt: $NPM_STUB_OUTPUT_DIR/<attempt>.json. Builtins
# only, because the no-timeout cases below run this stub on a PATH that has no cat.
if [[ -n "${NPM_STUB_OUTPUT_DIR:-}" && -f "$NPM_STUB_OUTPUT_DIR/$count.json" ]]; then
  printf '%s\n' "$(<"$NPM_STUB_OUTPUT_DIR/$count.json")"
fi
if [[ "$count" -eq 1 ]]; then
  exit "$NPM_STUB_FIRST_STATUS"
fi
if [[ "$count" -eq 2 ]]; then
  exit "$NPM_STUB_SECOND_STATUS"
fi
exit "$NPM_STUB_THIRD_STATUS"
EOF

chmod +x "$tmpdir/bin/timeout" "$tmpdir/bin/npm"

pass=0
fail=0
ok() { echo "  PASS: $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL: $1"; fail=$((fail + 1)); }

run_wrapper() {
  NPM_STUB_ARGS="$tmpdir/args" \
  NPM_STUB_COUNT="$tmpdir/count" \
  NPM_AUDIT_TIMEOUT_SECONDS=1 \
  NPM_AUDIT_MAX_ATTEMPTS=3 \
  NPM_AUDIT_RETRY_DELAY_SECONDS=0 \
  PATH="$tmpdir/bin:$PATH" \
    bash "$WRAPPER" "$tmpdir/project" "$@"
}

rm -f "$tmpdir/args" "$tmpdir/count"
NPM_STUB_FIRST_STATUS=124 NPM_STUB_SECOND_STATUS=124 NPM_STUB_THIRD_STATUS=0 run_wrapper --audit-level=moderate --package-lock-only --json
if [[ "$(cat "$tmpdir/count")" == 3 ]]; then
  ok "retries a timed-out registry request twice"
else
  bad "did not retry a timed-out registry request twice"
fi
if grep -Fxq 'audit --audit-level=moderate --package-lock-only --json' "$tmpdir/args"; then
  ok "passes through the lockfile audit arguments"
else
  bad "dropped the lockfile audit arguments"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
if NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 run_wrapper; then
  bad "accepted a critical-advisory exit"
else
  if [[ "$(cat "$tmpdir/count")" == 1 ]]; then
    ok "does not retry a critical-advisory exit"
  else
    bad "retried a critical-advisory exit"
  fi
fi

rm -f "$tmpdir/args" "$tmpdir/count"
if NPM_STUB_FIRST_STATUS=124 NPM_STUB_SECOND_STATUS=124 NPM_STUB_THIRD_STATUS=124 run_wrapper; then
  bad "accepted repeated timeouts"
else
  if [[ "$(cat "$tmpdir/count")" == 3 ]]; then
    ok "fails after three bounded attempts"
  else
    bad "did not enforce the timeout attempt limit"
  fi
fi

# ─── a network-class error report is transient, an advisory hit is not ──
#
# npm audit exits 1 for a failed registry request exactly as it does for
# advisories, so the status cannot tell them apart. The report can: a failed
# request is a JSON object with an "error" key whose text names the transport
# reason. NETWORK_REPORT is the exact shape npm prints when the TLS handshake
# to the registry drops: the reason sits in .message, and .error.summary and
# .error.detail are empty strings.
NETWORK_REPORT='{"message": "request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: Client network socket disconnected before secure TLS connection was established", "error": {"summary": "", "detail": ""}}'
CLEAN_REPORT='{"vulnerabilities": {}, "metadata": {"vulnerabilities": {"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}, "dependencies": {"total": 5}}}'
# An advisory whose title is full of network words. It has no "error" key, so
# no wording in it may ever make the wrapper retry it.
ADVISORY_REPORT='{"vulnerabilities": {"pkg-a": {"name": "pkg-a", "severity": "critical", "via": [{"source": 111, "name": "pkg-a", "title": "ECONNRESET on a network socket hang up leaks memory in pkg-a", "severity": "critical"}]}}, "metadata": {"vulnerabilities": {"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 1, "total": 1}, "dependencies": {"total": 5}}}'
# An "error" report that is not about the network: retrying cannot fix it.
LOCKFILE_ERROR_REPORT='{"error": {"code": "ENOLOCK", "summary": "This command requires an existing lockfile.", "detail": "Try creating one first with: npm i --package-lock-only"}}'

# stub_outputs <attempt 1 stdout> [attempt 2 stdout] [attempt 3 stdout]
stub_outputs() {
  rm -rf "$tmpdir/reports"
  mkdir -p "$tmpdir/reports"
  local n=0 body
  for body in "$@"; do
    n=$((n + 1))
    printf '%s\n' "$body" > "$tmpdir/reports/$n.json"
  done
}

rm -f "$tmpdir/args" "$tmpdir/count"
stub_outputs "$NETWORK_REPORT" "$CLEAN_REPORT"
status=0
NPM_STUB_OUTPUT_DIR="$tmpdir/reports" NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 \
  run_wrapper --audit-level=moderate --package-lock-only --json > "$tmpdir/out" 2> "$tmpdir/err" || status=$?
if [[ "$status" -eq 0 && "$(cat "$tmpdir/count")" == 2 ]]; then
  ok "retries a network-class error report once and ends clean"
else
  bad "network error then clean report: exit ${status} after $(cat "$tmpdir/count") attempt(s), expected exit 0 after 2"
fi
if [[ "$(cat "$tmpdir/out")" == "$CLEAN_REPORT" ]]; then
  ok "prints only the final report on stdout after a retry"
else
  bad "stdout after a retry is not the final report alone: $(head -c 200 "$tmpdir/out")"
fi
if grep -Fq 'attempt 2/3' "$tmpdir/err"; then
  ok "shows the attempt count on stderr"
else
  bad "stderr does not show attempt 2/3: $(tr '\n' ' ' < "$tmpdir/err")"
fi
if grep -Fq 'socket disconnected before secure TLS connection was established' "$tmpdir/err"; then
  ok "names the network reason when it retries"
else
  bad "stderr does not name the network reason: $(tr '\n' ' ' < "$tmpdir/err")"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
stub_outputs "$ADVISORY_REPORT" "$CLEAN_REPORT"
status=0
NPM_STUB_OUTPUT_DIR="$tmpdir/reports" NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 \
  run_wrapper --audit-level=moderate --package-lock-only --json > "$tmpdir/out" 2> "$tmpdir/err" || status=$?
if [[ "$status" -eq 1 && "$(cat "$tmpdir/count")" == 1 ]]; then
  ok "does not retry an advisory report, whatever its titles say"
else
  bad "advisory report: exit ${status} after $(cat "$tmpdir/count") attempt(s), expected exit 1 after 1"
fi
if [[ "$(cat "$tmpdir/out")" == "$ADVISORY_REPORT" ]]; then
  ok "passes the advisory report through on stdout"
else
  bad "advisory report did not reach stdout unchanged: $(head -c 200 "$tmpdir/out")"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
stub_outputs "$NETWORK_REPORT" "$NETWORK_REPORT" "$NETWORK_REPORT"
status=0
NPM_STUB_OUTPUT_DIR="$tmpdir/reports" NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=1 NPM_STUB_THIRD_STATUS=1 \
  run_wrapper --audit-level=moderate --package-lock-only --json > "$tmpdir/out" 2> "$tmpdir/err" || status=$?
if [[ "$status" -eq 1 && "$(cat "$tmpdir/count")" == 3 ]]; then
  ok "fails after three bounded attempts when every one is a network error"
else
  bad "network error on every attempt: exit ${status} after $(cat "$tmpdir/count") attempt(s), expected exit 1 after 3"
fi
if [[ "$(cat "$tmpdir/out")" == "$NETWORK_REPORT" ]]; then
  ok "hands the last network-error report to the caller on stdout"
else
  bad "the last network-error report did not reach stdout alone: $(head -c 200 "$tmpdir/out")"
fi
if grep -F 'after 3 attempt(s)' "$tmpdir/err" | grep -Fq 'socket disconnected before secure TLS connection was established'; then
  ok "names the network reason when it gives up"
else
  bad "the give-up line does not name the network reason: $(tr '\n' ' ' < "$tmpdir/err")"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
stub_outputs "$LOCKFILE_ERROR_REPORT" "$CLEAN_REPORT"
status=0
NPM_STUB_OUTPUT_DIR="$tmpdir/reports" NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 \
  run_wrapper --audit-level=moderate --package-lock-only --json > "$tmpdir/out" 2> "$tmpdir/err" || status=$?
if [[ "$status" -eq 1 && "$(cat "$tmpdir/count")" == 1 ]]; then
  ok "does not retry an error report that is not about the network"
else
  bad "lockfile error report: exit ${status} after $(cat "$tmpdir/count") attempt(s), expected exit 1 after 1"
fi

# ─── the wrapper must work where GNU timeout does not exist ──────────
#
# Every case above puts a fake `timeout` on PATH, which is exactly why none of
# them could see that the wrapper called it unconditionally. On a stock macOS
# there is no `timeout`, so the shell exited 127 before npm ran and the audit
# gate reported six lockfiles as "produced no usable JSON report" — a missing
# binary reported as a registry outage. These cases run with a PATH that has
# neither `timeout` nor `gtimeout`.
mkdir -p "$tmpdir/nobin"
for tool in env bash sleep; do
  ln -sf "$(command -v "$tool")" "$tmpdir/nobin/$tool"
done
cp "$tmpdir/bin/npm" "$tmpdir/nobin/npm"

cat > "$tmpdir/nobin/npm-hang" <<'EOF'
#!/usr/bin/env bash
# exec, so the pid the watchdog signals is the sleep itself. A bash parent
# would defer the TERM until its foreground child finished, and the assertion
# below would measure the stub, not the wrapper.
exec sleep 30
EOF
chmod +x "$tmpdir/nobin/npm-hang"

run_wrapper_without_timeout() {
  NPM_STUB_ARGS="$tmpdir/args" \
  NPM_STUB_COUNT="$tmpdir/count" \
  NPM_AUDIT_TIMEOUT_SECONDS=1 \
  NPM_AUDIT_MAX_ATTEMPTS="${MAX_ATTEMPTS_OVERRIDE:-3}" \
  NPM_AUDIT_RETRY_DELAY_SECONDS=0 \
  PATH="$tmpdir/nobin" \
    bash "$WRAPPER" "$tmpdir/project" "$@"
}

# Positive control: assert the isolated PATH really removed both binaries,
# otherwise the two cases below would silently re-test the shimmed path.
if PATH="$tmpdir/nobin" command -v timeout >/dev/null 2>&1 ||
   PATH="$tmpdir/nobin" command -v gtimeout >/dev/null 2>&1; then
  bad "isolated PATH still exposes a timeout binary — cases below prove nothing"
else
  ok "isolated PATH exposes neither timeout nor gtimeout"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
if NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 \
   run_wrapper_without_timeout --audit-level=moderate --package-lock-only --json; then
  bad "reported success without GNU timeout"
else
  if [[ -f "$tmpdir/count" && "$(cat "$tmpdir/count")" == 1 ]]; then
    ok "runs npm and preserves its status with no timeout binary present"
  else
    bad "never reached npm with no timeout binary present"
  fi
fi

# This PATH has no jq either, so the wrapper cannot read the report. It must
# then hand the report on untouched with npm's status: never a retry it cannot
# justify, and never a pass.
rm -f "$tmpdir/args" "$tmpdir/count"
stub_outputs "$NETWORK_REPORT" "$CLEAN_REPORT"
status=0
NPM_STUB_OUTPUT_DIR="$tmpdir/reports" NPM_STUB_FIRST_STATUS=1 NPM_STUB_SECOND_STATUS=0 NPM_STUB_THIRD_STATUS=0 \
  run_wrapper_without_timeout --audit-level=moderate --package-lock-only --json > "$tmpdir/out" 2> "$tmpdir/err" || status=$?
if [[ "$status" -eq 1 && "$(cat "$tmpdir/count")" == 1 && "$(cat "$tmpdir/out")" == "$NETWORK_REPORT" ]]; then
  ok "without jq a network-error report is passed through with npm's status"
else
  bad "without jq: exit ${status} after $(cat "$tmpdir/count") attempt(s), stdout: $(head -c 200 "$tmpdir/out")"
fi

rm -f "$tmpdir/args" "$tmpdir/count"
cp "$tmpdir/nobin/npm-hang" "$tmpdir/nobin/npm"
if MAX_ATTEMPTS_OVERRIDE=1 run_wrapper_without_timeout --audit-level=moderate; then
  bad "let a hung audit pass without GNU timeout"
else
  status=$?
  if [[ "$status" -eq 124 ]]; then
    ok "bounds a hung audit and reports GNU timeout's 124 without GNU timeout"
  else
    bad "hung audit exited ${status}, expected 124"
  fi
fi

echo "${pass} passed, ${fail} failed"
[[ "$fail" -eq 0 ]]

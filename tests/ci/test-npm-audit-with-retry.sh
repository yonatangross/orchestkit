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

echo "${pass} passed, ${fail} failed"
[[ "$fail" -eq 0 ]]

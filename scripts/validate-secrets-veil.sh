#!/usr/bin/env bash
# Validate secrets-veil mod footprint (#2276).
#
# Runs `claude plugin validate` on mods/secrets-veil and requires:
# - Registered events match exactly
# - $ calls match exactly
# - No forbidden calls (process.run, http.fetch, store.*, ui.log)
#
# Offline. No model call, no API key. Skips cleanly when CLI absent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOD_DIR="$REPO_ROOT/mods/secrets-veil"

# Expected footprint (per brief)
EXPECTED_HOOKS='session.start{}, tool.call{}, ui.render{component=ToolResult}, ui.render{component=CommandOutput}, command.register{command=/veil}, ui.press{}'
EXPECTED_CALLS='$.env.get, $.ui.invalidate'

# Negative pin - these calls must NOT appear
FORBIDDEN_CALLS='$.process.run $.http.fetch $.store.get $.store.set $.ui.log'

if ! command -v claude >/dev/null 2>&1; then
  echo "SKIP: claude CLI not on PATH"
  exit 0
fi
if ! claude --version >/dev/null 2>&1; then
  echo "SKIP: claude CLI present but not runnable"
  exit 0
fi

# Version floor check - secrets-veil needs function hooks
MIN_CC="2.1.266"
CC_RAW="$(claude --version 2>&1)"

set +e
CC_VER="$(printf '%s' "$CC_RAW" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
set -e

if [ -z "$CC_VER" ]; then
  echo "SKIP: could not parse a version out of: $CC_RAW"
  exit 0
fi
LOWEST="$(printf '%s\n%s\n' "$CC_VER" "$MIN_CC" | sort -V | head -1)"
if [ "$CC_VER" != "$MIN_CC" ] && [ "$LOWEST" = "$CC_VER" ]; then
  echo "SKIP: CC $CC_VER is below $MIN_CC; function hooks contract is absent"
  exit 0
fi

echo "claude: $CC_RAW"
echo "mod: ${MOD_DIR#"$REPO_ROOT"/}"

# Run validation
set +e
OUT="$(claude plugin validate "$MOD_DIR" 2>&1)"
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  echo "FAIL: plugin validate exited $RC"
  printf '%s\n' "$OUT"
  exit 1
fi

# Extract registered hooks and calls
ACTUAL_HOOKS="$(printf '%s\n' "$OUT" | sed -n 's/.*register\.ts hooks: //p' | head -1)"
ACTUAL_CALLS="$(printf '%s\n' "$OUT" | sed -n 's/.*register\.ts calls: //p' | head -1)"

if [ -z "$ACTUAL_HOOKS" ]; then
  echo "FAIL: validator printed no 'hooks:' line for register.ts"
  printf '%s\n' "$OUT"
  exit 1
fi

FAILED=0

# Check hooks match expected
if [ "$ACTUAL_HOOKS" != "$EXPECTED_HOOKS" ]; then
  echo "FAIL: registered events moved."
  echo "  expected: $EXPECTED_HOOKS"
  echo "  actual:   $ACTUAL_HOOKS"
  FAILED=1
fi

# Check calls match expected
if [ "$ACTUAL_CALLS" != "$EXPECTED_CALLS" ]; then
  echo "FAIL: \$ capability names moved."
  echo "  expected: $EXPECTED_CALLS"
  echo "  actual:   $ACTUAL_CALLS"
  FAILED=1
fi

# Check no forbidden calls appear
for forbidden in $FORBIDDEN_CALLS; do
  case "$ACTUAL_CALLS" in
    *"$forbidden"*)
      echo "FAIL: forbidden call detected: $forbidden"
      FAILED=1
      ;;
  esac
done

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "secrets-veil contract changed. Re-read #2276 before"
  echo "updating the expected values, and record what moved."
  exit 1
fi

echo "PASS: footprint validated"
echo "  hooks: $ACTUAL_HOOKS"
echo "  calls: $ACTUAL_CALLS"

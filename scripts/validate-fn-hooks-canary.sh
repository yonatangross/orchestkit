#!/usr/bin/env bash
# Assert the upstream Function Hooks module contract has not moved (#3917).
#
# Runs `claude plugin validate` on tests/fixtures/fn-hooks-canary and requires
# the reported events and $ capabilities to match exactly. A rename or removal
# upstream turns this red, which is the point: OrchestKit is not migrating, so
# this is the mechanical half of "keep watching".
#
# Offline. No model call, no API key. Skips cleanly when the CLI is absent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$REPO_ROOT/tests/fixtures/fn-hooks-canary"
NEGATIVE_MODULE="$FIXTURE/negative/bare-pretooluse.ts"

# Measured on CC 2.1.270, 2026-09-14 (first measured on 2.1.263, 2026-09-08).
# Order is the module's registration order.
#
# What moved between the two: the legacy shell-hook bridge. Through 2.1.263 the
# validator accepted bare `PreToolUse`; from 2.1.266 it rejects it as "not an
# event" and the binary dispatches shell PreToolUse hooks through a
# `classic.PreToolUse` site instead. Everything else is unchanged.
EXPECTED_HOOKS='tool.call{tool=Bash}, classic.PreToolUse{}, session.start{}, engine.create{}, prompt.submit{}'
EXPECTED_CALLS='$.ui.log'

# The rename is pinned from both sides. `classic.PreToolUse` validating proves
# little alone, because the validator checks shape and not membership
# (`banana.PreToolUse` validates too). The bare name being REJECTED is the half
# that only a real vocabulary change can produce, so a revert upstream turns
# this red as well.
EXPECTED_REJECT='"PreToolUse" is not an event'

if ! command -v claude >/dev/null 2>&1; then
  echo "SKIP: claude CLI not on PATH"
  exit 0
fi
if ! claude --version >/dev/null 2>&1; then
  echo "SKIP: claude CLI present but not runnable"
  exit 0
fi

# The function-hooks event vocabulary lands at 2.1.259, the same release that
# first carries CLAUDE_CODE_ENABLE_FUNCTION_HOOKS. Measured across seven binaries
# (#3917): at 2.1.251 and 2.1.257 the `modules` key is parsed but `session.start`
# is "not an event".
#
# The floor is 2.1.266, not 2.1.259, because the contract pinned above is the
# post-rename one. Bracket, from the CC Contract Probe history on @latest: it
# passed 2026-09-08 07:08Z on 2.1.263 and first failed 2026-09-09 07:08Z on
# 2.1.266 (npm publish times: 2.1.265 at 09-08 19:05Z, 2.1.266 at 09-08 23:32Z;
# 2.1.264 was never published). 2.1.265 was never probed, so the floor sits at
# the first MEASURED rejection. An older host would fail here for a reason that
# is not drift. Skip rather than fail, and name the version so the skip is never
# mistaken for a pass.
MIN_CC="2.1.266"
CC_RAW="$(claude --version 2>&1)"

# Capture rc around the parse. `grep` exits 1 on no match, and under
# `set -euo pipefail` a failing pipeline inside a command substitution kills the
# script: measured, a non-semver banner exited 1 with EMPTY output, which the CI
# step then reports as DRIFT. A version we could not read is its own outcome and
# must never be indistinguishable from a contract change.
set +e
CC_VER="$(printf '%s' "$CC_RAW" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
set -e

if [ -z "$CC_VER" ]; then
  echo "SKIP: could not parse a version out of: $CC_RAW"
  exit 0
fi
LOWEST="$(printf '%s\n%s\n' "$CC_VER" "$MIN_CC" | sort -V | head -1)"
if [ "$CC_VER" != "$MIN_CC" ] && [ "$LOWEST" = "$CC_VER" ]; then
  echo "SKIP: CC $CC_VER is below $MIN_CC; the pinned function-hooks contract (classic.PreToolUse) is absent"
  exit 0
fi

echo "claude: $CC_RAW"
echo "fixture: ${FIXTURE#"$REPO_ROOT"/}"

# Capture rc separately: a swallowed non-zero here would read as a clean pass.
set +e
OUT="$(claude plugin validate "$FIXTURE" 2>&1)"
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  echo "FAIL: plugin validate exited $RC"
  printf '%s\n' "$OUT"
  exit 1
fi

# The validator prints one "hooks:" and one "calls:" line per module.
ACTUAL_HOOKS="$(printf '%s\n' "$OUT" | sed -n 's/.*canary\.ts hooks: //p' | head -1)"
ACTUAL_CALLS="$(printf '%s\n' "$OUT" | sed -n 's/.*canary\.ts calls: //p' | head -1)"

if [ -z "$ACTUAL_HOOKS" ]; then
  echo "FAIL: validator printed no 'hooks:' line for canary.ts."
  echo "      The 'modules' key may no longer be followed."
  printf '%s\n' "$OUT"
  exit 1
fi

FAILED=0
if [ "$ACTUAL_HOOKS" != "$EXPECTED_HOOKS" ]; then
  echo "FAIL: registered events moved."
  echo "  expected: $EXPECTED_HOOKS"
  echo "  actual:   $ACTUAL_HOOKS"
  FAILED=1
fi
if [ "$ACTUAL_CALLS" != "$EXPECTED_CALLS" ]; then
  echo "FAIL: \$ capability names moved."
  echo "  expected: $EXPECTED_CALLS"
  echo "  actual:   $ACTUAL_CALLS"
  FAILED=1
fi

# Negative pin. The module is not listed in the fixture's hooks.json (the
# positive run above must stay clean), so wrap it in a throwaway plugin built
# from the same manifest.
# Templated, never bare: a bare `mktemp` ignores $TMPDIR on macOS (#3564 class,
# gated by tests/ci/test-no-bare-mktemp.sh).
NEG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fn-hooks-canary-neg.XXXXXX")"
trap 'rm -rf "$NEG_DIR"' EXIT
mkdir -p "$NEG_DIR/.claude-plugin" "$NEG_DIR/hooks/hooks-handlers"
cp "$FIXTURE/.claude-plugin/plugin.json" "$NEG_DIR/.claude-plugin/plugin.json"
cp "$NEGATIVE_MODULE" "$NEG_DIR/hooks/hooks-handlers/bare-pretooluse.ts"
printf '{"modules":["./hooks-handlers/bare-pretooluse.ts"],"hooks":{}}\n' > "$NEG_DIR/hooks/hooks.json"

set +e
NEG_OUT="$(claude plugin validate "$NEG_DIR" 2>&1)"
NEG_RC=$?
set -e

# `case` rather than `printf | grep -q`: under pipefail an early grep exit can
# SIGPIPE the printf and turn a real match into a false failure.
if [ "$NEG_RC" -eq 0 ]; then
  echo "FAIL: bare PreToolUse validates again; the classic.PreToolUse rename was reverted or widened."
  printf '%s\n' "$NEG_OUT"
  FAILED=1
else
  case "$NEG_OUT" in
    *"$EXPECTED_REJECT"*) ;;
    *)
      echo "FAIL: bare PreToolUse is rejected, but not for the pinned reason."
      echo "  expected a message containing: $EXPECTED_REJECT"
      printf '%s\n' "$NEG_OUT"
      FAILED=1
      ;;
  esac
fi

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "Upstream changed the Function Hooks contract. Re-read #3917 before"
  echo "updating the expected values, and record what moved."
  exit 1
fi

echo "PASS: events and capabilities unchanged"
echo "  hooks:   $ACTUAL_HOOKS"
echo "  calls:   $ACTUAL_CALLS"
echo "  rejects: bare PreToolUse ($EXPECTED_REJECT)"

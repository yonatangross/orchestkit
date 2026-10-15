#!/usr/bin/env bash
# Gate for #4747: scripts/ci/check-workflow-issue-text.py must fail any
# workflow where one job reads untrusted issue/comment text while holding a
# token secret or id-token:write.
#
# Three arms:
#   1. planted UNSAFE fixture must be refused (and named);
#   2. planted SAFE fixture (the read/model/apply split) must pass;
#   3. the live .github/workflows/ tree must pass. This arm is the ratchet:
#      it was red while the old claude-triage.yml was on disk and goes green
#      with the split.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
SCAN="${ROOT}/scripts/ci/check-workflow-issue-text.py"
FIXTURES="${HERE}/workflow-issue-text/fixtures"
WORKFLOWS="${ROOT}/.github/workflows"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/issue-text-gate.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0

# 1. The unsafe fixture must be refused, and the refusal must name the file.
if python3 "${SCAN}" "${FIXTURES}/unsafe-model-token-and-issue-text.yml" > "${SCRATCH}/unsafe.out" 2>&1; then
  echo "FAIL: unsafe fixture was accepted"; cat "${SCRATCH}/unsafe.out"; fail=1
elif ! grep -qF "unsafe-model-token-and-issue-text" "${SCRATCH}/unsafe.out"; then
  echo "FAIL: refusal does not name the fixture:"; cat "${SCRATCH}/unsafe.out"; fail=1
else
  echo "PASS: unsafe fixture refused and named"
fi

# 2. The safe split must pass.
if ! python3 "${SCAN}" "${FIXTURES}/safe-read-model-apply-split.yml" > "${SCRATCH}/safe.out" 2>&1; then
  echo "FAIL: safe fixture was refused:"; cat "${SCRATCH}/safe.out"; fail=1
else
  echo "PASS: safe read/model/apply split accepted"
fi

# 3. The live workflow tree must pass.
if ! python3 "${SCAN}" "${WORKFLOWS}" > "${SCRATCH}/live.out" 2>&1; then
  echo "FAIL: a live workflow mixes issue/comment text with a credential:"; cat "${SCRATCH}/live.out"; fail=1
else
  echo "PASS: all live workflows keep untrusted text away from credentials"
fi

exit "${fail}"

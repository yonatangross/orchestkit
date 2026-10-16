#!/usr/bin/env bash
# Gate for #4747: scripts/ci/check-workflow-issue-text.py must fail any
# workflow where one job reads untrusted issue/comment text while holding a
# token secret or id-token:write.
#
# Every arm asserts an exact exit code AND a matched message, so a scanner
# error (unreadable file, crash) can never read as the arm's expectation.
# Exit codes: 0 = clean, 1 = finding(s), 2 = scanner error.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
SCAN="${ROOT}/scripts/ci/check-workflow-issue-text.py"
FIXTURES="${HERE}/workflow-issue-text/fixtures"
WORKFLOWS="${ROOT}/.github/workflows"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/issue-text-gate.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0

# expect <arm-name> <target> <want-rc> <needle> [needle...]
expect() {
  local name="$1" target="$2" want_rc="$3"; shift 3
  local out="${SCRATCH}/${name}.out" rc
  python3 "${SCAN}" "${target}" > "${out}" 2>&1 && rc=0 || rc=$?
  if [ "${rc}" -ne "${want_rc}" ]; then
    echo "FAIL[${name}]: exit ${rc}, wanted ${want_rc}"; cat "${out}"; fail=1; return
  fi
  local needle
  for needle in "$@"; do
    if ! grep -qF "${needle}" "${out}"; then
      echo "FAIL[${name}]: output missing '${needle}':"; cat "${out}"; fail=1; return
    fi
  done
  echo "PASS[${name}]"
}

# Unsafe shapes, each must be a finding (rc 1) and named.
expect unsafe-file "${FIXTURES}/unsafe-model-token-and-issue-text.yml" 1 \
  "unsafe-model-token-and-issue-text" "reads issue/comment text" "id-token: write" "secrets.CLAUDE_CODE_OAUTH_TOKEN"
expect unsafe-deep-indent "${FIXTURES}/unsafe-deep-indent.yml" 1 \
  "unsafe-deep-indent" "reads issue/comment text"
expect unsafe-top-env "${FIXTURES}/unsafe-top-level-env.yml" 1 \
  "unsafe-top-level-env" "reads issue/comment text" "secrets.MODEL_API_TOKEN"
expect unsafe-inherit "${FIXTURES}/unsafe-secrets-inherit.yml" 1 \
  "unsafe-secrets-inherit" "reads issue/comment text" "secrets: inherit"

# XREVIEW 6209271782 P2: job properties at any indent, and a quoted job key
# ahead of a safe job, must still be inspected (a finding) or refused (rc 2);
# a PASS on either is the bypass.
expect unsafe-deep-props "${FIXTURES}/unsafe-job-perms-deep-props.yml" 1 \
  "unsafe-job-perms-deep-props" "reads issue/comment text" "id-token: write"
expect unsafe-quoted-job "${FIXTURES}/unsafe-quoted-job-name.yml" 1 \
  "unsafe-quoted-job-name" "job 'triage'" "id-token: write"

# Security review of 5b84e983: write-all and a quoted id-token grant are the
# same credential as id-token: write.
expect unsafe-write-all "${FIXTURES}/unsafe-write-all.yml" 1 \
  "unsafe-write-all" "reads issue/comment text" "permissions: write-all"
expect unsafe-quoted-id-token "${FIXTURES}/unsafe-quoted-id-token.yml" 1 \
  "unsafe-quoted-id-token" "reads issue/comment text" "id-token: write"

# Safe split must pass (rc 0, PASS message).
expect safe-split "${FIXTURES}/safe-read-model-apply-split.yml" 0 "PASS"

# A workflow whose jobs block yields zero parsed jobs is a scanner error
# (rc 2), never a pass: a gate that saw nothing verified nothing.
expect no-jobs "${FIXTURES}/bad-no-jobs.yml" 2 "no jobs"

# The live tree must pass, and the PASS line must report a nonzero scan
# count so an empty glob cannot read as a green sweep.
live_out="${SCRATCH}/live.out"
if python3 "${SCAN}" "${WORKFLOWS}" > "${live_out}" 2>&1; then
  scanned=$(sed -n 's/^PASS: \([0-9][0-9]*\) workflow file.*$/\1/p' "${live_out}")
  if [ -n "${scanned}" ] && [ "${scanned}" -gt 0 ]; then
    echo "PASS[live-tree]: ${scanned} workflow files scanned"
  else
    echo "FAIL[live-tree]: no scan count in PASS line:"; cat "${live_out}"; fail=1
  fi
else
  echo "FAIL[live-tree]: exit nonzero:"; cat "${live_out}"; fail=1
fi

exit "${fail}"

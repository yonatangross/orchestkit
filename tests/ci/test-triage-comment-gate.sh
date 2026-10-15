#!/usr/bin/env bash
# Gate test for scripts/ci/gate-triage-comment.py (#4747 review round 2,
# SHOULD 1): the public triage comment must pass a check before posting.
# exit 0 = safe body written to the output path, exit 1 = rejected (the
# caller posts a short fallback note instead).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
GATE="${ROOT}/scripts/ci/gate-triage-comment.py"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/triage-gate.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0

# check <name> <want-rc> <infile> [present-needle] [absent-needle]
# rc 0 rows also assert the written output; rc 1 rows only assert refusal.
check() {
  local name="$1" want_rc="$2" infile="$3" yes="${4:-}" no="${5:-}" rc
  rm -f "${SCRATCH}/${name}.safe.md"
  python3 "${GATE}" "${infile}" "${SCRATCH}/${name}.safe.md" > "${SCRATCH}/${name}.log" 2>&1 && rc=0 || rc=$?
  if [ "${rc}" -ne "${want_rc}" ]; then
    echo "FAIL[${name}]: exit ${rc}, wanted ${want_rc}"; cat "${SCRATCH}/${name}.log"; fail=1; return
  fi
  if [ "${rc}" -eq 0 ]; then
    if [ ! -s "${SCRATCH}/${name}.safe.md" ]; then
      echo "FAIL[${name}]: exit 0 but no output written"; fail=1; return
    fi
    if [ -n "${yes}" ] && ! grep -qF "${yes}" "${SCRATCH}/${name}.safe.md"; then
      echo "FAIL[${name}]: output missing '${yes}':"; cat "${SCRATCH}/${name}.safe.md"; fail=1; return
    fi
    if [ -n "${no}" ] && grep -qF "${no}" "${SCRATCH}/${name}.safe.md"; then
      echo "FAIL[${name}]: output still contains '${no}':"; cat "${SCRATCH}/${name}.safe.md"; fail=1; return
    fi
  fi
  echo "PASS[${name}]"
}

printf '## Triage Summary\n\n| Field | Value |\n| - | - |\n| Type | bug |\n\nAll clean here.\n' > "${SCRATCH}/ok.md"
check clean 0 "${SCRATCH}/ok.md" "All clean here"

printf 'Looks good. cc @yonatangross please review.\n' > "${SCRATCH}/mention.md"
check mention 0 "${SCRATCH}/mention.md" '`@yonatangross`'

printf 'Details at https://evil.invalid/exfil and https://github.com/a/b/issues/1\n' > "${SCRATCH}/link.md"
check outside-link 0 "${SCRATCH}/link.md" '`https://evil.invalid/exfil`' 'github.com/a/b/issues/1'

printf 'token is ghp_0123456789abcdef0123456789abcdef1234 now\n' > "${SCRATCH}/tok.md"
check token 1 "${SCRATCH}/tok.md"

: > "${SCRATCH}/empty.md"
check empty 1 "${SCRATCH}/empty.md"

python3 -c "open('${SCRATCH}/big.md','w').write('x' * 20000)"
check oversize 1 "${SCRATCH}/big.md"

exit "${fail}"

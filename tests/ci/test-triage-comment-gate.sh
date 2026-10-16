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
check outside-link 0 "${SCRATCH}/link.md" '`https://evil.invalid/exfil`'
# An allowlisted host must pass through untouched.
if ! grep -qF 'https://github.com/a/b/issues/1' "${SCRATCH}/outside-link.safe.md" 2>/dev/null; then
  echo "FAIL[outside-link]: allowlisted link was neutralized:"; cat "${SCRATCH}/outside-link.safe.md" 2>/dev/null; fail=1
fi

# XREVIEW 6209271782 P1a: a mention already inside a code span must not be
# turned into a live mention by the wrapping. Any exit 0 output must keep it
# inside one code span; refusing (exit 1) is also safe.
printf '`hello @yonatangross world`\n' > "${SCRATCH}/codespan.md"
check_safe_or_refused() {
  local name="$1" infile="$2" rc
  rm -f "${SCRATCH}/${name}.safe.md"
  python3 "${GATE}" "${infile}" "${SCRATCH}/${name}.safe.md" > "${SCRATCH}/${name}.log" 2>&1 && rc=0 || rc=$?
  if [ "${rc}" -eq 1 ]; then echo "PASS[${name}]: refused"; return; fi
  if [ "${rc}" -ne 0 ]; then echo "FAIL[${name}]: exit ${rc}"; cat "${SCRATCH}/${name}.log"; fail=1; return; fi
  if ! python3 "${HERE}/triage-gate-live-check.py" "${SCRATCH}/${name}.safe.md"; then
    echo "FAIL[${name}]: exit 0 output still has a live mention or outside link:"; cat "${SCRATCH}/${name}.safe.md"; fail=1; return
  fi
  echo "PASS[${name}]: neutralized"
}
check_safe_or_refused codespan-mention "${SCRATCH}/codespan.md"

# XREVIEW 6209271782 P1b: uppercase schemes, Markdown link targets and
# reference definitions must not leave a clickable outside link.
printf 'See [Required fix](HTTPS://example.invalid/fix) now.\n' > "${SCRATCH}/mdlink.md"
check_safe_or_refused md-inline-link "${SCRATCH}/mdlink.md"
printf 'See [Required fix][x] now.\n\n[x]: //example.invalid/fix\n' > "${SCRATCH}/reflink.md"
check_safe_or_refused md-reference-link "${SCRATCH}/reflink.md"
printf 'Go to HTTPS://example.invalid/fix today.\n' > "${SCRATCH}/upper.md"
check_safe_or_refused uppercase-scheme "${SCRATCH}/upper.md"
printf 'Pic ![x](https://example.invalid/p.png) and <a href="https://example.invalid">a</a>.\n' > "${SCRATCH}/html.md"
check_safe_or_refused image-and-html-link "${SCRATCH}/html.md"
printf 'Visit www.example.invalid/fix soon.\n' > "${SCRATCH}/www.md"
check_safe_or_refused www-autolink "${SCRATCH}/www.md"

# Control: a Markdown link to an allowlisted https target still posts.
printf 'Dup of [#12](https://github.com/a/b/issues/12).\n' > "${SCRATCH}/okmd.md"
check allowed-md-link 0 "${SCRATCH}/okmd.md" '[#12](https://github.com/a/b/issues/12)'

printf 'token is ghp_0123456789abcdef0123456789abcdef1234 now\n' > "${SCRATCH}/tok.md"
check token 1 "${SCRATCH}/tok.md"

: > "${SCRATCH}/empty.md"
check empty 1 "${SCRATCH}/empty.md"

python3 -c "open('${SCRATCH}/big.md','w').write('x' * 20000)"
check oversize 1 "${SCRATCH}/big.md"

exit "${fail}"

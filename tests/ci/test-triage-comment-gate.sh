#!/usr/bin/env bash
# Gate test for scripts/ci/gate-triage-comment.py (#4747 review round 2,
# SHOULD 1): the public triage comment must pass a check before posting.
# exit 0 = safe body written to the output path, exit 1 = rejected (the
# caller posts a short fallback note instead). Every exit 0 output is also
# judged by tests/ci/triage-gate-live-check.py, a CommonMark oracle written
# apart from the gate: no live mention, link, image or raw HTML may remain.
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
    if ! python3 "${HERE}/triage-gate-live-check.py" "${SCRATCH}/${name}.safe.md"; then
      echo "FAIL[${name}]: output has a live mention, link or html:"; cat "${SCRATCH}/${name}.safe.md"; fail=1; return
    fi
  fi
  echo "PASS[${name}]"
}

printf '## Triage Summary\n\n| Field | Value |\n| - | - |\n| Type | bug |\n\nAll clean here.\n' > "${SCRATCH}/ok.md"
check clean 0 "${SCRATCH}/ok.md" "All clean here"

printf 'Looks good. cc @yonatangross please review.\n' > "${SCRATCH}/mention.md"
check mention 0 "${SCRATCH}/mention.md" 'cc @yonatangross please'

printf 'Details at https://evil.invalid/exfil and https://github.com/a/b/issues/1\n' > "${SCRATCH}/link.md"
check outside-link 0 "${SCRATCH}/link.md" 'https://evil.invalid/exfil and https://github.com/a/b/issues/1'

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

# Security review of 5b84e983: inside a raw HTML block the wrap backticks
# stay literal and GitHub still links the mention; a backslash or userinfo in
# the authority makes Python and the browser disagree on the host.
printf '<details>\n@yonatangross\n</details>\n' > "${SCRATCH}/htmlblock.md"
check_safe_or_refused html-block-mention "${SCRATCH}/htmlblock.md"
printf 'See [fix](https://evil.invalid\\.github.com/x) now.\n' > "${SCRATCH}/bslink.md"
check_safe_or_refused backslash-host-md "${SCRATCH}/bslink.md"
printf 'See https://evil.invalid\\.github.com/x now.\n' > "${SCRATCH}/bsbare.md"
check_safe_or_refused backslash-host-bare "${SCRATCH}/bsbare.md"
printf 'See https://github.com@evil.invalid/x now.\n' > "${SCRATCH}/userinfo.md"
check_safe_or_refused userinfo-host "${SCRATCH}/userinfo.md"

# The fence must hold against a body that tries to close it: a backtick
# fence, a longer one, a tilde fence and a CRLF line break before a mention.
printf 'x\n```\n@yonatangross\n```\n' > "${SCRATCH}/fence3.md"
check fence-close-3 0 "${SCRATCH}/fence3.md" '@yonatangross'
printf 'x\n``````````\n@yonatangross https://evil.invalid/a\n' > "${SCRATCH}/fence10.md"
check fence-close-10 0 "${SCRATCH}/fence10.md" '@yonatangross'
printf 'x\n~~~~\n@yonatangross\n' > "${SCRATCH}/tilde.md"
check fence-tilde 0 "${SCRATCH}/tilde.md" '@yonatangross'
printf 'x\r\n```\r\n@yonatangross\r\n' > "${SCRATCH}/crlf.md"
check fence-crlf 0 "${SCRATCH}/crlf.md" '@yonatangross'

# Control: the text of a Markdown link to an allowlisted target still posts.
printf 'Dup of [#12](https://github.com/a/b/issues/12).\n' > "${SCRATCH}/okmd.md"
check allowed-md-link 0 "${SCRATCH}/okmd.md" '[#12](https://github.com/a/b/issues/12)'

printf 'token is ghp_0123456789abcdef0123456789abcdef1234 now\n' > "${SCRATCH}/tok.md"
check token 1 "${SCRATCH}/tok.md"

# The rejection log lands in a public CI job log, so it must name the rule
# and the line but hold no part of the matched value (102 HOLD CLEAN nit 1).
# Any 4-character window of the planted token found in the log is a leak.
printf 'line one\nkey ghp_Zq7Wk3Lm9Xp2Rt5Vb8Nc4Hd6Jf1Gs0Ay3Ue now\n' > "${SCRATCH}/leak.md"
python3 "${GATE}" "${SCRATCH}/leak.md" "${SCRATCH}/leak.safe.md" > "${SCRATCH}/leak.log" 2>&1 && rc=0 || rc=$?
if [ "${rc}" -ne 1 ]; then
  echo "FAIL[no-token-in-log]: exit ${rc}, wanted 1"; fail=1
elif python3 - "${SCRATCH}/leak.log" <<'PY'
import sys
log = open(sys.argv[1]).read()
tok = "ghp_Zq7Wk3Lm9Xp2Rt5Vb8Nc4Hd6Jf1Gs0Ay3Ue"
body = tok[len("ghp_"):]
sys.exit(0 if any(body[i:i + 4] in log for i in range(len(body) - 3)) or tok[:6] in log else 1)
PY
then
  echo "FAIL[no-token-in-log]: rejection log holds part of the planted token:"; cat "${SCRATCH}/leak.log"; fail=1
elif ! grep -q "leak.md:2" "${SCRATCH}/leak.log" || ! grep -q "rule " "${SCRATCH}/leak.log"; then
  echo "FAIL[no-token-in-log]: log does not name the rule and file:line:"; cat "${SCRATCH}/leak.log"; fail=1
else
  echo "PASS[no-token-in-log]"
fi

: > "${SCRATCH}/empty.md"
check empty 1 "${SCRATCH}/empty.md"

python3 -c "open('${SCRATCH}/big.md','w').write('x' * 20000)"
check oversize 1 "${SCRATCH}/big.md"

exit "${fail}"

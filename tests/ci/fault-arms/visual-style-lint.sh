#!/usr/bin/env bash
# Gate: bin/validate-visual-style.py :162 (violations empty -> return 0), used by
# .github/workflows/visual-style-lint.yml:71 (--env PR_TITLE) and :77 (--env PR_BODY)
set -uo pipefail
H="${H:?set by the fault-arms runner}"
REPO="${REPO:?set by the fault-arms runner}"
S="$REPO/bin/validate-visual-style.py"
F="$H/fixtures/visual-style"; rm -rf "$F"; mkdir -p "$F"

t() { # mode env-name -> rc, with env set via caller
  python3 "$S" --mode "$1" --env "$2" >>"$F/log.txt" 2>&1; echo $?
}
: > "$F/log.txt"

# title arm
control_rc=$(PR_TITLE="fix(ci): tighten the dead-gate audit" t title PR_TITLE)
BAD_TITLE=$(printf 'fix(ci): tighten \xf0\x9f\x94\xa5 the audit')
control2_rc=$(PR_TITLE="$BAD_TITLE" t title PR_TITLE)
fault_rc=$(env -u PR_TITLE python3 "$S" --mode title --env PR_TITLE >>"$F/log.txt" 2>&1; echo $?)
fault2_rc=$(PR_TITLE="" t title PR_TITLE)
# the realistic drift: the workflow's env name is renamed/typoed
fault3_rc=$(PR_TITLE="$BAD_TITLE" t title PR_TTILE)

# body arm
BAD_BODY=$(printf 'summary\n\xe2\x9c\x93 done\n')
bcontrol_rc=$(PR_BODY=$'summary\n\xe2\x9c\x85 done' t body PR_BODY)
bcontrol2_rc=$(PR_BODY="$BAD_BODY" t body PR_BODY)
bfault_rc=$(env -u PR_BODY python3 "$S" --mode body --env PR_BODY >>"$F/log.txt" 2>&1; echo $?)
bfault2_rc=$(PR_BODY="" t body PR_BODY)

cat "$F/log.txt" >&2
printf 'RESULT gate=%s control=%s control2=%s fault=%s fault2=%s fault3=%s body_control=%s body_control2=%s body_fault=%s body_fault2=%s\n' \
  visual-style-lint "$control_rc" "$control2_rc" "$fault_rc" "$fault2_rc" "$fault3_rc" \
  "$bcontrol_rc" "$bcontrol2_rc" "$bfault_rc" "$bfault2_rc"

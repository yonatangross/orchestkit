#!/usr/bin/env bash
# payload-coverage.py must refuse a Bash() rule with a mid-pattern ':*'.
#
# CC 2.1.282 CHANGELOG: "Fixed Bash permission rules with a mid-pattern `:*`
# being skipped in settings files while `--allowedTools` honored them". The
# supported floor is 2.1.277 (shared/cc-support.json), so on 2.1.277 to 2.1.281
# such a rule in the operator's settings is still dead: #3849 measured
# Bash(find:*-delete*) identical to no rule. The shipped payload uses the space
# form (Bash(find *-delete*)); this test keeps the dead shape from coming back.
# A trailing ':*' (Bash(git push:*)) was never skipped and stays allowed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
COVERAGE="${ROOT}/tests/ci/restricted-smoke/payload-coverage.py"
PAYLOAD="${ROOT}/src/skills/setup/references/operator-permissions.json"
CASES="${ROOT}/tests/ci/restricted-smoke/payload-trip-cases.json"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/colon-star.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0

# Write a payload + case map with one extra rule (and a matching case, so only
# the colon-star check can fire) to $SCRATCH/<tag>-{payload,cases}.json.
with_rule() {
  python3 - "${PAYLOAD}" "${CASES}" "${SCRATCH}" "$1" "$2" <<'PY'
import json, sys
payload, cases, scratch, tag, rule = sys.argv[1:6]
p = json.load(open(payload)); c = json.load(open(cases))
p["deny"].append(rule)
c["cases"].append({"rule": rule, "kind": "bash", "mode": "not-live", "reason": "fixture"})
json.dump(p, open(f"{scratch}/{tag}-payload.json", "w"))
json.dump(c, open(f"{scratch}/{tag}-cases.json", "w"))
PY
}

# 1. The shipped payload passes.
if ! python3 "${COVERAGE}" "${PAYLOAD}" "${CASES}" > "${SCRATCH}/shipped.out" 2>&1; then
  echo "FAIL: shipped payload rejected:"; cat "${SCRATCH}/shipped.out"; fail=1
else
  echo "PASS: shipped payload has no mid-pattern ':*' rule"
fi

# 2. A mid-pattern ':*' rule is refused and named.
with_rule mid 'Bash(find:*-delete*)'
if python3 "${COVERAGE}" "${SCRATCH}/mid-payload.json" "${SCRATCH}/mid-cases.json" > "${SCRATCH}/mid.out" 2>&1; then
  echo "FAIL: mid-pattern ':*' rule was accepted"; cat "${SCRATCH}/mid.out"; fail=1
elif ! grep -qF 'Bash(find:*-delete*)' "${SCRATCH}/mid.out"; then
  echo "FAIL: refusal does not name the rule:"; cat "${SCRATCH}/mid.out"; fail=1
else
  echo "PASS: mid-pattern ':*' rule refused and named"
fi

# 3. A trailing ':*' rule is not flagged.
with_rule tail 'Bash(git push --force:*)'
if ! python3 "${COVERAGE}" "${SCRATCH}/tail-payload.json" "${SCRATCH}/tail-cases.json" > "${SCRATCH}/tail.out" 2>&1; then
  echo "FAIL: trailing ':*' rule was refused:"; cat "${SCRATCH}/tail.out"; fail=1
else
  echo "PASS: trailing ':*' rule accepted"
fi

exit "${fail}"

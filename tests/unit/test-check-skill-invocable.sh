#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/ork.skill-invocable.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT

mkdir -p "$FIXTURE"/{bin,manifests,src/skills/{assess,careful},plugins/{ork/skills/{assess,careful},ork-extras/skills/careful}}
cp "$ROOT/bin/check-skill-invocable.sh" "$FIXTURE/bin/"
cp "$ROOT/manifests/"*.json "$FIXTURE/manifests/"
for skill in assess careful; do
    cp "$ROOT/src/skills/$skill/SKILL.md" "$FIXTURE/src/skills/$skill/"
done
cp "$ROOT/plugins/ork/skills/assess/SKILL.md" "$FIXTURE/plugins/ork/skills/assess/"
cp "$ROOT/plugins/ork-extras/skills/careful/SKILL.md" "$FIXTURE/plugins/ork-extras/skills/careful/"

CHECK="$FIXTURE/bin/check-skill-invocable.sh"
failures=0
pass() { printf 'PASS: %s\n' "$1"; }
fail() {
    printf 'FAIL: %s\n%s\n' "$1" "$output"
    failures=$((failures + 1))
}

if output="$(bash "$CHECK" assess)" && [[ "$output" == *"VERDICT: /ork:assess is INVOCABLE"* ]]; then
    pass "core skill reports the ork namespace"
else
    fail "core skill should be invocable as /ork:assess"
fi

extras_copy="$FIXTURE/plugins/ork-extras/skills/careful/SKILL.md"
if output="$(bash "$CHECK" careful)" && [[ "$output" == *"VERDICT: /ork-extras:careful is INVOCABLE"* && "$output" == *"$extras_copy"* ]]; then
    pass "extras skill reports its namespace and built path"
else
    fail "extras skill should be invocable from its ork-extras build"
fi

if output="$(bash "$CHECK" --all)" && [[ "$output" == *"OK: all 2 skills consistent"* ]]; then
    pass "sweep accepts both manifests' built skills"
else
    fail "sweep should not flag the built extras skill"
fi

mv "$extras_copy" "$FIXTURE/plugins/ork/skills/careful/SKILL.md"
if output="$(bash "$CHECK" careful)"; then
    fail "a copy under the wrong plugin should not satisfy the check"
elif [[ $? == 1 &&
    "$output" == *"FAIL [5/6] no built copy: $extras_copy"* &&
    "$output" == *"VERDICT: /ork-extras:careful is NOT invocable"* ]]; then
    pass "missing extras build reports the owning plugin's path"
else
    fail "missing extras build should name the expected path and fail"
fi

printf '%s\n' '{' > "$FIXTURE/manifests/ork-extras.json"
for probe in assess --all; do
    status=0
    output="$(bash "$CHECK" "$probe" 2>&1)" || status=$?
    if [[ "$status" == 2 &&
        "$output" == *"ERROR: could not read manifest $FIXTURE/manifests/ork-extras.json:"* &&
        "$output" != *"VERDICT:"* && "$output" != *"DRIFT:"* ]]; then
        pass "invalid manifest is a checker error for $probe"
    else
        fail "invalid manifest should exit 2 with a manifest error for $probe, got $status"
    fi
done

[[ "$failures" == 0 ]]

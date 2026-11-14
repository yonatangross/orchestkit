#!/usr/bin/env bash
# Test: plugin workflows are launched by name, and a refused dispatch is disclosed (#5183)
#
# A Workflow call with scriptPath="${CLAUDE_SKILL_DIR}/workflows/<file>.js" points
# into the installed plugin cache. CC 2.1.322 hard-denies a scriptPath the session
# cannot already read, so `claude -p` (no --add-dir) is refused. Every workflow in
# manifests/ork.json is also registered as ork:<meta.name>, and a name launch skips
# the readable-path check. So no skill may launch a manifest workflow by scriptPath.
#
# Second guard: verify's STEP 0b must say that a refused/failed Workflow call is
# named in the report and caps the verdict, because verify-dispatch.js is the only
# place the refuter majority and evidence cap run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="$REPO_ROOT/src/skills"
MANIFEST="$REPO_ROOT/manifests/ork.json"

FAILED=0
fail() { echo "FAIL: $1"; FAILED=1; }
pass() { echo "PASS: $1"; }

echo "=== Workflow calls by name test ==="

files="$(node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const w of m.workflows) console.log(w);
' "$MANIFEST")"

# manifest paths hold no spaces, so plain word splitting is safe here
for wf in $files; do
    base="$(basename "$wf")"
    # the quote char is matched with a dot: meta.name is single-quoted in some files
    name="$(sed -nE 's/^[[:space:]]*name:[[:space:]]*.([a-z0-9-]+).,?.*/\1/p' "$REPO_ROOT/src/$wf" | sed -n 1p)"
    if [[ -z "$name" ]]; then fail "$wf: no meta.name found"; continue; fi

    # grep exits 1 on no match, which is the passing case here
    if hits="$(grep -rn --include="*.md" "scriptPath.*workflows/$base" "$SKILLS_DIR")"; then
        fail "$base launched by scriptPath, use name \"ork:$name\":"
        echo "$hits" | sed 's/^/    /'
    else
        pass "$base has no scriptPath call"
    fi
done

# Each skill that runs a manifest workflow must carry the by-name call.
for pair in "verify:verify-dispatch" "assess:assess-fanout" "review-pr:review-fanout" \
            "review-pr:rule-check" "cover:heal-loop" "bare-eval:skill-fitness" \
            "audit-full:audit-full-mapreduce" "brainstorm:brainstorm-diverge"; do
    skill="${pair%%:*}"; wfname="${pair##*:}"
    if grep -rq --include="*.md" "ork:$wfname" "$SKILLS_DIR/$skill"; then
        pass "$skill names ork:$wfname"
    else
        fail "$skill never names ork:$wfname"
    fi
done

# Fallback disclosure and cap in verify.
verify_md="$SKILLS_DIR/verify/SKILL.md"
if grep -q "verify-dispatch workflow not run" "$verify_md"; then
    pass "verify SKILL.md has the fallback disclosure line"
else
    fail "verify SKILL.md lacks 'verify-dispatch workflow not run' disclosure line"
fi
if grep -q "IMPROVEMENTS RECOMMENDED at most" "$verify_md"; then
    pass "verify SKILL.md caps the verdict on fallback"
else
    fail "verify SKILL.md lacks the 'IMPROVEMENTS RECOMMENDED at most' fallback cap"
fi

if [[ $FAILED -ne 0 ]]; then echo "RESULT: FAILED"; exit 1; fi
echo "RESULT: PASSED"

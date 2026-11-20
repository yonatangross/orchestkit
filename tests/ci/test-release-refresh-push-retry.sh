#!/usr/bin/env bash
# Test: the release-please.yml "Refresh CHANGELOG-derived files on the release
# PR" step retries its push and fails loudly (#5054). The step used to be
# continue-on-error:true and its push ended in `::warning::Could not push ...`
# with exit 0, so a transient 5xx left the release PR without the refresh
# commit (red on "Build drift detected") while the release run stayed green
# (10.8.2, run 41809233158).
#
# Pattern: tests/ci/test-release-rebuild-fail-closed.sh. The step body is
# lifted LIVE from the workflow YAML by step name and run under `bash -e`
# against a bare-origin fixture. Externals are PATH shims: gh (PR lookup),
# node (the two generators; touches README.md so there is something to
# commit), sleep (records the backoff, never waits), git (push and, for the
# moved-head arm, ls-remote; everything else delegates to the real binary).
#
# Arms (rc and the annotation that must be present):
#   no continue-on-error     structural: the step carries no such key
#   rebuild runs after fail  structural: the next two steps run under !cancelled()
#   no warning-only push     text: the old `::warning::Could not push` line is gone
#   push ok first time       rc 0  ::notice:: attempt 1, no sleep
#   push fails once          rc 0  ::notice:: attempt 2, one sleep of 10s
#   push fails twice         rc 0  ::notice:: attempt 3, sleeps 10s then 30s
#   push always fails        rc 1  ::error::  after 3 push attempts (10s, 30s)
#   push fails, head moved   rc 0  ::notice:: after 1 push attempt (new head owns it)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="$REPO_ROOT/.github/workflows/release-please.yml"
STEP="Refresh CHANGELOG-derived files on the release PR"
BRANCH="release-please--v10.0.1"

echo "=== release refresh push retry arms ==="
echo ""

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-rrpr.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------- structural arms
# pipebuf: bounded-literal. The heredoc body is fixed by this file and python3 is the foreground reader.
STRUCT="$(python3 - "$WF" "$STEP" <<'PY'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1]))
steps = []
for job in (wf.get("jobs") or {}).values():
    steps = job.get("steps") or []
    names = [s.get("name") for s in steps if isinstance(s, dict)]
    if sys.argv[2] in names:
        break
by_name = {s.get("name"): s for s in steps if isinstance(s, dict)}
step = by_name.get(sys.argv[2])
if step is None:
    print("step-missing"); sys.exit(0)
print("coe=" + ("present" if "continue-on-error" in step else "absent"))
for n in ("Setup Node.js for the bundle rebuild", "Rebuild hook bundles on the release PR"):
    s = by_name.get(n) or {}
    print("if[%s]=%s" % (n, s.get("if")))
PY
)" || STRUCT="parse error"

case "$STRUCT" in
    "coe=absent"*) ok "refresh step carries no continue-on-error key" ;;
    *) bad "refresh step continue-on-error: $STRUCT (want coe=absent)" ;;
esac
# Count the !cancelled() guards with parameter expansion: no pipe, no here-string.
NEEDLE='!cancelled()'
CANCEL_ONLY="${STRUCT//"$NEEDLE"/}"
CANCEL_COUNT=$(( (${#STRUCT} - ${#CANCEL_ONLY}) / ${#NEEDLE} ))
if [ "$CANCEL_COUNT" = "2" ]; then
    ok "bundle rebuild steps run under !cancelled() so a failed refresh does not skip them"
else
    bad "bundle rebuild steps lost !cancelled() (found $CANCEL_COUNT, want 2): $STRUCT"
fi

# extract_step <yml> <step name> -> prints the dedented `run: |` body.
extract_step() {
    awk -v want="$2" '
        function indent(s,  m) { match(s, /^ */); return RLENGTH }
        BEGIN { state = 0 }
        state == 0 && $0 ~ "^ *- name: " {
            name = $0; sub(/^ *- name: /, "", name); sub(/ *$/, "", name)
            if (name == want) state = 1
            next
        }
        state == 1 && $0 ~ /^ *run: \|/ { runind = indent($0); state = 2; next }
        state == 1 && $0 ~ "^ *- name: " { exit }
        state == 2 {
            if ($0 ~ /^ *$/) { print ""; next }
            if (indent($0) <= runind) exit
            print substr($0, runind + 3)
        }
    ' "$1"
}

B="$WORK/step.sh"
extract_step "$WF" "$STEP" > "$B"
if [ ! -s "$B" ]; then
    echo "  FAIL: could not lift step body (renamed?)"
    exit 1
fi

# The old failure path: a push error that only warns. This line brings the bug
# back; mutation check: restore it and this arm fails.
if grep -q '::warning::Could not push' "$B"; then
    bad "step still has a warning-only push failure path ('::warning::Could not push')"
else
    ok "no warning-only push failure path"
fi

# ------------------------------------------------------------------ shims
SHIMS="$WORK/shims"; mkdir -p "$SHIMS"
REAL_GIT="$(command -v git)"

# pipebuf: bounded-literal. Heredoc redirected straight to a regular file, size fixed by this file.
cat > "$SHIMS/gh" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  printf '[{"headRefName":"%s","author":{"login":"app/orchestkit-release-bot"},"number":5054}]\n' "$RRPR_BRANCH"
  exit 0
fi
echo "gh shim: unexpected call: $*" >&2
exit 64
EOF

# node: stands in for stamp-whats-new and generate-changelog-data. The first
# generator appends a line to README.md so the derived files differ.
# pipebuf: bounded-literal. Heredoc redirected straight to a regular file, size fixed by this file.
cat > "$SHIMS/node" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  */stamp-whats-new.mjs) printf 'refreshed\n' >> "$WHATS_NEW_ROOT/README.md" ;;
esac
exit 0
EOF

# pipebuf: bounded-literal. Heredoc redirected straight to a regular file, size fixed by this file.
cat > "$SHIMS/sleep" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$1" >> "$RRPR_ROOT/.rrpr-sleeps"
exit 0
EOF

# git: RRPR_PUSH_FAILS=N fails the first N pushes (exit 128, like a 500), and
# every push is counted. RRPR_LS_REMOTE_SHA fakes a moved remote head.
# pipebuf: bounded-literal. Heredoc redirected straight to a regular file, size fixed by this file.
cat > "$SHIMS/git" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "push" ]; then
  n=0; [ -f "\$RRPR_ROOT/.rrpr-pushes" ] && n=\$(wc -l < "\$RRPR_ROOT/.rrpr-pushes")
  printf 'push\n' >> "\$RRPR_ROOT/.rrpr-pushes"
  if [ "\$n" -lt "\${RRPR_PUSH_FAILS:-0}" ]; then
    echo "remote: Internal Server Error (git shim)" >&2
    exit 128
  fi
  exit 0
fi
if [ "\${1:-}" = "ls-remote" ] && [ -n "\${RRPR_LS_REMOTE_SHA:-}" ]; then
  printf '%s\t%s\n' "\$RRPR_LS_REMOTE_SHA" "\${3:-refs/heads/x}"
  exit 0
fi
exec "$REAL_GIT" "\$@"
EOF
chmod +x "$SHIMS/gh" "$SHIMS/node" "$SHIMS/sleep" "$SHIMS/git"

# ---------------------------------------------------------------- fixture
make_fixture() {
    local d="$1" r
    git init -q --bare "$d/origin.git"
    # silent: known-noise empty bare clone may warn on unborn HEAD; fixture re-inits below
    git clone -q "$d/origin.git" "$d/repo" 2>/dev/null || true
    r="$d/repo"
    git -C "$r" checkout -qB main
    git -C "$r" config user.email t@t
    git -C "$r" config user.name t
    git -C "$r" config commit.gpgsign false
    mkdir -p "$r/scripts" "$r/docs/site/lib/generated"
    printf '// stub\n' > "$r/scripts/stamp-whats-new.mjs"
    printf '// stub\n' > "$r/scripts/generate-changelog-data.js"
    printf 'base\n' > "$r/README.md"
    printf 'data\n' > "$r/docs/site/lib/generated/changelog-data.ts"
    git -C "$r" add -A
    git -C "$r" commit -qm base
    git -C "$r" push -q origin main
    git -C "$r" checkout -qb "$BRANCH"
    printf 'changelog\n' > "$r/CHANGELOG.md"
    git -C "$r" add CHANGELOG.md
    git -C "$r" commit -qm release
    git -C "$r" push -q origin "$BRANCH"
    git -C "$r" checkout -q main
    mkdir -p "$d/tmp"
}

# run_arm <dir> [VAR=value ...] -> rc; output in $1/step.out
run_arm() {
    local d="$1"; shift
    local rc=0
    (
        cd "$d/repo" \
        && env PATH="$SHIMS:$PATH" RRPR_BRANCH="$BRANCH" RRPR_ROOT="$d/repo" GH_TOKEN=fake-token \
           GITHUB_REPOSITORY=yonatangross/orchestkit GITHUB_WORKSPACE="$d/repo" RUNNER_TEMP="$d/tmp" "$@" \
           bash -e "$B" > "$d/step.out" 2>&1
    ) || rc=$?
    echo "$rc"
}
pushes() {
    local f="$1/repo/.rrpr-pushes" n=0 line
    if [ -f "$f" ]; then
        while IFS= read -r line; do n=$((n + 1)); done < "$f"
    fi
    echo "$n"
}
sleeps() {
    local f="$1/repo/.rrpr-sleeps" out="" line
    if [ -f "$f" ]; then
        while IFS= read -r line; do out="${out:+$out }$line"; done < "$f"
    fi
    echo "$out"
}
outhas() { grep -q -- "$2" "$1/step.out"; }

# ------------------------------------------------ push ok first time
D="$WORK/first"; make_fixture "$D"
rc=$(run_arm "$D")
if [ "$rc" = "0" ] && [ "$(pushes "$D")" = "1" ] && [ -z "$(sleeps "$D")" ] \
   && outhas "$D" "::notice::Refreshed CHANGELOG-derived files on .*(attempt 1)"; then
    ok "push ok first time: rc=0, 1 push, no sleep"
else
    bad "first-try push: rc=$rc pushes=$(pushes "$D") sleeps='$(sleeps "$D")' $(tail -3 "$D/step.out")"
fi

# ------------------------------------------------ push fails once
D="$WORK/once"; make_fixture "$D"
rc=$(run_arm "$D" RRPR_PUSH_FAILS=1)
if [ "$rc" = "0" ] && [ "$(pushes "$D")" = "2" ] && [ "$(sleeps "$D")" = "10" ] \
   && outhas "$D" "(attempt 2)"; then
    ok "push fails once: retried after 10s, landed on attempt 2, rc=0"
else
    bad "push fails once: rc=$rc pushes=$(pushes "$D") sleeps='$(sleeps "$D")' $(tail -3 "$D/step.out")"
fi

# ------------------------------------------------ push fails twice
D="$WORK/twice"; make_fixture "$D"
rc=$(run_arm "$D" RRPR_PUSH_FAILS=2)
if [ "$rc" = "0" ] && [ "$(pushes "$D")" = "3" ] && [ "$(sleeps "$D")" = "10 30" ] \
   && outhas "$D" "(attempt 3)"; then
    ok "push fails twice: backoff 10s then 30s, landed on attempt 3, rc=0"
else
    bad "push fails twice: rc=$rc pushes=$(pushes "$D") sleeps='$(sleeps "$D")' $(tail -3 "$D/step.out")"
fi

# ------------------------------------------------ push always fails
D="$WORK/always"; make_fixture "$D"
rc=$(run_arm "$D" RRPR_PUSH_FAILS=99)
if [ "$rc" = "1" ] && [ "$(pushes "$D")" = "3" ] && [ "$(sleeps "$D")" = "10 30" ] \
   && outhas "$D" "::error::Could not push the CHANGELOG-derived refresh"; then
    ok "push always fails: 3 attempts, rc=1 ::error::"
else
    bad "push always fails: rc=$rc pushes=$(pushes "$D") sleeps='$(sleeps "$D")' $(tail -3 "$D/step.out")"
fi

# ------------------------------------------------ push fails, head moved
D="$WORK/moved"; make_fixture "$D"
rc=$(run_arm "$D" RRPR_PUSH_FAILS=99 RRPR_LS_REMOTE_SHA=0000000000000000000000000000000000000000)
if [ "$rc" = "0" ] && [ "$(pushes "$D")" = "1" ] && [ -z "$(sleeps "$D")" ] \
   && outhas "$D" "owns the refresh"; then
    ok "push fails, branch moved: 1 push, no retry, rc=0 ::notice::"
else
    bad "push fails, branch moved: rc=$rc pushes=$(pushes "$D") sleeps='$(sleeps "$D")' $(tail -3 "$D/step.out")"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

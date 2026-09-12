#!/usr/bin/env bash
# Behavioral regression coverage for the ASCII-density baseline ratchet (#4073).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork-ascii-density-ratchet.XXXXXX")"
FIXTURE="$TMP/fixture"
HOME_FIXTURE="$TMP/home"
PASS=0
FAIL=0

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

pass() { echo "  PASS $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL $1"; FAIL=$((FAIL + 1)); }

git_fixture() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX \
    -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY \
    HOME="$HOME_FIXTURE" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.test \
    GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.test \
    git -C "$FIXTURE" -c commit.gpgsign=false "$@"
}

run_gate() {
  local ref="${1:-}"
  GATE_RC=0
  if [ -n "$ref" ]; then
    GATE_OUT=$(cd "$FIXTURE" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX \
      -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY ASCII_DENSITY_BASE_REF="$ref" \
      bash tests/unit/test-ascii-density.sh 2>&1) || GATE_RC=$?
  else
    GATE_OUT=$(cd "$FIXTURE" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX \
      -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY -u ASCII_DENSITY_BASE_REF \
      bash tests/unit/test-ascii-density.sh 2>&1) || GATE_RC=$?
  fi
}

mkdir -p "$FIXTURE/tests/unit" "$FIXTURE/src/skills" "$HOME_FIXTURE" "$TMP/hooks"
cp "$ROOT/tests/unit/test-ascii-density.sh" "$FIXTURE/tests/unit/"
cp "$ROOT/tests/unit/ascii-density-baseline.tsv" "$FIXTURE/tests/unit/"
for skill in devops-deployment glyph memory-fabric swarm-migrate; do
  mkdir -p "$FIXTURE/src/skills/$skill"
  cp "$ROOT/src/skills/$skill/SKILL.md" "$FIXTURE/src/skills/$skill/"
done
mkdir -p "$FIXTURE/src/skills/nonbaseline"
printf '# Nonbaseline fixture\n' > "$FIXTURE/src/skills/nonbaseline/SKILL.md"

env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX \
  -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY \
  HOME="$HOME_FIXTURE" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
  git init -q --template="$TMP/hooks" "$FIXTURE"
git_fixture config core.hooksPath "$TMP/hooks"
git_fixture add .
git_fixture commit -q -m fixture

echo "ASCII density ratchet regression (#4073)"
run_gate
DEFER='base unresolvable: monotonic baseline check deferred to plugin-eval.yml'
defer_count=$(printf '%s\n' "$GATE_OUT" | awk -v line="$DEFER" '$0 == line { n++ } END { print n + 0 }')
if [ "$GATE_RC" -eq 0 ] && [ "$defer_count" -eq 1 ]; then
  pass "clean baseline census defers an unavailable base exactly once"
else
  fail "clean census rc=$GATE_RC defer_count=$defer_count -> $GATE_OUT"
fi

run_gate invalid-reference
if [ "$GATE_RC" -eq 1 ] && [[ "$GATE_OUT" == *"invalid reference 'invalid-reference'"* ]] &&
    [[ "$GATE_OUT" != *"$DEFER"* ]]; then
  pass "explicit invalid base reference fails without deferral"
else
  fail "invalid reference rc=$GATE_RC -> $GATE_OUT"
fi

printf '\n```text\n┌────┐\n│    │\n└────┘\n```\n' >> "$FIXTURE/src/skills/nonbaseline/SKILL.md"
run_gate
if [ "$GATE_RC" -eq 1 ] && [[ "$GATE_OUT" == *'density 0.000'* ]] &&
    { [[ "$GATE_OUT" == *'FAILED: total low-density blocks'* ]] ||
      [[ "$GATE_OUT" == *'FAILED: new low-density block in src/skills/nonbaseline/SKILL.md'* ]]; }; then
  pass "new nonbaseline low-density block fails"
else
  fail "nonbaseline block rc=$GATE_RC -> $GATE_OUT"
fi

echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" -eq 0 ]

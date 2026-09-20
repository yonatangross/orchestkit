#!/usr/bin/env bash
# Release bundles inherited from main (merge or plain tip restore) must pass.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT/bin/git-hooks/release-dist-paths.sh"
fixture=$(mktemp -d "${TMPDIR:-/tmp}/ork-release-dist.XXXXXX")
trap 'rm -rf "$fixture"' EXIT
cd "$fixture"
git init -q
git config user.email fixture@example.invalid
git config user.name Fixture
mkdir -p src/hooks/dist plugins/ork/hooks/dist
printf old > src/hooks/dist/bundle.mjs
printf old > plugins/ork/hooks/dist/bundle.mjs
git add .
git commit -qm base
base=$(git rev-parse HEAD)
printf release > src/hooks/dist/bundle.mjs
printf release > plugins/ork/hooks/dist/bundle.mjs
git add .
git commit -qm release
release=$(git rev-parse HEAD)
git update-ref refs/remotes/origin/main "$release"
git reset -q --hard "$base"
git read-tree "$release"
paths=$'src/hooks/dist/bundle.mjs\nplugins/ork/hooks/dist/bundle.mjs'
check() {
  local expected="$1" label="$2" actual
  actual=$(printf '%s\n' "$paths" | bash "$GUARD")
  [[ "$actual" == "$expected" ]] || { echo "FAIL: $label"; exit 1; }
  echo "PASS: $label"
}
# #4300: restore commit with no MERGE_HEAD must pass when index equals origin/main.
check '' 'plain restore matching origin/main tip allowed'
printf feature > src/hooks/dist/bundle.mjs
git add src/hooks/dist/bundle.mjs
check 'src/hooks/dist/bundle.mjs' 'authored dist change refused without MERGE_HEAD'
git read-tree "$release"
printf '%s\n' "$release" > .git/MERGE_HEAD
check '' 'unchanged incoming main bundles allowed'
printf feature > src/hooks/dist/bundle.mjs
git add src/hooks/dist/bundle.mjs
check 'src/hooks/dist/bundle.mjs' 'feature modification during merge rejected'
git read-tree "$release"
printf '%s\n' "$base" > .git/MERGE_HEAD
printf other > src/hooks/dist/bundle.mjs
printf other > plugins/ork/hooks/dist/bundle.mjs
git add src/hooks/dist/bundle.mjs plugins/ork/hooks/dist/bundle.mjs
check "$paths" 'index must match incoming parent or origin/main tip'
printf '%s\n' "$release" > .git/MERGE_HEAD
git read-tree "$release"
git update-ref refs/remotes/origin/main "$base"
check "$paths" 'non-main merge bundles rejected'
[[ -z "$(printf 'docs/example.html\n' | bash "$GUARD")" ]]
echo 'PASS: unrelated paths ignored'

# Exercise the installed pre-commit hook in a minimal repository. The helper
# is intentionally replaced for each case so the hook must distinguish a
# helper failure from an empty successful result.
HOOK="$ROOT/bin/git-hooks/pre-commit"
hook_fixture=$(mktemp -d "${TMPDIR:-/tmp}/ork-pre-commit-release-dist.XXXXXX")
trap 'rm -rf "$fixture" "$hook_fixture"' EXIT
mkdir -p "$hook_fixture/bin/git-hooks" "$hook_fixture/docs"
cp "$HOOK" "$hook_fixture/bin/git-hooks/pre-commit"
chmod +x "$hook_fixture/bin/git-hooks/pre-commit"
cd "$hook_fixture"
git init -q
git config user.email fixture@example.invalid
git config user.name Fixture
printf fixture > docs/example.txt
git add docs/example.txt

run_pre_commit() {
  set +e
  env -u ORK_DIST_COMMIT "$hook_fixture/bin/git-hooks/pre-commit" > "$hook_fixture/pre-commit.out" 2>&1
  PRE_COMMIT_STATUS=$?
  set -e
}

write_helper() {
  printf '%s\n' '#!/usr/bin/env bash' "$1" > "$hook_fixture/bin/git-hooks/release-dist-paths.sh"
  chmod +x "$hook_fixture/bin/git-hooks/release-dist-paths.sh"
}

rm -f "$hook_fixture/bin/git-hooks/release-dist-paths.sh"
run_pre_commit
[[ "$PRE_COMMIT_STATUS" -eq 1 ]]
grep -Fq 'release-dist-paths.sh exited 127' "$hook_fixture/pre-commit.out"
grep -Fq 'Pre-commit validation FAILED with 1 error(s)' "$hook_fixture/pre-commit.out"
echo 'PASS: missing helper rejects commit with exit status 127'

write_helper 'exit 42'
run_pre_commit
[[ "$PRE_COMMIT_STATUS" -eq 1 ]]
grep -Fq 'release-dist-paths.sh exited 42' "$hook_fixture/pre-commit.out"
grep -Fq 'Pre-commit validation FAILED with 1 error(s)' "$hook_fixture/pre-commit.out"
echo 'PASS: empty-output helper error rejects commit'

write_helper 'exit 0'
run_pre_commit
[[ "$PRE_COMMIT_STATUS" -eq 0 ]]
grep -Fq 'Pre-commit validation passed' "$hook_fixture/pre-commit.out"
echo 'PASS: empty successful helper allows commit'

write_helper "printf '%s\\n' 'src/hooks/dist/bundle.mjs'"
run_pre_commit
[[ "$PRE_COMMIT_STATUS" -eq 1 ]]
grep -Fq 'Hook bundles are release-owned' "$hook_fixture/pre-commit.out"
grep -Fq 'src/hooks/dist/bundle.mjs' "$hook_fixture/pre-commit.out"
echo 'PASS: successful helper output rejects forbidden bundles'

echo 'Passed: 11  Failed: 0'

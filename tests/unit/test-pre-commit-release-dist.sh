#!/usr/bin/env bash
# Release bundles inherited unchanged from main must not block merge commits.
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
check "$paths" 'ordinary feature bundle edits rejected'
printf '%s\n' "$release" > .git/MERGE_HEAD
check '' 'unchanged incoming main bundles allowed'
printf feature > src/hooks/dist/bundle.mjs
git add src/hooks/dist/bundle.mjs
check 'src/hooks/dist/bundle.mjs' 'feature modification during merge rejected'
git read-tree "$release"
printf '%s\n' "$base" > .git/MERGE_HEAD
check "$paths" 'index must match incoming parent'
printf '%s\n' "$release" > .git/MERGE_HEAD
git update-ref refs/remotes/origin/main "$base"
check "$paths" 'non-main merge bundles rejected'
[[ -z "$(printf 'docs/example.html\n' | bash "$GUARD")" ]]
echo 'PASS: unrelated paths ignored'
echo 'Passed: 6  Failed: 0'

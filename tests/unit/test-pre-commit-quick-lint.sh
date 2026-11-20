#!/usr/bin/env bash
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture=$(mktemp -d "${TMPDIR:-/tmp}/ork-pre-commit-lint.XXXXXX")
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/bin/git-hooks" "$fixture/tests/ci" "$fixture/src/hooks"
cp "$ROOT/bin/git-hooks/pre-commit" "$fixture/bin/git-hooks/pre-commit"
cp "$ROOT/bin/git-hooks/release-dist-paths.sh" "$fixture/bin/git-hooks/release-dist-paths.sh"
cd "$fixture"
git init -q
printf '%s\n' '#!/bin/bash' 'exit 99' > tests/run-all-tests.sh
printf '%s\n' '#!/bin/bash' 'touch lint-ran' 'exit "${LINT_STATUS:-0}"' > tests/ci/lint.sh
chmod +x tests/run-all-tests.sh tests/ci/lint.sh

bash bin/git-hooks/pre-commit > output 2>&1
[[ ! -e lint-ran ]]
echo 'PASS: empty index skips lint'

printf fixture > src/hooks/example.txt
git add src/hooks/example.txt
bash bin/git-hooks/pre-commit > output 2>&1
[[ -f lint-ran ]]
grep -Fq 'Pre-commit validation passed' output
echo 'PASS: affected paths run static lint without the full orchestrator'

if LINT_STATUS=1 bash bin/git-hooks/pre-commit > output 2>&1; then
  echo 'FAIL: static lint failure accepted'
  exit 1
fi
grep -Fq "Run './tests/ci/lint.sh' for details" output
echo 'PASS: static lint failure blocks commit with the correct retry command'

git rm -q --cached src/hooks/example.txt
rm lint-ran
printf fixture > unrelated.txt
git add unrelated.txt
bash bin/git-hooks/pre-commit > output 2>&1
[[ ! -e lint-ran ]]
echo 'PASS: unrelated paths skip lint'

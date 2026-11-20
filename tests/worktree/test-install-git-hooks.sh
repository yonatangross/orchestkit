#!/usr/bin/env bash
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture=$(mktemp -d "${TMPDIR:-/tmp}/ork-install-hooks.XXXXXX")
trap 'rm -rf "$fixture"' EXIT
export HOME="$fixture" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
unset GIT_CONFIG_COUNT GIT_CONFIG_PARAMETERS

git init -q "$fixture/repo"
mkdir -p "$fixture/repo/bin"
cp "$ROOT/bin/install-git-hooks.sh" "$fixture/repo/bin/"
cp -R "$ROOT/bin/git-hooks" "$fixture/repo/bin/"
git -C "$fixture/repo" add bin
git -C "$fixture/repo" -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -qm fixture
git -C "$fixture/repo" worktree add -q --detach "$fixture/linked"

check_install() {
  local repo="$1" label="$2" actual
  if ! bash "$repo/bin/install-git-hooks.sh" > "$fixture/output" 2>&1; then
    cat "$fixture/output"
    echo "FAIL: $label installer exited nonzero"
    exit 1
  fi
  actual=$(git -C "$repo" rev-parse --path-format=absolute --git-path hooks)
  if [[ "$actual" != "$repo/bin/git-hooks" ]]; then
    echo "FAIL: $label hooks path is not checkout-local bin/git-hooks"
    exit 1
  fi
  echo "PASS: $label"
}

check_install "$fixture/repo" 'normal checkout'
check_install "$fixture/linked" 'linked worktree'
git -C "$fixture/repo" config --local --unset core.hooksPath
export GIT_CONFIG_GLOBAL="$fixture/global-config"
mkdir -p "$fixture/global hooks"
git config --global core.hooksPath "$fixture/global hooks"
check_install "$fixture/repo" 'global absolute core.hooksPath overridden locally'
if [[ -n "$(find "$fixture/global hooks" -mindepth 1 -print -quit)" ]]; then
  echo 'FAIL: global hooks directory was modified'
  exit 1
fi
echo 'PASS: global hooks directory stays empty'

git -C "$fixture/repo" config --local core.hooksPath bin/git-hooks
check_install "$fixture/repo" 'prepare-style configuration'
check_install "$fixture/repo" 'repeated installation'
check_install "$fixture/linked" 'repeated linked installation'
for repo in "$fixture/repo" "$fixture/linked"; do
  for hook in "$repo/bin/git-hooks"/*; do
    if [[ ! -f "$hook" || -L "$hook" || "$hook" == *.backup ]]; then
      echo 'FAIL: installation changed regular hook files'
      exit 1
    fi
  done
  if [[ -n "$(git -C "$repo" status --porcelain -- bin/git-hooks)" ]]; then
    echo 'FAIL: installation changed tracked hook contents'
    exit 1
  fi
done
echo 'PASS: tracked hooks remain unchanged regular files without backups'
git -C "$fixture/repo" worktree remove "$fixture/linked"
hooks=$(git -C "$fixture/repo" rev-parse --path-format=absolute --git-path hooks)
if [[ "$hooks" != "$fixture/repo/bin/git-hooks" || ! -f "$hooks/pre-commit" || -L "$hooks/pre-commit" ]]; then
  echo 'FAIL: removing linked worktree invalidated main checkout hooks'
  exit 1
fi
echo 'PASS: main checkout hooks remain valid after removing linked worktree'

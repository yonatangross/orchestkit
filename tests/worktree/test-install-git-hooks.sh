#!/usr/bin/env bash
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture=$(mktemp -d "${TMPDIR:-/tmp}/ork-install-hooks.XXXXXX")
trap 'rm -rf "$fixture"' EXIT

git init -q "$fixture/repo"
mkdir -p "$fixture/repo/bin"
cp "$ROOT/bin/install-git-hooks.sh" "$fixture/repo/bin/"
cp -R "$ROOT/bin/git-hooks" "$fixture/repo/bin/"
git -C "$fixture/repo" add bin
git -C "$fixture/repo" -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -qm fixture
git -C "$fixture/repo" worktree add -q --detach "$fixture/linked"

check_install() {
  local repo="$1" expected="$2" label="$3" hook
  if ! bash "$repo/bin/install-git-hooks.sh" > "$fixture/output" 2>&1; then
    cat "$fixture/output"
    echo "FAIL: $label installer exited nonzero"
    exit 1
  fi
  for hook in "$repo/bin/git-hooks"/*; do
    [[ -f "$hook" ]] || continue
    if [[ ! -L "$expected/${hook##*/}" || "$(readlink "$expected/${hook##*/}")" != "$hook" ]]; then
      echo "FAIL: $label missing symlink for ${hook##*/}"
      exit 1
    fi
  done
  echo "PASS: $label"
}

check_install "$fixture/repo" "$fixture/repo/.git/hooks" 'normal checkout'
check_install "$fixture/linked" "$fixture/repo/.git/hooks" 'linked worktree'
git -C "$fixture/linked" config core.hooksPath 'custom hooks'
check_install "$fixture/linked" "$fixture/linked/custom hooks" 'relative core.hooksPath'
git -C "$fixture/repo" config core.hooksPath "$fixture/absolute hooks"
check_install "$fixture/repo" "$fixture/absolute hooks" 'absolute core.hooksPath'
git -C "$fixture/repo" config --unset core.hooksPath
rm -rf "$fixture/repo/.git/hooks"
check_install "$fixture/repo" "$fixture/repo/.git/hooks" 'missing hooks directory'

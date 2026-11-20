#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/ork-native-binding.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT

mkdir -p "$FIXTURE/tests" "$FIXTURE/bin" "$FIXTURE/src/hooks/node_modules"
cp "$REPO_ROOT/tests/run-all-tests.sh" "$FIXTURE/tests/run-all-tests.sh"
cat > "$FIXTURE/bin/npx" <<'NPX'
#!/usr/bin/env bash
touch "$(dirname "$0")/invoked"
echo 'Tests  3 passed'
exit "${FAKE_VITEST_EXIT:-0}"
NPX
chmod +x "$FIXTURE/bin/npx"

run_fixture() {
    local rc=0
    rm -f "$FIXTURE/bin/invoked"
    (
        cd "$FIXTURE"
        env -u CI -u DISPLAY -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
            -u GIT_PREFIX -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY \
            PATH="$FIXTURE/bin:$PATH" "$@" bash tests/run-all-tests.sh --unit
    ) > "$FIXTURE/output" 2>&1 || rc=$?
    sed $'s/\033\\[[0-9;]*m//g' "$FIXTURE/output" > "$FIXTURE/plain"
    return "$rc"
}

has() { grep -qF "$1" "$FIXTURE/plain"; }
invoked() { [[ -f "$FIXTURE/bin/invoked" ]]; }
not_invoked() { ! invoked; }
check() {
    if "$@"; then
        echo "PASS: $*"
    else
        cat "$FIXTURE/plain"
        echo "FAIL: $*"
        exit 1
    fi
}

install_bundler() {
    mkdir -p "$FIXTURE/src/hooks/node_modules/$1"
    printf '{"main":"index.js"}\n' > "$FIXTURE/src/hooks/node_modules/$1/package.json"
    printf '%s\n' "$2" > "$FIXTURE/src/hooks/node_modules/$1/index.js"
}

install_bundler rolldown 'module.exports = {};'
run_fixture
check invoked
check has 'TypeScript Hook Tests (vitest)          PASS'

rm -rf "$FIXTURE/src/hooks/node_modules/rolldown"
install_bundler rollup 'module.exports = {};'
run_fixture
check invoked

install_bundler rolldown 'throw new Error("native binding unavailable");'
run_fixture
check has 'SKIP: Hook bundler failed to load'
check has "($(node -p 'process.platform + "/" + process.arch'))"
check has 'native binding unavailable'
check not_invoked

rm -rf "$FIXTURE/src/hooks/node_modules/rolldown" "$FIXTURE/src/hooks/node_modules/rollup"
run_fixture
check has 'SKIP: Hook bundler failed to load'
check not_invoked

install_bundler rolldown 'module.exports = {};'
if run_fixture FAKE_VITEST_EXIT=1; then
    echo 'FAIL: vitest failure must fail the runner'
    exit 1
fi
check has 'TypeScript Hook Tests (vitest)          FAIL'

run_fixture CI=true
check has 'Vitest runs in dedicated CI job'
check not_invoked

rm -rf "$FIXTURE/src/hooks/node_modules"
run_fixture
check not_invoked
echo 'Native binding runner regression tests passed'

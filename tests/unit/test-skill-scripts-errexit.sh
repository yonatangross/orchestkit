#!/bin/bash
# Unit tests for estate sweep T2: skill scripts under `set -e`.
#
# Finding (a) page-serve: `out="$(cmd)"; rc=$?` under errexit exits on cmd
#   failure BEFORE the rc capture runs, so status.sh violated its documented
#   "exit 0 always" contract and serve.sh leaked the python http.server when
#   `portless alias` failed. Seven sites across serve.sh, status.sh, stop.sh.
# Finding (b) implement/worktree-setup.sh: cleanup used `git diff --quiet`,
#   which cannot see untracked files, then force-removed the worktree with no
#   prompt; the existence check was a substring match.
# Finding (c) dev/boot.sh: `--live` with no value died on `shift 2`, and a
#   failing `tailscale status` (or monorepo `portless list`) aborted after the
#   wrapped dev server started but before dev-stack.json was written.
#
# Stubs on PATH make every external dependency deterministic: portless modes
# (ok / alias-fail / list-fail), curl always failing transport, tailscale down,
# npx wait-on succeeding, agent-browser present.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVE_SH="${PROJECT_ROOT}/src/skills/page-serve/scripts/serve.sh"
STATUS_SH="${PROJECT_ROOT}/src/skills/page-serve/scripts/status.sh"
STOP_SH="${PROJECT_ROOT}/src/skills/page-serve/scripts/stop.sh"
WT_SH="${PROJECT_ROOT}/src/skills/implement/scripts/worktree-setup.sh"
BOOT_SH="${PROJECT_ROOT}/src/skills/dev/scripts/boot.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
FAILED_NAMES=()

log_pass() { echo -e "${GREEN}✓${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
log_fail() { echo -e "${RED}✗${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); FAILED_NAMES+=("$1"); }

TMP_BASE="$(mktemp -d "${TMPDIR:-/tmp}/ork-errexit.XXXXXX")"
STUB_DIR="${TMP_BASE}/stubs"
PIDS_FILE="${TMP_BASE}/stub-pids"
mkdir -p "${STUB_DIR}"

REAL_JQ="$(command -v jq || true)"

# Kill any stubbed long-running children (python http.server, portless wrapper
# sleepers) that a buggy script may have leaked, then remove the temp tree.
cleanup() {
  if [[ -f "${PIDS_FILE}" ]]; then
    while IFS= read -r p; do
      if [[ -n "${p}" ]] && kill -0 "${p}" 2>/dev/null; then
        kill "${p}" 2>/dev/null || true
      fi
    done < "${PIDS_FILE}"
  fi
  rm -rf "${TMP_BASE}"
}
trap cleanup EXIT

# ── Stubs ────────────────────────────────────────────────────────────────────

cat > "${STUB_DIR}/portless" <<'EOF'
#!/usr/bin/env bash
# STUB_PORTLESS_MODE: ok | alias-fail | list-fail
mode="${STUB_PORTLESS_MODE:-ok}"
case "$1" in
  service) echo "Proxy on 443: responding"; exit 0 ;;
  list)    [[ "${mode}" == "list-fail" ]] && exit 1; exit 0 ;;
  get)     echo "https://$2.localhost"; exit 0 ;;
  proxy)   exit 0 ;;
  alias)
    if [[ "${mode}" == "alias-fail" ]]; then
      echo "stub: alias backend down" >&2
      exit 1
    fi
    exit 0 ;;
  *)
    # Wrapped form (portless [flags] <slug> <mgr> run dev): stay alive like a
    # real dev server wrapper so tests can reap us by pid.
    echo $$ >> "${STUB_PIDS:-/dev/null}" 2>/dev/null || true
    exec sleep 300 ;;
esac
EOF
chmod +x "${STUB_DIR}/portless"

cat > "${STUB_DIR}/curl" <<'EOF'
#!/usr/bin/env bash
# Forced transport failure: http_code 000 on stdout, exit 7 (connect failed).
printf '000'
exit 7
EOF
chmod +x "${STUB_DIR}/curl"

cat > "${STUB_DIR}/tailscale" <<'EOF'
#!/usr/bin/env bash
# tailscaled unreachable: every subcommand fails.
exit 1
EOF
chmod +x "${STUB_DIR}/tailscale"

cat > "${STUB_DIR}/npx" <<'EOF'
#!/usr/bin/env bash
# wait-on always succeeds instantly.
exit 0
EOF
chmod +x "${STUB_DIR}/npx"

cat > "${STUB_DIR}/agent-browser" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${STUB_DIR}/agent-browser"

# ── Helpers ──────────────────────────────────────────────────────────────────

# A pid that is guaranteed dead by the time the caller uses it.
dead_pid() {
  (exit 0) &
  local p=$!
  wait "${p}" 2>/dev/null || true
  printf '%s' "${p}"
}

# Write a page-serve state file: make_state <project_dir> <name> <pid>
make_state() {
  local dir="$1" name="$2" pid="$3"
  mkdir -p "${dir}/.claude/state/page-serve"
  python3 - "$name" "$pid" \
    > "${dir}/.claude/state/page-serve/${name}.json" <<'PY'
import json, sys
name, pid = sys.argv[1], int(sys.argv[2])
print(json.dumps({"name": name, "root": "/tmp", "file": "x.html", "port": 1,
                  "pid": pid, "url": f"https://{name}.localhost/x.html",
                  "started_at": "2026-01-01T00:00:00Z"}))
PY
}

# Print the pid(s) of any http.server process rooted at the given directory.
# Matches on the process cwd, not the command line, so pre-existing servers
# from other sessions cannot produce a false positive.
leaked_server_pids() {
  local root_phys p d
  root_phys="$(cd "$1" && pwd -P)"
  for p in $(pgrep -f "http\.server" 2>/dev/null || true); do
    if [[ -d "/proc/${p}" ]]; then
      d=$(readlink "/proc/${p}/cwd" 2>/dev/null || true)
    else
      d=$(lsof -a -p "${p}" -d cwd -Fn 2>/dev/null | awk '/^n/{print substr($0,2); exit}')
    fi
    [[ "${d}" == "${root_phys}" ]] && printf '%s\n' "${p}"
  done
  return 0
}

make_repo() {
  local dir="$1"
  mkdir -p "${dir}"
  git -C "${dir}" init -q
  git -C "${dir}" -c user.email=t@t.t -c user.name=t commit -qm init --allow-empty
}

kill_stub_pids() {
  if [[ -f "${PIDS_FILE}" ]]; then
    while IFS= read -r p; do
      if [[ -n "${p}" ]] && kill -0 "${p}" 2>/dev/null; then
        kill "${p}" 2>/dev/null || true
      fi
    done < "${PIDS_FILE}"
    : > "${PIDS_FILE}"
  fi
}

require_tools() {
  local missing=()
  command -v python3 >/dev/null 2>&1 || missing+=("python3")
  command -v git     >/dev/null 2>&1 || missing+=("git")
  command -v pgrep   >/dev/null 2>&1 || missing+=("pgrep")
  [[ -n "${REAL_JQ}" ]] || missing+=("jq")
  if [[ "${#missing[@]}" -gt 0 ]]; then
    echo "FATAL: required tools missing: ${missing[*]}" >&2
    exit 1
  fi
}

# ── Finding (a): page-serve rc captures under set -e ─────────────────────────

# status.sh documents "Exit codes: 0 always". With a state file whose pid is
# dead and curl failing, the unguarded `code="$(curl ...)"` used to trip
# errexit before the row printed.
test_status_dead_pid_exits_zero() {
  local proj="${TMP_BASE}/a1-proj"
  mkdir -p "${proj}"
  make_state "${proj}" alpha "$(dead_pid)"
  make_state "${proj}" beta  "$(dead_pid)"
  local out rc=0 rows
  out=$(PATH="${STUB_DIR}:$PATH" CLAUDE_PROJECT_DIR="${proj}" \
        bash "${STATUS_SH}" 2>&1) || rc=$?
  rows=$(printf '%s\n' "${out}" | grep -c 'http=' || true)
  if [[ "${rc}" == "0" && "${rows}" == "2" ]]; then
    log_pass "status.sh: dead pids exit 0 with one row per page"
  else
    log_fail "status.sh dead-pid run (rc=${rc}, rows=${rows}): ${out:0:200}"
  fi
}

# serve.sh: when `portless alias` fails, the script must kill the http.server
# it just started. Under the old `out="$(cmd)"; rc=$?` form errexit fired on
# the assignment, skipping the kill and leaking the child.
test_serve_alias_failure_no_leak() {
  local proj="${TMP_BASE}/a2-proj"
  mkdir -p "${proj}"
  echo '<h1>hi</h1>' > "${proj}/page.html"
  local out rc=0
  out=$(STUB_PORTLESS_MODE=alias-fail STUB_PIDS="${PIDS_FILE}" \
        PATH="${STUB_DIR}:$PATH" CLAUDE_PROJECT_DIR="${proj}" \
        bash "${SERVE_SH}" "${proj}/page.html" --name t2leak --no-screenshot 2>&1) || rc=$?
  local leaked p
  leaked=$(leaked_server_pids "${proj}")
  for p in ${leaked}; do kill "${p}" 2>/dev/null || true; done
  if [[ "${rc}" == "2" && -z "${leaked}" && "${out}" == *"portless alias"* ]]; then
    log_pass "serve.sh: failing portless alias exits 2, kills the http.server"
  else
    log_fail "serve.sh alias-fail (rc=${rc}, leaked=${leaked:-none}): ${out:0:200}"
  fi
}

# stop.sh: a failing `portless alias --remove` must not abort the teardown;
# the function reports the rc and continues to the pid/state cleanup.
test_stop_alias_failure_continues() {
  local proj="${TMP_BASE}/a3-proj"
  make_state "${proj}" ghost "$(dead_pid)"
  local out rc=0
  out=$(STUB_PORTLESS_MODE=alias-fail PATH="${STUB_DIR}:$PATH" \
        CLAUDE_PROJECT_DIR="${proj}" bash "${STOP_SH}" ghost 2>&1) || rc=$?
  if [[ "${rc}" == "0" && "${out}" == *"stopped=ghost"* ]]; then
    log_pass "stop.sh: failing alias remove still completes teardown (rc=0)"
  else
    log_fail "stop.sh alias-fail (rc=${rc}): ${out:0:200}"
  fi
}

# ── Finding (b): worktree-setup.sh cleanup ───────────────────────────────────

# Untracked files are invisible to `git diff --quiet`; the old guard skipped
# the prompt entirely and `--force` deleted them. With the porcelain guard an
# untracked file must trigger the prompt, and "n" must abort.
test_cleanup_untracked_blocks_without_confirm() {
  local repo="${TMP_BASE}/b1repo"
  make_repo "${repo}"
  git -C "${repo}" worktree add -q -b feature/feat "../b1repo-feat" >/dev/null 2>&1
  local wt="${TMP_BASE}/b1repo-feat"
  echo scratch > "${wt}/untracked.txt"
  local out rc=0
  out=$(cd "${repo}" && printf 'n\n' | bash "${WT_SH}" cleanup feat 2>&1) || rc=$?
  if [[ "${rc}" != "0" && -d "${wt}" && -f "${wt}/untracked.txt" ]]; then
    log_pass "worktree-setup: untracked-only changes block cleanup on 'n'"
  else
    log_fail "worktree-setup untracked (rc=${rc}, dir=$([[ -d ${wt} ]] && echo present || echo gone)): ${out:0:200}"
  fi
  [[ -d "${wt}" ]] && git -C "${repo}" worktree remove "${wt}" --force >/dev/null 2>&1 || true
}

# A clean worktree must be removed without --force and without the discard
# prompt (only the branch prompt, answered "n").
test_cleanup_clean_removes() {
  local repo="${TMP_BASE}/b2repo"
  make_repo "${repo}"
  git -C "${repo}" worktree add -q -b feature/feat "../b2repo-feat" >/dev/null 2>&1
  local wt="${TMP_BASE}/b2repo-feat"
  local out rc=0
  out=$(cd "${repo}" && printf 'n\n' | bash "${WT_SH}" cleanup feat 2>&1) || rc=$?
  if [[ "${rc}" == "0" && ! -d "${wt}" ]]; then
    log_pass "worktree-setup: clean worktree removed without force"
  else
    log_fail "worktree-setup clean cleanup (rc=${rc}, dir=$([[ -d ${wt} ]] && echo present || echo gone)): ${out:0:200}"
  fi
}

# Confirmed discard ("y" then "n" for the branch) removes even a dirty tree.
test_cleanup_dirty_confirmed_removes() {
  local repo="${TMP_BASE}/b3repo"
  make_repo "${repo}"
  git -C "${repo}" worktree add -q -b feature/feat "../b3repo-feat" >/dev/null 2>&1
  local wt="${TMP_BASE}/b3repo-feat"
  echo scratch > "${wt}/untracked.txt"
  local out rc=0
  out=$(cd "${repo}" && printf 'y\nn\n' | bash "${WT_SH}" cleanup feat 2>&1) || rc=$?
  if [[ "${rc}" == "0" && ! -d "${wt}" ]]; then
    log_pass "worktree-setup: confirmed discard removes dirty worktree"
  else
    log_fail "worktree-setup confirmed cleanup (rc=${rc}, dir=$([[ -d ${wt} ]] && echo present || echo gone)): ${out:0:200}"
  fi
  [[ -d "${wt}" ]] && git -C "${repo}" worktree remove "${wt}" --force >/dev/null 2>&1 || true
}

# ── Finding (c): dev/boot.sh ─────────────────────────────────────────────────

# `--live` with no value must fall back to the documented 4h default. The old
# `shift 2` died with "shift count out of range" when --live was the last arg.
# The tailscale stub fails here too, so this run also proves a dead tailscaled
# no longer aborts the boot after the wrapper started.
test_boot_live_no_value_defaults() {
  local proj="${TMP_BASE}/c1-proj"
  mkdir -p "${proj}"
  echo '{"name":"x"}' > "${proj}/package.json"
  : > "${PIDS_FILE}"
  local out rc=0
  out=$(STUB_PORTLESS_MODE=list-fail STUB_PIDS="${PIDS_FILE}" \
        PATH="${STUB_DIR}:$PATH" CLAUDE_PROJECT_DIR="${proj}" \
        bash "${BOOT_SH}" --live 2>&1) || rc=$?
  local sf="${proj}/.claude/state/dev-stack.json" mode="" exp="" ts=""
  if [[ -f "${sf}" ]]; then
    mode=$(jq -r '.share.mode // ""' "${sf}")
    exp=$(jq -r '.share.expiresAt // ""' "${sf}")
    ts=$(jq -r '.share.tailscaleUrl // ""' "${sf}")
  fi
  kill_stub_pids
  if [[ "${rc}" == "0" && "${mode}" == "funnel" && -n "${exp}" && -z "${ts}" ]]; then
    log_pass "boot.sh: '--live' alone boots, defaults 4h, survives tailscale down"
  else
    log_fail "boot.sh --live (rc=${rc}, state=$([[ -f ${sf} ]] && echo written || echo missing), mode=${mode}, exp=${exp:-none}): ${out:0:300}"
  fi
}

# `--live 2` must still honor the explicit value (expiry about 2h out).
test_boot_live_explicit_value() {
  local proj="${TMP_BASE}/c2-proj"
  mkdir -p "${proj}"
  echo '{"name":"x"}' > "${proj}/package.json"
  : > "${PIDS_FILE}"
  local out rc=0
  out=$(STUB_PORTLESS_MODE=list-fail STUB_PIDS="${PIDS_FILE}" \
        PATH="${STUB_DIR}:$PATH" CLAUDE_PROJECT_DIR="${proj}" \
        bash "${BOOT_SH}" --live 2 2>&1) || rc=$?
  local sf="${proj}/.claude/state/dev-stack.json" exp="" diff=999999
  if [[ -f "${sf}" ]]; then
    exp=$(jq -r '.share.expiresAt // ""' "${sf}")
  fi
  kill_stub_pids
  if [[ -n "${exp}" ]]; then
    diff=$(python3 - "$exp" <<'PY'
import sys, datetime
exp = datetime.datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00")).timestamp()
now = datetime.datetime.now(datetime.timezone.utc).timestamp()
print(int(abs(exp - now - 7200)))
PY
)
  fi
  if [[ "${rc}" == "0" && -f "${sf}" && "${diff}" -lt 300 ]]; then
    log_pass "boot.sh: '--live 2' boots with a 2h expiry"
  else
    log_fail "boot.sh --live 2 (rc=${rc}, exp=${exp:-none}, skew=${diff}s): ${out:0:300}"
  fi
}

# Monorepo mode: `portless list` failing at the subdomain-map capture must not
# abort the boot after the wrapper started (state file must still be written).
test_boot_monorepo_list_failure() {
  local proj="${TMP_BASE}/c3-proj"
  mkdir -p "${proj}"
  echo '{"name":"x"}' > "${proj}/package.json"
  echo '{}' > "${proj}/turbo.json"
  : > "${PIDS_FILE}"
  local out rc=0
  out=$(STUB_PORTLESS_MODE=list-fail STUB_PIDS="${PIDS_FILE}" \
        PATH="${STUB_DIR}:$PATH" CLAUDE_PROJECT_DIR="${proj}" \
        bash "${BOOT_SH}" 2>&1) || rc=$?
  local sf="${proj}/.claude/state/dev-stack.json" mode=""
  [[ -f "${sf}" ]] && mode=$(jq -r '.mode // ""' "${sf}")
  kill_stub_pids
  if [[ "${rc}" == "0" && "${mode}" == "monorepo" ]]; then
    log_pass "boot.sh: monorepo boot survives a failing portless list"
  else
    log_fail "boot.sh monorepo list-fail (rc=${rc}, mode=${mode:-none}): ${out:0:300}"
  fi
}

# ── Run all tests ────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Estate sweep T2: skill scripts under set -e"
echo "═══════════════════════════════════════════════════════════════"

require_tools

test_status_dead_pid_exits_zero
test_serve_alias_failure_no_leak
test_stop_alias_failure_continues

test_cleanup_untracked_blocks_without_confirm
test_cleanup_clean_removes
test_cleanup_dirty_confirmed_removes

test_boot_live_no_value_defaults
test_boot_live_explicit_value
test_boot_monorepo_list_failure

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Summary: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed"
echo "═══════════════════════════════════════════════════════════════"
if [[ "${TESTS_FAILED}" -gt 0 ]]; then
  echo "Failed tests:"
  for n in "${FAILED_NAMES[@]}"; do echo "  - ${n}"; done
  exit 1
fi
exit 0

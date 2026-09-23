#!/bin/bash
# Machine-wide test-suite governor (#4238). Ported from platform
# scripts/lib/test-lock.sh; the mechanism is identical and the env vars are
# renamed ORK_TEST_SLOT_*. The default slot directory is the same one
# platform uses, deliberately: the governor exists because several lanes on
# ONE host were each running a full suite, so the slots must count across
# repos, not per repo.
#
# Any script that launches a full or partial suite sources this and calls
# acquire_test_slot before running tests. Concurrent callers beyond the slot
# count queue; a dead holder's slot is reclaimed automatically.
#
#   . "$PROJECT_ROOT/scripts/lib/test-slot.sh"
#   acquire_test_slot "pre-push orchestkit"
#
# Tunables (env):
#   ORK_TEST_SLOT_MAX        slot count (default 2)
#   ORK_TEST_SLOT_TIMEOUT    max seconds to queue before giving up (900)
#   ORK_TEST_SLOT_DIR        slot directory (~/.claude/coord/test-slots)
#   ORK_TEST_SLOT_NOLOCK=1   bypass entirely (logged); CI is always bypassed,
#                            runners have their own governance
#   ORK_TEST_SLOT_ORPHAN_GRACE  seconds a pid-less slot may live (60)
#
# Locking is mkdir-based (atomic on every POSIX fs; macOS ships no flock).
#
# Ambiguity resolves toward REFUSE. A slot dir with no readable pid file is a
# slot mid-acquisition (the window between mkdir and the pid write), so it is
# treated as LIVE, not stale. A pid-less slot older than the orphan grace is
# reclaimed, which bounds the leak when a holder dies between the two steps.

_test_slot_dir_writable() {
  mkdir -p "$1" 2>/dev/null && ( : > "$1/.write-probe-$$" ) 2>/dev/null && rm -f "$1/.write-probe-$$"
}
if [ -n "${ORK_TEST_SLOT_DIR:-}" ]; then
  TEST_SLOT_DIR="$ORK_TEST_SLOT_DIR"
else
  TEST_SLOT_DIR="$HOME/.claude/coord/test-slots"
  if ! _test_slot_dir_writable "$TEST_SLOT_DIR"; then
    _test_slot_fallback="${TMPDIR:-/tmp}/ork-test-slots-$(id -u)"
    echo "[test-slot] $TEST_SLOT_DIR is not writable (sandbox?), using $_test_slot_fallback; set ORK_TEST_SLOT_DIR to override" >&2
    TEST_SLOT_DIR="$_test_slot_fallback"
  fi
fi
TEST_SLOT_MAX="${ORK_TEST_SLOT_MAX:-2}"
TEST_SLOT_ORPHAN_GRACE="${ORK_TEST_SLOT_ORPHAN_GRACE:-60}"
_test_slot_path=""

release_test_slot() {
  if [ -n "${_test_slot_path:-}" ] && [ -d "${_test_slot_path}" ]; then
    # Only tear down a slot we still own. If a reclaimer already took it and
    # a third process re-acquired it, blind rm -rf would evict the new holder.
    local held_pid
    held_pid=$(cat "${_test_slot_path}/pid" 2>/dev/null || echo "")
    if [ "$held_pid" = "${BASHPID:-$$}" ]; then
      rm -rf "${_test_slot_path}" 2>/dev/null || true
    fi
    _test_slot_path=""
  fi
}

_test_slot_age() {
  # Seconds since the slot dir was created. Dispatch on the kernel: GNU
  # stat -f means filesystem status, so '%m' becomes a file operand that
  # prints a filesystem report instead of failing, and the multi-line
  # garbage used to poison the age math so orphans were never reclaimed.
  local slot="$1" mtime now
  if [ "$(uname -s 2>/dev/null)" = "Darwin" ]; then
    mtime=$(stat -f %m "$slot" 2>/dev/null || echo "")
  else
    mtime=$(stat -c %Y "$slot" 2>/dev/null || echo "")
  fi
  # An unmeasurable age resolves toward REFUSE: the slot counts as young,
  # never as reclaimable.
  case "$mtime" in ''|*[!0-9]*) echo 0; return ;; esac
  now=$(date +%s)
  echo $(( now - mtime ))
}

_test_slot_stale() {
  # Exit 0 (stale, reclaimable) ONLY when we can prove the holder is gone:
  #   pid file readable AND kill -0 fails  => holder died, reclaim
  #   pid file absent AND slot older than the orphan grace => never claimed
  # Everything else, including an unreadable pid file on a young slot, is
  # ambiguous and therefore LIVE. Refusing costs a 3s requeue; granting costs
  # mutual exclusion.
  local slot="$1" owner_pid
  owner_pid=$(cat "$slot/pid" 2>/dev/null || echo "")
  if [ -z "$owner_pid" ]; then
    if [ "$(_test_slot_age "$slot")" -ge "$TEST_SLOT_ORPHAN_GRACE" ]; then
      echo "[test-slot] slot $(basename "$slot") has no pid after ${TEST_SLOT_ORPHAN_GRACE}s, treating as orphan" >&2
      return 0
    fi
    return 1
  fi
  ! kill -0 "$owner_pid" 2>/dev/null
}

acquire_test_slot() {
  local label="${1:-test-suite}"
  if [ -n "${CI:-}" ]; then
    return 0
  fi
  if [ "${ORK_TEST_SLOT_NOLOCK:-}" = "1" ]; then
    echo "[test-slot] ORK_TEST_SLOT_NOLOCK=1, governor bypassed for '$label'" >&2
    return 0
  fi

  mkdir -p "$TEST_SLOT_DIR"
  local timeout="${ORK_TEST_SLOT_TIMEOUT:-900}"
  local deadline=$(( $(date +%s) + timeout ))
  local announced=0 i slot

  while :; do
    for i in $(seq 1 "$TEST_SLOT_MAX"); do
      slot="$TEST_SLOT_DIR/slot-$i"
      if [ -d "$slot" ] && _test_slot_stale "$slot"; then
        # Reclaim atomically: mv the stale slot to a tombstone only we can
        # know, then delete it. rm -rf by pathname would race a second
        # reclaimer that already re-acquired the same slot path.
        local tomb="$TEST_SLOT_DIR/.reclaim-$i-$$-$RANDOM"
        if mv "$slot" "$tomb" 2>/dev/null; then
          echo "[test-slot] reclaiming stale slot-$i (holder gone)" >&2
          rm -rf "$tomb" 2>/dev/null || true
        fi
      fi
      # mkdir failing is NOT the same as slot taken. EEXIST is contention and
      # we keep waiting; anything else is a config fault no wait can fix.
      local mkdir_err mkdir_rc
      # Separate assignment: `local x=$(...)` would clobber $? with local's
      # own status and always read success.
      mkdir_err=$(mkdir "$slot" 2>&1)
      mkdir_rc=$?
      if [ $mkdir_rc -eq 0 ]; then
        # BASHPID = the actual (sub)shell holding the slot; $$ would report
        # the parent script inside `( ... ) &` subshells and defeat stale
        # detection. On bash 3.2 (this hook's interpreter) BASHPID is unset
        # and $$ is correct: the acquirer there is the top-level process.
        echo "${BASHPID:-$$}" > "$slot/pid"
        echo "$label" > "$slot/label"
        _test_slot_path="$slot"
        # EXIT releases. INT/TERM release and then re-raise so the hook
        # still dies on the signal; a handler that only released would let
        # the remaining stages run slotless past TEST_SLOT_MAX.
        trap release_test_slot EXIT
        trap 'release_test_slot; trap - INT; kill -INT "${BASHPID:-$$}"' INT
        trap 'release_test_slot; trap - TERM; kill -TERM "${BASHPID:-$$}"' TERM
        return 0
      elif [ -d "$slot" ]; then
        # EEXIST: genuinely held by another suite. Keep queueing.
        continue
      else
        # mkdir failed and the slot still does not exist: permissions, a
        # read-only fs, ENOSPC. Waiting cannot fix any of them.
        echo "[test-slot] cannot create slot $slot: ${mkdir_err}" >&2
        echo "[test-slot] This is a config fault, not contention. The slot dir must be writable." >&2
        echo "[test-slot] Set ORK_TEST_SLOT_DIR to a writable path, or ORK_TEST_SLOT_NOLOCK=1 to bypass." >&2
        return 2
      fi
    done

    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "[test-slot] TIMEOUT after ${timeout}s waiting for a test slot ($TEST_SLOT_MAX max concurrent suites)." >&2
      for i in $(seq 1 "$TEST_SLOT_MAX"); do
        slot="$TEST_SLOT_DIR/slot-$i"
        if [ ! -d "$slot" ]; then
          echo "[test-slot]   slot-$i: (no slot dir, nothing is holding it)" >&2
          continue
        fi
        echo "[test-slot]   slot-$i: pid=$(cat "$slot/pid" 2>/dev/null || echo '?') label=$(cat "$slot/label" 2>/dev/null || echo '?')" >&2
      done
      echo "[test-slot] Retry later, or ORK_TEST_SLOT_NOLOCK=1 to bypass deliberately." >&2
      return 1
    fi

    if [ "$announced" -eq 0 ]; then
      echo "[test-slot] all $TEST_SLOT_MAX test slots busy, queueing '$label' (timeout ${timeout}s)" >&2
      announced=1
    fi
    sleep 3
  done
}

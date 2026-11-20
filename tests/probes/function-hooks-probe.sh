#!/usr/bin/env bash
# function-hooks-probe.sh: repeatable probes for the R1 and R3 function-hook
# questions in the 2026-09-18 cc-mods adoption brief, section 7.
#
#   R1: does a USER-tier hooks module load and see its events on 2.1.277 with
#       CLAUDE_CODE_ENABLE_FUNCTION_HOOKS unset, and with it set to 1?
#   R3: does a tool.list answer change what a SUBAGENT is offered, or only the
#       main loop?
#
# Prints exactly four result lines on stdout:
#   VERIFIED|REFUTED|INCONCLUSIVE <question-id> <one-line evidence>
# question-ids: R1-unset, R1-set, R3-main, R3-subagent. Diagnostics go to
# stderr. INCONCLUSIVE is the answer for an empty or errored claude call,
# never REFUTED. The script exits 0 once all four lines printed.
#
# Notes on the mechanics (verified against the 2.1.277 binary):
#   * The gate reads CLAUDE_CODE_ENABLE_FUNCTION_HOOKS, else the GrowthBook
#     flag tengu_plugin_hooks_modules, else false. An EMPTY assignment is
#     still an override (the check is presence, not value), so the unset arm
#     uses `env -u` to let the real source decide; the debug log then names
#     it: "from GrowthBook (...)", "from the default (...)", "from a local
#     override", or "overridden by the CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
#     environment variable".
#   * Module load and per-event dispatch are logged by --debug-file:
#       hooks module <label> loaded (<kind>, environment <id>, tier <tier>); events: <list>
#       hooks module <label> <event> settled in <ms> (<link>, next() included)
#     and when the gate is off:
#       installed plugins' hooks modules not loaded: rollout flag
#       (tengu_plugin_hooks_modules) is off, <source>; built-in plugins load
#       regardless
#   * Every claude call uses --model haiku --no-session-persistence to stay
#     cheap on the shared account. No settings file is touched; the gate is
#     driven by env only. The temp dir is removed on exit.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
LESSON_MOD="$REPO/mods/lesson-cards"
LIST_MOD="$HERE/tool-list-mod"
REMOVED_TOOL="Read"   # keep in sync with tool-list-mod/hooks/register.ts
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/fn-hook-probe.XXXXXX")"
cleanup() {
  rm -rf "$WORK"
  # Stray markers from the mod's fallback paths, if env.get was unavailable.
  rm -f "$REPO"/tool-list-mark.* "${TMPDIR:-/tmp}"/tool-list-mark.* /tmp/tool-list-mark.* 2>/dev/null || true
}
trap cleanup EXIT

printed=0
emit() { printf '%s %s %s\n' "$1" "$2" "$3"; printed=$((printed + 1)); }
say() { printf '%s\n' "$*" >&2; }

TIMEOUT_BIN=""
for cand in timeout gtimeout; do
  if command -v "$cand" >/dev/null 2>&1; then TIMEOUT_BIN="$cand"; break; fi
done

# probe_run <name> <plugin-dir> <prompt> [args for `env`...]
# Runs one claude -p call from the repo root with a debug file. Writes
# <name>/{stdout.txt,stderr.txt,exit.txt,debug.log} under the temp dir.
probe_run() {
  local name="$1" pdir="$2" prompt="$3"; shift 3
  local dir="$WORK/$name"
  mkdir -p "$dir"
  local rc
  if [ -n "$TIMEOUT_BIN" ]; then
    ( cd "$REPO" && env "$@" "$TIMEOUT_BIN" 300 "$CLAUDE_BIN" \
        --plugin-dir "$pdir" -p "$prompt" \
        --model haiku --no-session-persistence \
        --debug-file "$dir/debug.log" \
        >"$dir/stdout.txt" 2>"$dir/stderr.txt" )
    rc=$?
  else
    ( cd "$REPO" && env "$@" "$CLAUDE_BIN" \
        --plugin-dir "$pdir" -p "$prompt" \
        --model haiku --no-session-persistence \
        --debug-file "$dir/debug.log" \
        >"$dir/stdout.txt" 2>"$dir/stderr.txt" )
    rc=$?
  fi
  echo "$rc" >"$dir/exit.txt"
  say "[$name] exit=$rc"
}

stderr_tail() {
  tail -n 3 "$1/stderr.txt" 2>/dev/null | tr '\n' ' ' | sed "s|$HOME|~|g" | cut -c1-140
}

gate_source() {
  grep -ao -E 'from GrowthBook \([^)]*\)|from the default \([^)]*\)|from a local override|overridden by the CLAUDE_CODE_ENABLE_FUNCTION_HOOKS environment variable' "$1" 2>/dev/null | head -1
}

# ---- R1 ---------------------------------------------------------------------

r1_verdict() {
  local dir="$1" qid="$2"
  local dbg="$dir/debug.log" rc
  rc="$(cat "$dir/exit.txt" 2>/dev/null || echo '?')"

  if [ -s "$dbg" ] && grep -aq 'hooks module lesson-cards@inline loaded' "$dbg"; then
    local ev settles src
    ev="$(grep -ao 'tier [a-z]*; events: [a-zA-Z.,{}*]*' "$dbg" | head -1)"
    settles="$(grep -ac 'lesson-cards@inline [a-zA-Z.]* settled' "$dbg" 2>/dev/null || true)"
    src="$(gate_source "$dbg")"
    emit VERIFIED "$qid" "lesson-cards loaded (${ev:-tier user}); ${settles:-0} settle lines logged${src:+; gate source: $src}"
    return
  fi

  if [ -s "$dbg" ] && grep -aq 'rollout flag (tengu_plugin_hooks_modules) is off' "$dbg"; then
    local src
    src="$(gate_source "$dbg")"
    emit REFUTED "$qid" "user-tier hooks modules not loaded; rollout flag off ${src:-(source line absent)}"
    return
  fi

  if [ -s "$dbg" ] && grep -aq 'lesson-cards.*not loaded\|lesson-cards.*failed to load' "$dbg"; then
    local why
    why="$(grep -ao 'lesson-cards@inline [a-z ]*loaded:[^;]*\|lesson-cards@inline failed to load:[^;]*' "$dbg" | head -1 | cut -c1-140)"
    emit INCONCLUSIVE "$qid" "module neither loaded nor gate-blocked: ${why:-reason unreadable}; exit $rc"
    return
  fi

  emit INCONCLUSIVE "$qid" "no module-load evidence in debug log; exit $rc; stderr: $(stderr_tail "$dir")"
}

# ---- R3 ---------------------------------------------------------------------

# Prints "<files> <seen-with-Read> <kept-with-Read>" for the marker dir.
mark_stats() {
  python3 - "$1" <<'PY'
import glob, json, os, sys
d = sys.argv[1]
files = sorted(glob.glob(os.path.join(d, 'mark.*')))
seen = kept = 0
for f in files:
    try:
        rec = json.loads(open(f).read().strip().splitlines()[0])
    except Exception:
        continue
    if 'Read' in (rec.get('seen') or []):
        seen += 1
    if 'Read' in (rec.get('kept') or []):
        kept += 1
print(f"{len(files)} {seen} {kept}")
PY
}

r3_verdict() {
  local dir="$1" qid="$2" mode="$3"
  local dbg="$dir/debug.log" rc
  rc="$(cat "$dir/exit.txt" 2>/dev/null || echo '?')"
  local loaded settles stats marks seen kept
  loaded="$(grep -ac 'hooks module tool-list-mod@inline loaded' "$dbg" 2>/dev/null || true)"
  settles="$(grep -ac 'tool-list-mod@inline tool\.list settled' "$dbg" 2>/dev/null || true)"
  stats="$(mark_stats "$dir" 2>/dev/null || echo '0 0 0')"
  marks="$(echo "$stats" | awk '{print $1}')"
  seen="$(echo "$stats" | awk '{print $2}')"
  kept="$(echo "$stats" | awk '{print $3}')"

  if [ "$rc" != "0" ]; then
    emit INCONCLUSIVE "$qid" "claude exited $rc; stderr: $(stderr_tail "$dir")"
    return
  fi

  if [ "$mode" = "main" ]; then
    local said
    said="$(grep -ao -m1 -E '^(YES|NO)\b' "$dir/stdout.txt" 2>/dev/null | head -1)"
    if [ "${settles:-0}" -gt 0 ] || [ "${marks:-0}" -gt 0 ]; then
      if [ "${seen:-0}" -gt 0 ] && [ "${kept:-0}" -eq 0 ]; then
        emit VERIFIED "$qid" "tool.list answered ${settles:-0}x (${marks:-0} markers); $REMOVED_TOOL removed from every offered list; model reported ${said:-none}"
      elif [ "${kept:-0}" -gt 0 ]; then
        emit REFUTED "$qid" "$REMOVED_TOOL still present in kept list after hook answer; model reported ${said:-none}"
      elif [ "${settles:-0}" -gt 0 ] && [ "${marks:-0}" -eq 0 ]; then
        emit INCONCLUSIVE "$qid" "tool.list dispatched ${settles}x but no marker written; model reported ${said:-none}"
      else
        emit INCONCLUSIVE "$qid" "$REMOVED_TOOL absent from the seen list; removal untestable; model reported ${said:-none}"
      fi
    else
      if [ "$said" = "YES" ]; then
        emit REFUTED "$qid" "tool.list hook loaded tier user but never dispatched; $REMOVED_TOOL still offered (model YES)"
      else
        emit INCONCLUSIVE "$qid" "tool.list never dispatched and model reported ${said:-none}; removal untestable"
      fi
    fi
    return
  fi

  # subagent arm
  local token spawned
  token="$(grep -ao -m1 -E 'SUBAGENT:(YES|NO)' "$dir/stdout.txt" 2>/dev/null | head -1)"
  spawned="$(grep -ac 'agent.spawn settled\|classic.SubagentStart settled' "$dbg" 2>/dev/null || true)"
  if [ -z "$token" ]; then
    emit INCONCLUSIVE "$qid" "no SUBAGENT token in output (agent.spawn settles: ${spawned:-0}); exit $rc"
    return
  fi
  if [ "$token" = "SUBAGENT:NO" ]; then
    if [ "${settles:-0}" -gt 1 ] || [ "${marks:-0}" -gt 1 ]; then
      emit VERIFIED "$qid" "subagent offered set built without $REMOVED_TOOL; ${settles:-0} tool.list dispatches, ${marks:-0} markers; ${token}"
    elif [ "${settles:-0}" -eq 1 ]; then
      emit VERIFIED "$qid" "subagent list inherits the filtered main list (1 tool.list dispatch); ${token}"
    else
      emit INCONCLUSIVE "$qid" "subagent reports $REMOVED_TOOL absent but tool.list never dispatched; cannot attribute"
    fi
  else
    if [ "${settles:-0}" -gt 0 ]; then
      emit REFUTED "$qid" "subagent still offered $REMOVED_TOOL despite ${settles:-0} tool.list answers; ${token}"
    else
      emit REFUTED "$qid" "subagent still offered $REMOVED_TOOL and tool.list never dispatched; ${token}"
    fi
  fi
}

# ---- run ---------------------------------------------------------------------

say "probe workspace: $WORK"
say "R1-unset: lesson-cards with the flag truly unset (env -u)"
probe_run r1-unset "$LESSON_MOD" "run: echo hi" -u CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
r1_verdict "$WORK/r1-unset" R1-unset

say "R1-set: lesson-cards with the flag forced on"
probe_run r1-set "$LESSON_MOD" "run: echo hi" CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
r1_verdict "$WORK/r1-set" R1-set

say "R3-main: tool-list-mod, main loop reports its tools"
probe_run r3-main "$LIST_MOD" \
  "Answer with exactly one word: YES if your available tool list includes a tool named 'Read', NO if it does not. Do not call any tools." \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 "TOOL_LIST_PROBE_MARK=$WORK/r3-main/mark"
r3_verdict "$WORK/r3-main" R3-main main

say "R3-subagent: tool-list-mod, Explore subagent reports its tools"
probe_run r3-subagent "$LIST_MOD" \
  "Use the Task tool to spawn one Explore subagent. Give it exactly this instruction: 'Does your available tool list include a tool named Read? Reply with only YES or NO.' When it returns, reply with exactly one token: SUBAGENT:YES or SUBAGENT:NO, matching its answer. Do not call any other tools yourself." \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 "TOOL_LIST_PROBE_MARK=$WORK/r3-subagent/mark"
r3_verdict "$WORK/r3-subagent" R3-subagent subagent

if [ "$printed" -eq 4 ]; then
  exit 0
fi
say "only $printed result lines produced"
exit 1

#!/usr/bin/env bash
set -euo pipefail

# Status Protocol Parser for /ork:expect (#1189)
# Usage: ... | bash report.sh [--json] [--save]
# Protocol: STEP_START|id|title, STEP_DONE|id|summary, ASSERTION_FAILED|id|reason, RUN_COMPLETED|result|summary
#           ROUTE|url           — current route under test (echoed verbatim into output)
#           ARIA|<json|text>    — capped ARIA snapshot (echoed verbatim, max 8KB)
#           JEV_SHADOW|id|<json> : Jev pick beside the model pick (shadow or act
#                                  mode; passed through verbatim + folded into
#                                  the JSON report). When any JEV_SHADOW record
#                                  exists the script also prints one summary
#                                  line: JEV_RUN|steps=N|picks=N|fallbacks=N|agree_rate=R
# ROUTE/ARIA are passed through unchanged so PostToolUse hooks
# (posttool/expect/snapshot-recorder, M125 #6) can match on them in tool_output.

# ── Parse flags ────────────────────────────────────────────
JSON_MODE=false; SAVE_MODE=false
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;; --save) SAVE_MODE=true ;;
    *) echo "Unknown flag: ${arg}" >&2; exit 1 ;;
  esac
done

IS_CI=false
[[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]] && IS_CI=true

# Colors (disabled in CI/JSON modes)
if [[ "${JSON_MODE}" == "false" && "${IS_CI}" == "false" && -t 1 ]]; then
  G='\033[0;32m' R='\033[0;31m' C='\033[0;36m' D='\033[2m' N='\033[0m'
else
  G='' R='' C='' D='' N=''
fi

# ── State ──────────────────────────────────────────────────
declare -A TITLES STATUS DETAIL JEV
ORDER=(); PASSED=0; FAILED=0; RUN_RESULT=""; RUN_SUMMARY=""

# ── Read protocol from stdin ───────────────────────────────
while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  IFS='|' read -r cmd f1 f2 <<< "${line}"
  case "${cmd}" in
    STEP_START)
      TITLES["${f1}"]="${f2}"; ORDER+=("${f1}")
      [[ "${IS_CI}" == "false" && "${JSON_MODE}" == "false" ]] && printf "${C}  ▶ [%s] %s${N}\n" "${f1}" "${f2}"
      ;;
    STEP_DONE)
      STATUS["${f1}"]="passed"; DETAIL["${f1}"]="${f2}"; PASSED=$((PASSED + 1))
      if [[ "${JSON_MODE}" == "false" ]]; then
        [[ "${IS_CI}" == "true" ]] && echo "  ✓ [${f1}] ${f2}" || printf "${G}  ✓ [%s] %s${N}\n" "${f1}" "${f2}"
      fi
      ;;
    ASSERTION_FAILED)
      STATUS["${f1}"]="failed"; DETAIL["${f1}"]="${f2}"; FAILED=$((FAILED + 1))
      if [[ "${JSON_MODE}" == "false" ]]; then
        [[ "${IS_CI}" == "true" ]] && echo "::error::ASSERTION_FAILED [${f1}]: ${f2}" || printf "${R}  ✗ [%s] %s${N}\n" "${f1}" "${f2}"
      fi
      ;;
    RUN_COMPLETED)
      RUN_RESULT="${f1}"; RUN_SUMMARY="${f2}"
      if [[ "${JSON_MODE}" == "false" ]]; then
        if [[ "${IS_CI}" == "true" ]]; then
          [[ "${f1}" == "failed" ]] && echo "::error::RUN ${f1}: ${f2}" || echo "RUN ${f1}: ${f2}"
        else
          [[ "${f1}" == "failed" ]] && printf "\n${R}✗ RUN FAILED: %s${N}\n" "${f2}" || printf "\n${G}✓ RUN PASSED: %s${N}\n" "${f2}"
        fi
      fi
      ;;
    ROUTE|ARIA)
      # Pass-through tags for PostToolUse hooks (M125 #6 — expect/snapshot-recorder).
      # Always emitted on stdout so they survive into the Skill's tool_output.
      printf '%s|%s\n' "${cmd}" "${f1}"
      ;;
    JEV_SHADOW)
      # Jev log line (references/jev-shadow.md; shadow or act mode). Passed
      # through like ROUTE/ARIA and also folded into the JSON report beside
      # the step.
      JEV["${f1}"]="${f2}"
      printf '%s|%s|%s\n' "${cmd}" "${f1}" "${f2}"
      ;;
  esac
done

# ── Derive result if RUN_COMPLETED was not emitted ─────────
if [[ -z "${RUN_RESULT}" ]]; then
  [[ "${FAILED}" -gt 0 ]] && RUN_RESULT="failed" || RUN_RESULT="passed"
  RUN_SUMMARY="${PASSED} passed, ${FAILED} failed"
fi

[[ "${JSON_MODE}" == "false" ]] && printf "\n${D}  %d passed, %d failed${N}\n" "${PASSED}" "${FAILED}"

# ── Jev run summary line (one per run, only when Jev judged steps) ──
if [[ "${#JEV[@]}" -gt 0 ]]; then
  for sid in "${!JEV[@]}"; do
    printf '%s\n' "${JEV[${sid}]}"
  done | python3 -c "
import sys, json
steps = picks = fallbacks = agreed = disagreed = 0
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: rec = json.loads(line)
    except Exception: continue
    steps += 1
    path = rec.get('path') or ''
    if path == 'jev': picks += 1
    elif path.startswith('fallback'): fallbacks += 1
    if rec.get('agree') is True: agreed += 1
    elif rec.get('agree') is False: disagreed += 1
denom = agreed + disagreed
rate = ('%.1f%%' % (100.0 * agreed / denom)) if denom else 'n/a'
print('JEV_RUN|steps=%d|picks=%d|fallbacks=%d|agree_rate=%s' % (steps, picks, fallbacks, rate))
"
fi

# ── Build JSON via python (safe escaping) ──────────────────
build_json() {
  local ts; ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local input=""
  for id in "${ORDER[@]}"; do
    input+="${id}"$'\t'"${TITLES[${id}]:-}"$'\t'"${STATUS[${id}]:-pending}"$'\t'"${DETAIL[${id}]:-}"$'\n'
  done
  for sid in "${!JEV[@]}"; do
    input+="JEV"$'\t'"${sid}"$'\t'"${JEV[${sid}]}"$'\n'
  done
  echo "${input}" | python3 -c "
import sys, json
steps = []
jev_rows = []
for line in sys.stdin.read().strip().split('\n'):
    if not line.strip(): continue
    if line.startswith('JEV\t'):
        jparts = line.split('\t', 2)
        if len(jparts) == 3:
            try: jev_rows.append((jparts[1], json.loads(jparts[2])))
            except Exception: pass
        continue
    parts = line.split('\t', 3)
    if len(parts) < 4: continue
    sid, title, status, detail = parts
    step = {'id': sid, 'title': title, 'status': status}
    if status == 'passed': step['summary'] = detail
    elif status == 'failed': step['error'] = detail; step['category'] = 'app-bug'
    steps.append(step)
report = {'timestamp': '${ts}', 'steps': steps, 'passed': ${PASSED},
  'failed': ${FAILED}, 'result': '${RUN_RESULT}', 'summary': '${RUN_SUMMARY}'}
if jev_rows:
    by_id = {s['id']: s for s in steps}
    agreed = disagreed = picks = fallbacks = 0
    for sid, rec in jev_rows:
        if sid in by_id: by_id[sid]['jev_shadow'] = rec
        path = rec.get('path') or ''
        if path == 'jev': picks += 1
        elif path.startswith('fallback'): fallbacks += 1
        if rec.get('agree') is True: agreed += 1
        elif rec.get('agree') is False: disagreed += 1
    denom = agreed + disagreed
    report['jev_shadow'] = {
        'recorded': len(jev_rows), 'agreed': agreed, 'disagreed': disagreed,
        'steps': len(jev_rows), 'picks_taken': picks, 'fallbacks': fallbacks,
        'agree_rate': ('%.1f%%' % (100.0 * agreed / denom)) if denom else None}
print(json.dumps(report, indent=2))
"
}

# ── JSON output / save ─────────────────────────────────────
if [[ "${JSON_MODE}" == "true" || "${SAVE_MODE}" == "true" ]]; then
  JSON_OUTPUT=$(build_json)
  [[ "${JSON_MODE}" == "true" ]] && echo "${JSON_OUTPUT}"
  if [[ "${SAVE_MODE}" == "true" ]]; then
    REPORT_DIR=".expect/reports"
    mkdir -p "${REPORT_DIR}"
    REPORT_FILE="${REPORT_DIR}/$(date -u +"%Y-%m-%dT%H%M%SZ").json"
    echo "${JSON_OUTPUT}" > "${REPORT_FILE}"
    [[ "${JSON_MODE}" == "false" ]] && printf "${D}  Report saved: %s${N}\n" "${REPORT_FILE}"
  fi
fi

# ── Exit code ──────────────────────────────────────────────
[[ "${FAILED}" -gt 0 ]] && exit 1
exit 0

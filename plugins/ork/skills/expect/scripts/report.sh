#!/usr/bin/env bash
set -euo pipefail

# Status Protocol Parser for /ork:expect (#1189)
# Usage: ... | bash report.sh [--json] [--save]
# Protocol: STEP_START|id|title, STEP_DONE|id|summary, ASSERTION_FAILED|id|reason, RUN_COMPLETED|result|summary

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
declare -A TITLES STATUS DETAIL
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
  esac
done

# ── Derive result if RUN_COMPLETED was not emitted ─────────
if [[ -z "${RUN_RESULT}" ]]; then
  [[ "${FAILED}" -gt 0 ]] && RUN_RESULT="failed" || RUN_RESULT="passed"
  RUN_SUMMARY="${PASSED} passed, ${FAILED} failed"
fi

[[ "${JSON_MODE}" == "false" ]] && printf "\n${D}  %d passed, %d failed${N}\n" "${PASSED}" "${FAILED}"

# ── Build JSON via python (safe escaping) ──────────────────
build_json() {
  local ts; ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local input=""
  for id in "${ORDER[@]}"; do
    input+="${id}"$'\t'"${TITLES[${id}]:-}"$'\t'"${STATUS[${id}]:-pending}"$'\t'"${DETAIL[${id}]:-}"$'\n'
  done
  echo "${input}" | python3 -c "
import sys, json
steps = []
for line in sys.stdin.read().strip().split('\n'):
    if not line.strip(): continue
    parts = line.split('\t', 3)
    if len(parts) < 4: continue
    sid, title, status, detail = parts
    step = {'id': sid, 'title': title, 'status': status}
    if status == 'passed': step['summary'] = detail
    elif status == 'failed': step['error'] = detail; step['category'] = 'app-bug'
    steps.append(step)
print(json.dumps({'timestamp': '${ts}', 'steps': steps, 'passed': ${PASSED},
  'failed': ${FAILED}, 'result': '${RUN_RESULT}', 'summary': '${RUN_SUMMARY}'}, indent=2))
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

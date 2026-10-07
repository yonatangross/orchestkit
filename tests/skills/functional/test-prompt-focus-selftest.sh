#!/usr/bin/env bash
# prompt-focus: the synthetic selftest (attribution kinds, counts-only output, no prompt
# text in agg or page) and an idempotent daily row on a synthetic HOME.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PF="$ROOT/src/skills/prompt-focus/scripts/prompt_focus.py"

python3 -I "$PF" selftest

TMP="$(mktemp -d "${TMPDIR:-/tmp}/prompt-focus.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
HOME="$TMP" PROMPT_FOCUS_DIR="$TMP/pf" python3 -I -c "
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('pf', '$PF'); pf = importlib.util.module_from_spec(spec); spec.loader.exec_module(pf)
pf.fake_home(pathlib.Path('$TMP'))
"
HOME="$TMP" PROMPT_FOCUS_DIR="$TMP/pf" python3 -I "$PF" daily >/dev/null
second="$(HOME="$TMP" PROMPT_FOCUS_DIR="$TMP/pf" python3 -I "$PF" daily)"
rows="$(wc -l < "$TMP/pf/daily.jsonl" | tr -d ' ')"
case "$second" in skip*) ;; *) echo "FAIL: second daily call wrote again: $second"; exit 1 ;; esac
[ "$rows" = "1" ] || { echo "FAIL: daily.jsonl has $rows rows, expected 1"; exit 1; }
if grep -q "upload job" "$TMP/pf/daily.jsonl" "$TMP/pf/agg.json"; then echo "FAIL: prompt text in output"; exit 1; fi
# Every text read and write names its encoding (CodeRabbit 4211153794): without
# encoding="utf-8" the history and the report decode with the platform default,
# which is not UTF-8 on Windows.
python3 -I -c '
import ast, sys
tree = ast.parse(open(sys.argv[1], encoding="utf-8").read())
bad = []
for node in ast.walk(tree):
    if isinstance(node, ast.Call):
        name = getattr(node.func, "attr", None) or getattr(node.func, "id", None)
        if name in ("read_text", "write_text", "open") and not any(k.arg == "encoding" for k in node.keywords):
            bad.append("line %d: %s() without encoding" % (node.lineno, name))
if bad:
    print("FAIL: " + "; ".join(bad))
    sys.exit(1)
' "$PF"
# HOLD 6046590959 (a): malformed history lines are skipped and counted, never a crash.
BAD="$(mktemp -d "${TMPDIR:-/tmp}/prompt-focus-bad.XXXXXX")"
trap 'rm -rf "$TMP" "$BAD"' EXIT
mkdir -p "$BAD/.claude" "$BAD/.codex"
NOW_MS="$(python3 -c 'import time; print(int(time.time() * 1000) - 86400000)')"
{
  echo 'null'
  echo '{"display": null, "timestamp": '"$NOW_MS"'}'
  echo '{"display": "a string timestamp", "timestamp": "yesterday"}'
  echo 'not json at all'
  echo '{"display": "a valid prompt about the build", "timestamp": '"$NOW_MS"', "project": "/x/alpha"}'
} > "$BAD/.claude/history.jsonl"
echo '{"text": "codex bad ts", "ts": "soon"}' > "$BAD/.codex/history.jsonl"
scan_out="$(HOME="$BAD" PROMPT_FOCUS_DIR="$BAD/pf" python3 -I "$PF" scan 2>&1)" || { echo "FAIL: scan crashed on malformed history: $scan_out"; exit 1; }
case "$scan_out" in *"skipped 5 malformed"*) ;; *) echo "FAIL: scan did not report 5 skipped lines: $scan_out"; exit 1 ;; esac
HOME="$BAD" PROMPT_FOCUS_DIR="$BAD/pf" python3 -I "$PF" report >/dev/null 2>&1 || { echo "FAIL: report crashed on malformed history"; exit 1; }

# HOLD 6046590959 (b): daily validates the date, refuses today without --force,
# rewrites a partial row, and tolerates a bad line in daily.jsonl.
DAY_ENV=(env HOME="$BAD" PROMPT_FOCUS_DIR="$BAD/pf" PROMPT_FOCUS_TODAY=2026-10-07)
if "${DAY_ENV[@]}" python3 -I "$PF" daily 2026-10-7 >/dev/null 2>&1; then echo "FAIL: daily accepted the date 2026-10-7"; exit 1; fi
if "${DAY_ENV[@]}" python3 -I "$PF" daily 2026-10-07 >/dev/null 2>&1; then echo "FAIL: daily froze today without --force"; exit 1; fi
"${DAY_ENV[@]}" python3 -I "$PF" daily 2026-10-07 --force >/dev/null || { echo "FAIL: daily today --force failed"; exit 1; }
"${DAY_ENV[@]}" python3 -I "$PF" daily 2026-10-07 --force >/dev/null || { echo "FAIL: daily could not rewrite a partial row"; exit 1; }
today_rows="$(grep -c '"date": "2026-10-07"' "$BAD/pf/daily.jsonl")"
[ "$today_rows" = "1" ] || { echo "FAIL: partial row for today written $today_rows times"; exit 1; }
grep -q '"partial": true' "$BAD/pf/daily.jsonl" || { echo "FAIL: today's row is not marked partial"; exit 1; }
echo 'garbage line' >> "$BAD/pf/daily.jsonl"
"${DAY_ENV[@]}" python3 -I "$PF" daily 2026-10-05 >/dev/null || { echo "FAIL: one bad line in daily.jsonl broke daily"; exit 1; }

echo "PASS: prompt-focus selftest, idempotent daily row, counts-only output"

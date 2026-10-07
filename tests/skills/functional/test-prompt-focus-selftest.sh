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
echo "PASS: prompt-focus selftest, idempotent daily row, counts-only output"

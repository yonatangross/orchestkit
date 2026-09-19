#!/usr/bin/env bash
# GH-4162: triage asks always use templates/triage.html, and the page
# carries the six-part contract plus a machine-parsable DECIDE pick.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL="$ROOT/src/skills/glyph/SKILL.md"
PAGE="$ROOT/src/skills/glyph/templates/triage.html"
fail() { echo "✗ $1"; exit 1; }

grep -q 'templates/triage.html' "$SKILL" || fail "SKILL.md does not route triage asks to the template"
grep -q 'wave=LANE followups=CSV' "$SKILL" || fail "SKILL.md does not name the pick token"
grep -q 'never `followups=0`' "$SKILL" || fail "SKILL.md still allows followups=0 for an empty pick"
grep -q 'gh pr list' "$SKILL" || fail "SKILL.md fills open PRs from the issue snapshot"
grep -q 'except the triage page' "$SKILL" || fail "inline rule still forbids the triage file"
grep -q 'other than the triage page' "$SKILL" || fail "visualize-plan still claims every file output"
grep -q '/page-serve' "$SKILL" || fail "SKILL.md does not hand the page over with page-serve"

for needle in 'class="kpis"' 'data-lane="bugs"' 'class="route"' 'Capability map' 'id="decide"' 'id="raw"' 'wave=' 'followups=' 'EXAMPLE' 'gh pr list'; do
  grep -q "$needle" "$PAGE" || fail "triage.html missing: $needle"
done

if grep -q 'followups=0' "$PAGE"; then
  fail "empty follow-ups still emit followups=0"
fi
if grep -Eq '#(4159|4162|3131)|value="(4159|4162|3131)"' "$PAGE"; then
  fail "triage.html still uses live issue numbers as sample data"
fi

# No em dash in the template. The gate and the issue both forbid it.
if grep -q $'\u2014' "$PAGE"; then
  fail "triage.html contains an em dash"
fi

grep -q 'so a title stays literal text' "$SKILL" || fail "SKILL.md does not require escaping gh-sourced titles"
grep -q 'fb.hidden = true' "$PAGE" || fail "clipboard fallback textarea stays visible after copy"
grep -q 'function escapeHtml' "$PAGE" || fail "triage.html has no escapeHtml"

COPIES=(
  "$ROOT/src/skills/glyph/templates/triage.html"
  "$ROOT/plugins/ork/skills/glyph/templates/triage.html"
  "$ROOT/docs/feat--glyph-triage/index.html"
)
digest() { python3 -c 'import hashlib,sys; print(hashlib.md5(open(sys.argv[1],"rb").read()).hexdigest())' "$1"; }
base="$(digest "$PAGE")"
for copy in "${COPIES[@]}"; do
  [[ -f "$copy" ]] || fail "missing triage copy: $copy"
  [[ "$(digest "$copy")" == "$base" ]] || fail "triage.html copies diverged: $copy"
done
LAB="$ROOT/docs/site/public/lab/feat--glyph-triage.html"
grep -q 'function escapeHtml' "$LAB" || fail "lab copy has no escapeHtml"
grep -q 'fb.hidden = true' "$LAB" || fail "lab copy leaves the clipboard textarea visible"

# Plant a tag-shaped title, run the page's own escapeHtml, and assert the
# parsed document has that title as text with no live element.
TITLE='<img src=x onerror=alert(1)>'
ESCAPED="$(node -e '
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(process.argv[1], "utf8");
const start = src.indexOf("function escapeHtml");
if (start < 0) process.exit(2);
const end = src.indexOf("\n  }", start);
if (end < 0) process.exit(2);
const escapeHtml = vm.runInNewContext(src.slice(start, end + 4) + "\nescapeHtml;");
process.stdout.write(escapeHtml(process.argv[2]));
' "$PAGE" "$TITLE")"

python3 - "$TITLE" "$ESCAPED" << 'PY'
import sys
from html.parser import HTMLParser

title, escaped = sys.argv[1], sys.argv[2]
if "<" in escaped or ">" in escaped:
    sys.exit("escaped title still contains a raw bracket")

class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.live = []
    def handle_starttag(self, tag, attrs):
        if tag != "li":
            self.live.append(tag)
    def handle_data(self, data):
        self.text.append(data)

parser = Collector()
parser.feed("<li>" + escaped + "</li>")
got = "".join(parser.text)
if got != title or parser.live:
    sys.exit("title rendered as markup: %r tags=%r" % (got, parser.live))
PY

echo "✓ triage template is the routed page, with a parsable DECIDE pick"

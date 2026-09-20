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

# Plant a tag-shaped title into the page's real insertion source, load the
# rendered DOM in Chrome, and assert the payload is text. A title pasted into
# the lane list or the raw dump with no insertion-time escape fails here.
CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v google-chrome-stable 2>/dev/null || true)" \
  "$(command -v chromium 2>/dev/null || true)" \
  "$(command -v chromium-browser 2>/dev/null || true)"; do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    CHROME="$candidate"
    break
  fi
done
[[ -n "$CHROME" ]] || fail "no Chrome or Chromium to load the rendered triage page"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
python3 - "$PAGE" "$WORK/planted.html" << 'PY'
import pathlib, sys
src, dest = sys.argv[1], sys.argv[2]
html = pathlib.Path(src).read_text()
title = "<img src=x onerror=\"document.documentElement.setAttribute('data-xss','img')\">"
raw = (
    title
    + "<script>document.documentElement.setAttribute('data-xsss','script')</script>"
    + "<svg onload=\"document.documentElement.setAttribute('data-xssv','svg')\"></svg>"
)
amp = "cafe &amp; tea"
if 'id="snapshot"' in html:
    import json
    payload = json.dumps({
        "items": [
            {"lane": "bugs", "title": title, "route": "devin"},
            {"lane": "bugs", "title": amp, "route": "devin"},
        ],
        "raw": raw,
    })
    if "</textarea" in payload:
        sys.exit("payload breaks out of the snapshot textarea")
    start = html.find('<textarea id="snapshot"')
    open_end = html.find(">", start)
    close = html.find("</textarea>", open_end)
    if start < 0 or open_end < 0 or close < 0:
        sys.exit("snapshot textarea is not a closed element")
    html = html[: open_end + 1] + payload + html[close:]
else:
    lane = html.find('data-lane="bugs"')
    li_open = html.find("<li>", lane)
    li_close = html.find("</li>", li_open)
    if lane < 0 or li_open < 0 or li_close < 0:
        sys.exit("bugs lane has no list item to plant into")
    html = html[: li_open + len("<li>")] + title + html[li_close:]
    pre_open = html.find('<pre id="raw">')
    pre_close = html.find("</pre>", pre_open)
    if pre_open < 0 or pre_close < 0:
        sys.exit("raw dump is missing")
    html = html[: pre_open + len('<pre id="raw">')] + raw + html[pre_close:]
pathlib.Path(dest).write_text(html)
PY

"$CHROME" --headless=new --disable-gpu --no-sandbox --no-first-run \
  --user-data-dir="$WORK/profile" --virtual-time-budget=1500 \
  --dump-dom "file://$WORK/planted.html" >"$WORK/dom.html" 2>"$WORK/chrome.err" &
chrome_pid=$!
loaded=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if grep -q '</html>' "$WORK/dom.html" 2>/dev/null; then
    loaded=1
    break
  fi
  sleep 1
done
pkill -f "$WORK/profile" >/dev/null 2>&1 || true
kill "$chrome_pid" >/dev/null 2>&1 || true
wait "$chrome_pid" 2>/dev/null || true
[[ "$loaded" == 1 ]] || fail "Chrome produced no DOM; the planted title is still live markup"

python3 - "$WORK/dom.html" << 'PY'
import sys
from html.parser import HTMLParser

title = "<img src=x onerror=\"document.documentElement.setAttribute('data-xss','img')\">"
amp = "cafe & tea"
raw_script = "<script>document.documentElement.setAttribute('data-xsss','script')</script>"
raw_svg = "<svg onload=\"document.documentElement.setAttribute('data-xssv','svg')\"></svg>"

class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.live = []
        self.html_attrs = {}
        self.scripts = 0
        self.stack = []
        self.li = []
        self.raw = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("img", "svg"):
            self.live.append(tag)
        if tag == "script":
            self.scripts += 1
        if tag == "html":
            self.html_attrs = attrs
        self.stack.append(tag)
    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
    def handle_data(self, data):
        if "textarea" in self.stack:
            return
        if "li" in self.stack:
            self.li.append(data)
        if "pre" in self.stack:
            self.raw.append(data)

parser = Collector()
parser.feed(open(sys.argv[1], encoding="utf-8").read())
fired = [k for k in ("data-xss", "data-xsss", "data-xssv") if k in parser.html_attrs]
if parser.live or fired or parser.scripts > 1:
    sys.exit(
        "planted title is live markup: tags=%r fired=%r scripts=%d"
        % (parser.live, fired, parser.scripts)
    )
lane = "".join(parser.li)
raw = "".join(parser.raw)
if title not in lane:
    sys.exit("lane list does not show the planted title as text")
if amp not in lane or "cafe &amp; tea" in lane:
    sys.exit("ampersand title was dropped or double-escaped")
if title not in raw or raw_script not in raw or raw_svg not in raw:
    sys.exit("raw dump does not show the planted snapshot as text")
PY

grep -q 'escapeHtml(item.title)' "$PAGE" || fail "lane item is not escaped at insertion"
grep -q 'escapeHtml(data.raw)' "$PAGE" || fail "raw dump is not escaped at insertion"
grep -q 'escapeHtml(data.raw)' "$LAB" || fail "lab copy does not escape the raw dump"

echo "✓ triage template is the routed page, with a parsable DECIDE pick"

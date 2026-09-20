#!/usr/bin/env bash
# GH-4162: triage asks always use templates/triage.html, and the page
# carries the six-part contract plus a machine-parsable DECIDE pick.
# Hostile titles must stay text after render, including a title that
# contains </textarea (the snapshot textarea breakout).

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
grep -q 'so a title stays literal text' "$SKILL" || fail "SKILL.md does not require escaping gh-sourced titles"
grep -q '</textarea' "$SKILL" || fail "SKILL.md does not name the </textarea snapshot breakout"

for needle in 'class="kpis"' 'data-lane="bugs"' 'class="route"' 'Capability map' 'id="decide"' 'id="raw"' 'wave=' 'followups=' 'EXAMPLE' 'gh pr list' 'id="snapshot"' 'atob(' 'clearLanes'; do
  grep -q "$needle" "$PAGE" || fail "triage.html missing: $needle"
done

if grep -q 'followups=0' "$PAGE"; then
  fail "empty follow-ups still emit followups=0"
fi
if grep -Eq '#(4159|4162|3131)|value="(4159|4162|3131)"' "$PAGE"; then
  fail "triage.html still uses live issue numbers as sample data"
fi
if grep -q $'\u2014' "$PAGE"; then
  fail "triage.html contains an em dash"
fi

grep -q 'fb.hidden = true' "$PAGE" || fail "clipboard fallback textarea stays visible after copy"
grep -q 'function escapeHtml' "$PAGE" || fail "triage.html has no escapeHtml"
grep -q 'escapeHtml(item.title)' "$PAGE" || fail "lane item is not escaped at insertion"
grep -q 'escapeHtml(data.raw' "$PAGE" || fail "raw dump is not escaped at insertion"

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
grep -q 'atob(' "$LAB" || fail "lab copy does not decode the base64 snapshot"
grep -q 'escapeHtml(data.raw' "$LAB" || fail "lab copy does not escape the raw dump"
grep -q 'fb.hidden = true' "$LAB" || fail "lab copy leaves the clipboard textarea visible"

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

assert_pass() {
  python3 - "$1" << 'PY'
import sys
from html.parser import HTMLParser

breakout = (
    '</textarea><img src=x onerror="'
    "document.documentElement.setAttribute('data-xss','img')"
    '">'
)
amp = "cafe & tea"
raw_script = "<script>document.documentElement.setAttribute('data-xsss','script')</script>"
raw_svg = "<svg onload=\"document.documentElement.setAttribute('data-xssv','svg')\"></svg>"
ALLOWED_HTML = {"lang", "dir"}

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
unexpected = sorted(k for k in parser.html_attrs if k not in ALLOWED_HTML)
if parser.live or unexpected or parser.scripts > 1:
    sys.exit(
        "live markup after render: tags=%r unexpected_html_attrs=%r scripts=%d"
        % (parser.live, unexpected, parser.scripts)
    )
lane = "".join(parser.li)
raw = "".join(parser.raw)
if breakout not in lane:
    sys.exit("lane list does not show the </textarea title as text")
if amp not in lane or "cafe &amp; tea" in lane:
    sys.exit("ampersand title was dropped or double-escaped")
if breakout not in raw or raw_script not in raw or raw_svg not in raw:
    sys.exit("raw dump does not show the planted snapshot as text")
PY
}

assert_fail_live() {
  python3 - "$1" << 'PY'
import sys
from html.parser import HTMLParser
ALLOWED_HTML = {"lang", "dir"}
class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.live = []
        self.html_attrs = {}
        self.scripts = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("img", "svg"):
            self.live.append(tag)
        if tag == "script":
            self.scripts += 1
        if tag == "html":
            self.html_attrs = attrs
parser = Collector()
parser.feed(open(sys.argv[1], encoding="utf-8").read())
unexpected = sorted(k for k in parser.html_attrs if k not in ALLOWED_HTML)
if parser.live or unexpected or parser.scripts > 1:
    sys.exit(0)
sys.exit("expected live markup or an unexpected <html> attribute, found none")
PY
}

run_case() {
  local mode="$1"
  local expect="$2"
  local out="$WORK/$mode"
  mkdir -p "$out"
  python3 - "$PAGE" "$out/planted.html" "$mode" << 'PY'
import base64, json, pathlib, re, sys

src, dest, mode = sys.argv[1], sys.argv[2], sys.argv[3]
html = pathlib.Path(src).read_text()

breakout = (
    '</textarea><img src=x onerror="'
    "document.documentElement.setAttribute('data-xss','img')"
    '">'
)
script_bit = "<script>document.documentElement.setAttribute('data-xsss','script')</script>"
svg_bit = (
    "<svg onload=\"document.documentElement.setAttribute('data-xssv','svg')\"></svg>"
)
amp = "cafe & tea"
raw = breakout + script_bit + svg_bit

def put_snapshot(page, body):
    start = page.find('<textarea id="snapshot"')
    open_end = page.find(">", start)
    close = page.find("</textarea>", open_end)
    if start < 0 or open_end < 0 or close < 0:
        sys.exit("snapshot textarea is not a closed element")
    return page[: open_end + 1] + body + page[close:]

def plant_static(page, lane, payload):
    marker = 'data-lane="' + lane + '"'
    at = page.find(marker)
    li_open = page.find("<li>", at)
    li_close = page.find("</li>", li_open)
    if at < 0 or li_open < 0 or li_close < 0:
        sys.exit("lane %s has no list item" % lane)
    return page[: li_open + len("<li>")] + payload + page[li_close:]

def plant_raw(page, payload):
    pre_open = page.find('<pre id="raw">')
    pre_close = page.find("</pre>", pre_open)
    if pre_open < 0 or pre_close < 0:
        sys.exit("raw dump is missing")
    return page[: pre_open + len('<pre id="raw">')] + payload + page[pre_close:]

items = [
    {"lane": "bugs", "title": breakout, "route": "devin"},
    {"lane": "bugs", "title": amp, "route": "devin"},
]
encoded = base64.b64encode(
    json.dumps({"items": items, "raw": raw}, separators=(",", ":")).encode()
).decode()
raw_json = json.dumps({"items": items, "raw": raw}, separators=(",", ":"))

if mode == "encoded":
    html = put_snapshot(html, encoded)
elif mode == "static-bugs":
    # Live markup in the static bugs lane and #raw fires at parse time,
    # before clearLanes. The test must FAIL on that tree.
    html = put_snapshot(html, encoded)
    html = plant_static(html, "bugs", breakout)
    html = plant_raw(html, raw)
elif mode == "raw-json":
    html = put_snapshot(html, raw_json)
elif mode == "no-escape":
    html = put_snapshot(html, encoded)
    html = re.sub(
        r"escapeHtml\((item\.title|item\.route|data\.raw[^)]*)\)",
        r"(\1)",
        html,
    )
elif mode == "no-clear":
    html = put_snapshot(html, encoded)
    html = plant_static(html, "quick-wins", breakout)
    html = re.sub(r"\n  function clearLanes\(\) \{.*?\n  \}\n", "\n", html, count=1, flags=re.S)
    html = html.replace("clearLanes();\n", "", 1)
else:
    sys.exit("unknown mode %s" % mode)

pathlib.Path(dest).write_text(html)
PY

  "$CHROME" --headless=new --disable-gpu --no-sandbox --no-first-run \
    --user-data-dir="$out/profile" --virtual-time-budget=1500 \
    --dump-dom "file://$out/planted.html" >"$out/dom.html" 2>"$out/chrome.err" &
  local chrome_pid=$!
  local loaded=0
  local _
  # The first launch pays a cold start: 9.2s measured on a GitHub runner
  # against a 12s ceiling, which made this gate a coin flip (node 20 red,
  # node 22 green, same commit). Budget well above the cold start.
  for _ in $(seq 60); do
    if grep -q '</html>' "$out/dom.html" 2>/dev/null; then
      loaded=1
      break
    fi
    sleep 1
  done
  pkill -f "$out/profile" >/dev/null 2>&1 || true
  kill "$chrome_pid" >/dev/null 2>&1 || true
  wait "$chrome_pid" 2>/dev/null || true

  # A browser that rendered nothing cannot arbitrate ANY case. Counting it
  # as a pass let every negative mutation self-certify: with a stub browser
  # that writes no DOM, the tree with escapeHtml REMOVED still exited 0.
  if [[ "$loaded" != 1 ]]; then
    echo "  --- chrome stderr (mode=$mode) ---" >&2
    tail -20 "$out/chrome.err" >&2 || true
    fail "mode=$mode produced no DOM, so no mutation case can be judged"
  fi

  if [[ "$expect" == "pass" ]]; then
    assert_pass "$out/dom.html" || fail "mode=$mode expected pass after render"
    echo "  ✓ mode=$mode pass after render"
  else
    assert_fail_live "$out/dom.html" || fail "mode=$mode expected live markup after render"
    echo "  ✓ mode=$mode failed as required"
  fi
}

echo "mutation proofs:"
run_case encoded pass
run_case raw-json fail
run_case no-escape fail
run_case static-bugs fail
run_case no-clear fail

echo "✓ triage template is the routed page, with a parsable DECIDE pick"

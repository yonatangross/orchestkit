#!/usr/bin/env python3
"""prompt-focus: where your attention went, measured from your own prompts.

Reads your local Claude Code and Codex input history (read only), keeps only the
prompts YOU typed (slash commands, shell lines, pastes and agent-written briefs are
counted apart), groups them by project or by your own areas, and writes:

  <dir>/agg.json      counts and categories only, no prompt text
  <dir>/daily.jsonl   one row per day (counts only)
  <dir>/report.html   a self-contained page: stream graph, hours, re-typed asks

Commands:  scan | daily [YYYY-MM-DD] [--force] | report | demo | selftest
Config:    <dir>/config.json (optional), <dir> = $PROMPT_FOCUS_DIR or ~/.claude/prompt-focus
Stdlib only. Never sends anything anywhere.
"""

import collections
import datetime as dt
import html
import json
import os
import random
import re
import sys
import tempfile
from pathlib import Path

WEEKS = 20
DAY = 86400

DEFAULTS = {
    "weeks": WEEKS,
    "max_areas": 8,
    # Your own topic areas: {"name": ["regex", ...]}. Without them, the area is the project folder name.
    "areas": {},
    # Text that marks a prompt an AGENT wrote into your terminal (multi-agent setups paste briefs as input).
    "brief_patterns": [
        r"\(\s*[^()\n]{2,80},\s*(Claude|Codex|GPT|Opus|Sonnet|Haiku|Gemini)\b[^()\n]{0,80}\)\s*\.?\s*$",
        r"via (Claude Code|Codex|Cursor)\b",
        r"^\s*You are (the |lane )?[a-z0-9]+([-_][a-z0-9]+)+[\s,.:(]",
    ],
    "markers": [],
}

FAMILIES = [
    (
        "keep going",
        r"^(ok |so |yes |yep )*(continue|go( ahead)?|do it( all)?|keep going|proceed)\b",
        "Keep going without asking when the next step is clear and safe.",
    ),
    (
        "status",
        r"\b(status|where (do )?we stand|progress)\b|^now\?$",
        "End each turn with one state line: done, running, waiting on me.",
    ),
    (
        "what's next",
        r"\bwhat'?s? next\b|\bwhat now\b",
        "Close each reply with ranked next steps and one recommendation.",
    ),
    (
        "show it visually",
        r"\b(ascii|diagram|visuali[sz]e|show me|chart)\b",
        "Answer anything with shape (status, comparison, inventory) with a small visual by default.",
    ),
    (
        "verify",
        r"\b(verify|properly|thoroughly|double.?check|make sure)\b",
        "Verify against the real state before saying done.",
    ),
    (
        "merge",
        r"\b(merge|merged|ship it)\b",
        "When a PR I asked for goes green, drive it to merge and report the merged state.",
    ),
    (
        "open it",
        r"\bopen (it )?(for me|it)\b",
        "Open every page or artifact for me when it is ready.",
    ),
]
FRX = [(n, re.compile(p, re.I), d) for n, p, d in FAMILIES]
NUDGE = re.compile(
    r"^\W*(ok |so |yes |and )*(continue|go|go ahead|keep going|proceed|now\??|status\??|yes|ok|done|"
    r"(so )?what'?s next\??)\W*$",
    re.I,
)
PH = re.compile(r"\[(Pasted text #\d+[^\]]*|Image #\d+)\]")


def home():
    return Path(os.environ.get("HOME", str(Path.home())))


def workdir():
    return Path(os.environ.get("PROMPT_FOCUS_DIR", str(home() / ".claude" / "prompt-focus")))


def config():
    cfg = dict(DEFAULTS)
    p = workdir() / "config.json"
    if p.exists():
        cfg.update(json.loads(p.read_text(encoding="utf-8")))
    return cfg


def today():
    t = os.environ.get("PROMPT_FOCUS_TODAY")
    return dt.date.fromisoformat(t) if t else dt.date.today()


def window(cfg):
    end = today()
    start = end - dt.timedelta(days=cfg["weeks"] * 7 - 1)
    t0 = dt.datetime.combine(start, dt.time()).astimezone().timestamp()
    t1 = dt.datetime.combine(end + dt.timedelta(days=1), dt.time()).astimezone().timestamp()
    return start, end, t0, t1


# ── read ──────────────────────────────────────────────────────────────────────


def _number(v):
    """A real number, or None (bool, str and null are not timestamps)."""
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def read_claude(bad):
    """Yield typed rows; count lines that are not usable history records in bad."""
    hist = home() / ".claude" / "history.jsonl"
    cache = home() / ".claude" / "paste-cache"
    if not hist.exists():
        return
    for line in hist.open(encoding="utf-8", errors="replace"):
        if not line.strip():
            continue
        try:
            d = json.loads(line)
        except ValueError:
            bad["claude-code"] += 1
            continue
        ts = _number(d.get("timestamp")) if isinstance(d, dict) else None
        text = d.get("display", "") if isinstance(d, dict) else None
        project = d.get("project") if isinstance(d, dict) else None
        if ts is None or not isinstance(text, str) or not isinstance(project, (str, type(None))):
            bad["claude-code"] += 1
            continue
        pasted = d.get("pastedContents") or {}
        if not isinstance(pasted, dict):
            bad["claude-code"] += 1
            continue
        pastes, unknown = [], 0
        for p in pasted.values():
            if not isinstance(p, dict) or p.get("type") == "image":
                continue
            # Inner entries are untrusted too: only string content or a string
            # hash counts; anything else is an unknown paste, never a crash.
            c = p.get("content")
            h = p.get("contentHash")
            if not isinstance(c, str):
                c = None
                if isinstance(h, str) and re.fullmatch(r"[A-Za-z0-9_-]+", h):
                    f = cache / (h + ".txt")
                    c = f.read_text(encoding="utf-8", errors="replace") if f.exists() else None
            if c is None:
                unknown += 1
            else:
                pastes.append(c)
        yield {
            "harness": "claude-code",
            "ts": ts / 1000,
            "text": text,
            "pastes": pastes,
            "paste_unknown": unknown,
            "project": project or "",
        }


def read_codex(bad):
    """Yield typed rows; count lines that are not usable history records in bad."""
    hist = home() / ".codex" / "history.jsonl"
    if not hist.exists():
        return
    for line in hist.open(encoding="utf-8", errors="replace"):
        if not line.strip():
            continue
        try:
            d = json.loads(line)
        except ValueError:
            bad["codex"] += 1
            continue
        ts = _number(d.get("ts")) if isinstance(d, dict) else None
        text = d.get("text", "") if isinstance(d, dict) else None
        if ts is None or not isinstance(text, str):
            bad["codex"] += 1
            continue
        yield {
            "harness": "codex",
            "ts": ts,
            "text": text,
            "pastes": [],
            "paste_unknown": 0,
            "project": "",
        }


# ── attribute + classify ──────────────────────────────────────────────────────


def kind_of(row, briefs):
    typed = PH.sub(" ", row["text"]).strip()
    if any(rx.search(p) for p in row["pastes"] for rx in briefs) and not typed:
        return "brief", typed
    if not typed:
        return (
            "paste"
            if row["pastes"] or row["paste_unknown"] or "[Pasted text" in row["text"]
            else "empty"
        ), ""
    if typed.startswith("/") and re.match(r"^/[a-z][\w:-]*", typed):
        return "command", typed
    if typed.startswith("!"):
        return "shell", typed
    if any(rx.search(typed) for rx in briefs):
        return "brief", typed
    return "typed", typed


def area_of(text, project, areas):
    for name, rxs in areas:
        if any(rx.search(text) for rx in rxs):
            return name
    base = Path(project.rstrip("/")).name if project else ""
    base = re.sub(r"^\.?worktrees?$", "", base)
    if "/.worktrees/" in project or "/worktrees/" in project:
        base = (
            project.split("/.worktrees/")[0].split("/worktrees/")[0].rstrip("/").rsplit("/", 1)[-1]
        )
    return base or "(no project)"


def scan(cfg):
    start, end, t0, t1 = window(cfg)
    briefs = [re.compile(p, re.M) for p in cfg["brief_patterns"]]
    areas = [(n, [re.compile(p, re.I) for p in ps]) for n, ps in cfg["areas"].items()]
    kinds = collections.Counter()
    prompts = []
    bad = collections.Counter()
    for row in [*read_claude(bad), *read_codex(bad)]:
        if not (t0 <= row["ts"] < t1):
            continue
        k, typed = kind_of(row, briefs)
        kinds[k] += 1
        if k == "typed":
            prompts.append(
                {
                    "ts": row["ts"],
                    "harness": row["harness"],
                    "words": len(typed.split()),
                    "area": area_of(typed, row["project"], areas),
                    "text": typed,
                }
            )
    top = [
        a for a, _ in collections.Counter(p["area"] for p in prompts).most_common(cfg["max_areas"])
    ]
    for p in prompts:
        if p["area"] not in top:
            p["area"] = "other"
    names = top + (["other"] if any(p["area"] == "other" for p in prompts) else [])

    def bucket():
        return {
            "prompts": 0,
            "words": 0,
            "nudges": 0,
            "areas": collections.Counter(),
            "harness": collections.Counter(),
            "hours": [0] * 24,
            "families": collections.Counter(),
        }

    weeks = [bucket() for _ in range(cfg["weeks"])]
    days = collections.defaultdict(bucket)
    total = bucket()
    for p in prompts:
        local = dt.datetime.fromtimestamp(p["ts"])
        w = min(cfg["weeks"] - 1, (local.date() - start).days // 7)
        for b in (weeks[w], days[local.date().isoformat()], total):
            b["prompts"] += 1
            b["words"] += p["words"]
            b["nudges"] += bool(NUDGE.match(p["text"]))
            b["areas"][p["area"]] += 1
            b["harness"][p["harness"]] += 1
            b["hours"][local.hour] += 1
            for n, rx, _ in FRX:
                if rx.search(p["text"]):
                    b["families"][n] += 1

    def dump(b):
        return {
            "prompts": b["prompts"],
            "words": b["words"],
            "nudges": b["nudges"],
            "areas": {a: b["areas"].get(a, 0) for a in names},
            "harness": dict(b["harness"]),
            "hours": b["hours"],
            "families": {n: b["families"].get(n, 0) for n, _, _ in FAMILIES},
        }

    return {
        "window": {"start": start.isoformat(), "end": end.isoformat(), "weeks": cfg["weeks"]},
        "areas": names,
        "kinds": dict(kinds),
        "skipped_lines": dict(bad),
        "markers": cfg["markers"],
        "total": dump(total),
        "weeks": [
            {"start": (start + dt.timedelta(days=7 * i)).isoformat(), **dump(b)}
            for i, b in enumerate(weeks)
        ],
        "days": {d: dump(b) for d, b in sorted(days.items())},
        "families": [{"name": n, "default": d} for n, _, d in FAMILIES],
    }


# ── report ────────────────────────────────────────────────────────────────────

PALETTE = [
    "#3f7cc4",
    "#8a6bd1",
    "#d08a2c",
    "#c8507a",
    "#2f9e8f",
    "#5a9e3c",
    "#c4643f",
    "#b4a12f",
    "#9aa3a8",
]

PAGE = r"""<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>__TITLE__</title><style>
:root{--bg:#f6f5f1;--panel:#fff;--ink:#1d1d1b;--muted:#6b6a65;--line:#e3e1da;--chip:#efede7;--accent:#c2410c;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
[data-theme=dark]{--bg:#141413;--panel:#1d1d1b;--ink:#ecebe6;--muted:#a3a19a;--line:#33322f;--chip:#262624;--accent:#f0883e}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font-family:var(--sans)}
.wrap{max-width:1040px;margin:0 auto;padding:28px}h1{font-size:2rem;letter-spacing:-.02em}
.sub{color:var(--muted);margin:8px 0 18px;line-height:1.5}h2{font:700 12px var(--mono);letter-spacing:.1em;
text-transform:uppercase;color:var(--muted);margin:34px 0 10px}.verdict{font-size:1.15rem;line-height:1.55;max-width:820px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}@media(max-width:800px){.kpis{grid-template-columns:1fr 1fr}}
.kpi,.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.kpi b{display:block;font-size:28px;letter-spacing:-.02em}.kpi span{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
svg{display:block;width:100%}.legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.legend button{font:600 12px var(--sans);border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:99px;padding:4px 10px;cursor:pointer}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}
.read{position:absolute;top:8px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12.5px;pointer-events:none;min-width:190px}
.fam{display:grid;grid-template-columns:24px 150px 1fr 120px;gap:10px;align-items:center;margin:8px 0;font-size:13.5px}
.fam small{grid-column:2/5;color:var(--muted);margin-top:-6px}.bar{height:10px;background:var(--chip);border-radius:4px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--ink);opacity:.7}.v{font:600 12px var(--mono);text-align:right}
textarea{width:100%;min-height:120px;font:12.5px/1.5 var(--mono);background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px}
.btn{margin-top:8px;font:700 13px var(--sans);background:var(--ink);color:var(--bg);border:0;border-radius:10px;padding:8px 14px;cursor:pointer}
.tog{position:fixed;top:12px;right:12px;font:600 12px var(--mono);border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:99px;padding:5px 10px;cursor:pointer}
ul{padding-left:18px;color:var(--muted);font-size:13.5px;line-height:1.6}
</style></head><body><button class="tog" id="tog">dark mode</button><div class="wrap">
<h1>__TITLE__</h1><p class="sub">__SUB__</p>
<h2>Verdict</h2><p class="verdict" id="verdict"></p><div class="kpis" id="kpis"></div>
<h2>The shape</h2><div class="panel" style="position:relative"><svg id="sg" height="320" tabindex="0" role="img" aria-label="prompts per week by area"></svg><div class="read" id="read" hidden></div><div class="legend" id="legend"></div></div>
<h2>Hour of day</h2><div class="panel"><svg id="hours" height="150" role="img" aria-label="prompts by hour"></svg></div>
<h2>What you keep re-typing</h2><div class="panel" id="fams"></div>
<h2>Copy as prompt</h2><textarea id="out" readonly></textarea><button class="btn" id="cp">Copy as prompt</button> <span id="ok"></span>
<h2>Caveats</h2><ul id="cav"></ul></div>
<script type="application/json" id="data">__DATA__</script><script>
(function(){var D=JSON.parse(document.getElementById('data').textContent),W=D.weeks,A=D.areas,C=D.colors,NS='http://www.w3.org/2000/svg';
function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}function f(n){return Number(n).toLocaleString('en-US')}
var t=D.total,P=t.prompts||1,top=A.slice().sort(function(a,b){return t.areas[b]-t.areas[a]})[0]||'?';
function share(ws,k){var s=0,n=0;ws.forEach(function(w){s+=k(w);n+=w.prompts});return 100*s/Math.max(1,n)}
var f4=W.slice(0,4),l4=W.slice(-4),w0=share(f4,function(w){return w.words})/100,w1=share(l4,function(w){return w.words})/100,
n0=share(f4,function(w){return w.nudges}),n1=share(l4,function(w){return w.nudges});
document.getElementById('verdict').textContent=top+' took '+Math.round(100*(t.areas[top]||0)/P)+' % of your prompts over '+W.length+' weeks. You sent about '+f(Math.round(t.prompts/W.length))+' prompts a week; words per prompt went from '+w0.toFixed(1)+' to '+w1.toFixed(1)+', and short nudges ("go", "status?") went from '+n0.toFixed(1)+' % to '+n1.toFixed(1)+' %.';
var ph=t.hours.indexOf(Math.max.apply(null,t.hours));
document.getElementById('kpis').innerHTML=[[f(t.prompts),'your prompts'],[w0.toFixed(1)+' → '+w1.toFixed(1),'words per prompt, first 4 vs last 4 weeks'],[n0.toFixed(1)+' → '+n1.toFixed(1)+' %','nudges, first 4 vs last 4 weeks'],[String(ph).padStart(2,'0')+':00','busiest hour']].map(function(k){return '<div class="kpi"><b>'+esc(k[0])+'</b><span>'+esc(k[1])+'</span></div>'}).join('');
var only=null,cur=-1,sg=document.getElementById('sg'),rd=document.getElementById('read');
function draw(){while(sg.firstChild)sg.removeChild(sg.firstChild);var bw=sg.clientWidth||900,bh=320,pt=12,pb=26,lo=0,hi=0;
var L=W.map(function(w){var v=A.map(function(a){return only&&only!==a?0:(w.areas[a]||0)}),s=v.reduce(function(x,y){return x+y},0),y0=-s/2;return v.map(function(x){var r=[y0,y0+x];y0+=x;return r})});
L.forEach(function(c){c.forEach(function(r){lo=Math.min(lo,r[0]);hi=Math.max(hi,r[1])})});sg.setAttribute('viewBox','0 0 '+bw+' '+bh);
var x=function(i){return 8+i*(bw-16)/Math.max(1,W.length-1)},y=function(v){return pt+(hi-v)*(bh-pt-pb)/((hi-lo)||1)};
function cv(p){var d='M'+p[0][0]+','+p[0][1];for(var i=1;i<p.length;i++){var m=(p[i-1][0]+p[i][0])/2;d+=' C'+m+','+p[i-1][1]+' '+m+','+p[i][1]+' '+p[i][0]+','+p[i][1]}return d}
A.forEach(function(a,j){var tp=W.map(function(_,i){return[x(i),y(L[i][j][1])]}),bt=W.map(function(_,i){return[x(i),y(L[i][j][0])]}).reverse(),b=cv(bt);
el('path',{d:cv(tp)+' L'+bt[0][0]+','+bt[0][1]+b.slice(b.indexOf(' C'))+' Z',fill:C[a],'fill-opacity':only&&only!==a?.08:.88,stroke:css('--bg'),'stroke-width':.6},sg)});
[0,Math.floor(W.length/2),W.length-1].forEach(function(i){el('text',{x:x(i),y:bh-8,'font-size':11,fill:css('--muted'),'text-anchor':i?(i===W.length-1?'end':'middle'):'start','font-family':css('--mono')},sg).textContent=W[i].start.slice(5)});
(D.markers||[]).forEach(function(m){var i=W.findIndex(function(w){return w.start>=m.date});if(i<0)return;el('line',{x1:x(i),x2:x(i),y1:pt,y2:bh-pb,stroke:css('--muted'),'stroke-dasharray':'3 4'},sg);el('text',{x:x(i)+5,y:pt+10,'font-size':11,fill:css('--muted')},sg).textContent=m.label});
sg._x=x;sg._cl=el('line',{x1:0,x2:0,y1:pt,y2:bh-pb,stroke:css('--ink'),visibility:'hidden'},sg);if(cur>=0)show(cur)}
function show(i){cur=i;var w=W[i],x=sg._x(i);sg._cl.setAttribute('x1',x);sg._cl.setAttribute('x2',x);sg._cl.setAttribute('visibility','visible');
var rows=A.map(function(a){return[a,w.areas[a]||0]}).sort(function(p,q){return q[1]-p[1]}).slice(0,5);rd.hidden=false;
rd.innerHTML='<b>week of '+esc(w.start.slice(5))+'</b><br>'+esc(f(w.prompts))+' prompts'+rows.map(function(r){return '<br><i style="display:inline-block;width:8px;height:8px;background:'+esc(C[r[0]])+'"></i> '+esc(r[0])+' '+esc(Math.round(100*r[1]/Math.max(1,w.prompts)))+' %'}).join('');
var px=x*sg.getBoundingClientRect().width/sg.viewBox.baseVal.width;rd.style.left=Math.max(0,px+210>sg.clientWidth?px-210:px+12)+'px'}
sg.onmousemove=function(e){var r=sg.getBoundingClientRect();show(Math.max(0,Math.min(W.length-1,Math.round((e.clientX-r.left)/r.width*(W.length-1)))))};
sg.onmouseleave=function(){rd.hidden=true;sg._cl.setAttribute('visibility','hidden');cur=-1};
sg.onkeydown=function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(Math.max(0,Math.min(W.length-1,(cur<0?W.length-1:cur)+(e.key==='ArrowRight'?1:-1))))}};
var lg=document.getElementById('legend');A.forEach(function(a){var b=document.createElement('button');b.innerHTML='<i style="background:'+esc(C[a])+'"></i>';b.appendChild(document.createTextNode(a));b.onclick=function(){only=only===a?null:a;draw()};lg.appendChild(b)});
function hours(){var s=document.getElementById('hours');while(s.firstChild)s.removeChild(s.firstChild);var bw=s.clientWidth||900,mx=Math.max.apply(null,t.hours)||1,g=bw/24;s.setAttribute('viewBox','0 0 '+bw+' 150');
t.hours.forEach(function(v,h){var hh=120*v/mx;el('rect',{x:h*g+2,y:128-hh,width:g-4,height:hh,rx:3,fill:v===mx?css('--accent'):css('--ink'),'fill-opacity':v===mx?1:.55},s);if(h%3===0)el('text',{x:h*g+g/2,y:146,'font-size':10.5,'text-anchor':'middle',fill:css('--muted'),'font-family':css('--mono')},s).textContent=String(h).padStart(2,'0')})}
var fx=document.getElementById('fams'),mxf=Math.max.apply(null,D.families.map(function(q){return t.families[q.name]||0}))||1;
fx.innerHTML=D.families.map(function(q,i){var a=share(f4,function(w){return w.families[q.name]||0}),b=share(l4,function(w){return w.families[q.name]||0});
return '<label class="fam"><input type="checkbox" value="'+esc(i)+'"'+(i<3?' checked':'')+'><span>'+esc(q.name)+'</span><span class="bar"><i style="width:'+esc(100*(t.families[q.name]||0)/mxf)+'%"></i></span><span class="v">'+esc(a.toFixed(1))+' → '+esc(b.toFixed(1))+' %</span><small>Default: '+esc(q.default)+'</small></label>'}).join('');
function build(){var pk=[].filter.call(fx.querySelectorAll('input'),function(i){return i.checked}).map(function(i){var q=D.families[+i.value];return '- '+q.default+' (I typed this about '+f(t.families[q.name]||0)+' times)'});
document.getElementById('out').value='Make these my defaults so I stop re-typing them (prompt-focus, '+D.window.start+' to '+D.window.end+'):\n'+pk.join('\n')+'\nPut each one where it takes effect without me (output style, CLAUDE.md or a hook). Show me the diff before you change anything.'}
fx.onchange=build;build();document.getElementById('cp').onclick=function(){var o=document.getElementById('out');o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand('copy')});document.getElementById('ok').textContent='copied'};
document.getElementById('cav').innerHTML=D.caveats.map(function(c){var li=document.createElement('li');li.textContent=c;return li.outerHTML}).join('');
var tg=document.getElementById('tog'),R=document.documentElement;function th(v){R.setAttribute('data-theme',v);tg.textContent=v==='dark'?'light mode':'dark mode';draw();hours()}
tg.onclick=function(){var n=R.getAttribute('data-theme')==='dark'?'light':'dark';try{localStorage.setItem('prompt-focus-theme',n)}catch(e){}th(n)};
var s0='light';try{s0=localStorage.getItem('prompt-focus-theme')||'light'}catch(e){}th(s0);window.addEventListener('resize',function(){draw();hours()})})();
</script></body></html>"""


def report(agg, title, path):
    k = agg["kinds"]
    agg = dict(agg)
    agg["colors"] = {a: PALETTE[i % len(PALETTE)] for i, a in enumerate(agg["areas"])}
    agg["caveats"] = [
        f"Counted as your prompts: {k.get('typed', 0):,} typed. Counted apart: {k.get('command', 0):,} slash commands, "
        f"{k.get('shell', 0):,} shell lines, {k.get('paste', 0):,} pastes, {k.get('brief', 0):,} agent briefs.",
        "Agent briefs are found by text patterns (config.json brief_patterns). Check 20 random rows before you trust the split.",
        "Only Claude Code and Codex input history are read. Other tools are not counted.",
        "This page holds counts only. No prompt text leaves your machine or lands in this file.",
    ]
    days = agg.pop("days", None)  # the page needs weeks, not days
    sub = f"Your own prompts, {agg['window']['start']} to {agg['window']['end']}. Local file, nothing is sent anywhere."
    page = (
        PAGE.replace("__TITLE__", html.escape(title))
        .replace("__SUB__", html.escape(sub))
        .replace("__DATA__", json.dumps(agg).replace("</", "<\\/"))
    )
    path.write_text(page, encoding="utf-8")
    if days is not None:
        agg["days"] = days
    return path


# ── demo + selftest ───────────────────────────────────────────────────────────


def fake_home(root, seed=7, weeks=WEEKS):
    """Write a synthetic history.jsonl: fake projects and fake prompts, nothing real."""
    rnd = random.Random(seed)
    projects = ["api", "web", "docs", "infra", "blog"]
    asks = [
        "continue",
        "go ahead",
        "status?",
        "what's next?",
        "show me a diagram of the flow",
        "verify the migration properly",
        "merge it",
        "add a retry to the upload job",
        "why is the login page slow",
        "write the release notes",
        "open it for me",
    ]
    (root / ".claude" / "paste-cache").mkdir(parents=True, exist_ok=True)
    end = today()
    lines = []
    for d in range(weeks * 7):
        day = end - dt.timedelta(days=d)
        mix = projects[: 3 + (d < weeks * 7 // 2)]
        for _ in range(rnd.randint(8, 30)):
            ts = dt.datetime.combine(
                day, dt.time(rnd.choice([9, 10, 11, 12, 14, 15, 16, 21]), rnd.randint(0, 59))
            ).timestamp()
            text = rnd.choice(asks)
            lines.append(
                {
                    "display": text,
                    "pastedContents": {},
                    "timestamp": int(ts * 1000),
                    "project": "/home/dev/code/" + rnd.choice(mix),
                    "sessionId": "s",
                }
            )
        if d % 9 == 0:
            ts = dt.datetime.combine(day, dt.time(13)).timestamp()
            lines.append(
                {
                    "display": "[Pasted text #1 +3 lines]",
                    "timestamp": int(ts * 1000),
                    "project": "/home/dev/code/api",
                    "pastedContents": {
                        "1": {
                            "type": "text",
                            "content": "You are worker-two, a helper lane. Fix the test.\n(worker-one, Claude via Claude Code)",
                        }
                    },
                }
            )
            lines.append(
                {
                    "display": "/model",
                    "pastedContents": {},
                    "timestamp": int(ts * 1000) + 1,
                    "project": "/home/dev/code/api",
                }
            )
    (root / ".claude" / "history.jsonl").write_text("".join(json.dumps(x) + "\n" for x in lines), encoding="utf-8")


def selftest():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        fake_home(root)
        os.environ["HOME"], os.environ["PROMPT_FOCUS_DIR"] = str(root), str(root / "pf")
        agg = scan(config())
        k = agg["kinds"]
        assert k.get("typed", 0) > 1000, k
        assert k.get("brief", 0) > 0 and k.get("command", 0) > 0, k
        blob = json.dumps(agg)
        for secret in ("add a retry to the upload job", "why is the login page slow", "worker-two"):
            assert secret not in blob, secret
        assert agg["areas"][:1] and len(agg["weeks"]) == WEEKS
        out = report(agg, "prompt-focus selftest", root / "r.html")
        page = out.read_text(encoding="utf-8")
        assert "add a retry" not in page and "<script" in page
        print(
            f"selftest ok: {k.get('typed', 0)} typed, {k.get('brief', 0)} briefs, {k.get('command', 0)} commands"
        )


# ── daily ─────────────────────────────────────────────────────────────────────


def _is_row(r):
    """A complete daily row: a date and the counts written with it."""
    return (
        isinstance(r, dict)
        and isinstance(r.get("date"), str)
        and isinstance(r.get("prompts"), int)
        and not isinstance(r.get("prompts"), bool)
    )


def _daily_rows(path):
    """(lines, date -> (line index, row)) for every complete row. Bad lines,
    including a cut-off last line, are kept but never count as a written day."""
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines() if path.exists() else []
    rows = {}
    for i, x in enumerate(lines):
        try:
            r = json.loads(x)
        except ValueError:
            continue
        if _is_row(r):
            rows[r["date"]] = (i, r)
    return lines, rows


def _write_lines(path, lines):
    """Replace the file in one step, so a crash never leaves half a row and a
    cut-off fragment never swallows the next row."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".daily-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    Path(tmp).replace(path)


def daily(agg, path, args, force):
    """Write one finished day. Today or later is partial: refused unless --force,
    and a partial row is rewritten on the next run instead of frozen. A day
    before the scan window is refused: its count would be a false zero."""
    if args:
        day = args[0]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            print(f"bad date {day!r}: use YYYY-MM-DD", file=sys.stderr)
            return 2
        try:
            dt.date.fromisoformat(day)
        except ValueError:
            print(f"bad date {day!r}: not a calendar date", file=sys.stderr)
            return 2
    else:
        day = (today() - dt.timedelta(days=1)).isoformat()
    if day < agg["window"]["start"]:
        print(f"refuse {day}: before the scan window ({agg['window']['start']})", file=sys.stderr)
        return 2
    partial = dt.date.fromisoformat(day) >= today()
    if partial and not force:
        print(f"refuse {day}: the day is not over; pass --force to write a partial row", file=sys.stderr)
        return 2
    lines, rows = _daily_rows(path)
    if day in rows and not rows[day][1].get("partial"):
        print(f"skip {day}: already written")
        return 0
    row = {"date": day, **agg["days"].get(day, {"prompts": 0})}
    if partial:
        row["partial"] = True
    verb = "rewrote" if day in rows else "appended"
    if day in rows:
        lines[rows[day][0]] = json.dumps(row)
    else:
        lines.append(json.dumps(row))
    _write_lines(path, lines)
    print(f"{verb} {day}: {row['prompts']} prompts{' (partial)' if partial else ''}")
    return 0


# ── main ──────────────────────────────────────────────────────────────────────


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "scan"
    out = workdir()
    if cmd == "selftest":
        return selftest()
    if cmd == "demo":
        root = Path(tempfile.mkdtemp(prefix="prompt-focus-demo-"))
        fake_home(root)
        os.environ["HOME"] = str(root)
        agg = scan(DEFAULTS)
        dest = Path(argv[2]) if len(argv) > 2 else out / "demo.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(report(agg, "prompt-focus demo (synthetic data)", dest))
        return 0
    out.mkdir(parents=True, exist_ok=True)
    agg = scan(config())
    (out / "agg.json").write_text(json.dumps(agg, indent=1), encoding="utf-8")
    if cmd == "scan":
        t = agg["total"]
        print(
            f"{t['prompts']} prompts, {t['words']} words, window {agg['window']['start']} to {agg['window']['end']}"
        )
        print("areas", {a: t["areas"][a] for a in agg["areas"]})
        print("kinds", agg["kinds"])
        skipped = sum(agg["skipped_lines"].values())
        if skipped:
            print(f"skipped {skipped} malformed history lines", agg["skipped_lines"])
        return 0
    if cmd == "daily":
        return daily(agg, out / "daily.jsonl", [a for a in argv[2:] if a != "--force"], "--force" in argv[2:])
    if cmd == "report":
        print(report(agg, "Where your focus went", out / "report.html"))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv) or 0)

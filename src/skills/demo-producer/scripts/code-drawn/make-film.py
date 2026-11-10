#!/usr/bin/env python3
"""Cut the drawing code out of an approved storyboard page into a render page.

The storyboard page draws every frame with drawFrame(g, t), a pure function of t,
on a W x H canvas, and keeps its page wiring (player, cards, buttons) after a
marker comment. This script copies everything in the page's first <script>
before the marker, unchanged, into film.html beside it, with one canvas at
SCALE times the size and window.renderAt(t). The film cannot drift from the
approved page, because it runs the approved page's own code.

Usage:
  make-film.py <storyboard.html> [--marker "// ---- page wiring ----"]
               [--width 1080] [--height 1920] [--scale 2]
Writes film.html next to the storyboard and prints the sha256 of the drawing code.
"""

import argparse
import hashlib
import pathlib
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument("storyboard")
ap.add_argument("--marker", default="// ---- page wiring ----")
ap.add_argument("--width", type=int, default=1080)
ap.add_argument("--height", type=int, default=1920)
ap.add_argument("--scale", type=int, default=2)
a = ap.parse_args()

src = pathlib.Path(a.storyboard)
page = src.read_text()
if "<script>" not in page or a.marker not in page:
    sys.exit(f"REFUSE: {src} needs an inline <script> and the marker {a.marker!r}")
start = page.index("<script>") + len("<script>")
end = page.index(a.marker)
draw = page[start:end]
if "function drawFrame" not in draw:
    sys.exit("REFUSE: no drawFrame(g, t) before the marker")
fonts = "".join(re.findall(r"@font-face\s*\{[^}]*\}", page))
w, h = a.width * a.scale, a.height * a.scale
film = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>film render</title>
<style>{fonts}html,body{{margin:0;background:#000}}canvas{{display:block}}</style></head>
<body><canvas id="c" width="{w}" height="{h}"></canvas>
<script>
// every image the drawing code creates is recorded, so ready can wait for it
// (a top-level const is not a window property, so it cannot be found later)
const filmImages = []; const FilmImage = window.Image;
window.Image = function (...args) {{ const i = new FilmImage(...args); filmImages.push(i); return i; }};
</script>
<script>
{draw}
// render surface, added by make-film.py
const filmCanvas = document.getElementById('c'), filmCtx = filmCanvas.getContext('2d');
window.renderAt = t => {{ filmCtx.setTransform({a.scale}, 0, 0, {a.scale}, 0, 0); drawFrame(filmCtx, t); return true; }};
// canvas text does not request a font until it is drawn, so load every face up front
window.ready = Promise.all([...document.fonts].map(f => f.load()))
  .then(() => Promise.all(filmImages.map(i => i.complete ? 0 : new Promise(r => {{ i.onload = i.onerror = r; }}))))
  .then(() => `ready: ${{document.fonts.size}} fonts, ${{filmImages.length}} images`);
</script></body></html>
"""
out = src.with_name("film.html")
out.write_text(film)
print(
    f"{out} written; drawing code sha256 {hashlib.sha256(draw.encode()).hexdigest()[:16]}, {len(draw)} chars"
)

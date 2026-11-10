#!/usr/bin/env python3
"""Compare approved storyboard stills with frames decoded from the rendered film.

approved/<t>.png and rendered/<t>.png share a name per moment (the time in seconds).
Both are resized to 540x960 and blurred 2 px before measuring: a page screenshot and
a film frame are rasterised at different scales, so letter edges land on different
pixels; the blur removes that noise and keeps any moved, missing or recoloured shape.

A pair matches when the mean difference is under --mean (default 4 of 255) and under
--off percent (default 1) of pixels differ by more than 48.

The control pairs each approved still with the rendered frame of the NEXT moment.
Those must NOT match; if any control matches, the measure cannot see change and the
run fails, whatever the true pairs say. A storyboard that holds still between two
sampled moments also trips the control (reported as BLIND): sample moments where
something changes, or move one of the two.

Every .png in the approved folder must be named by its time in seconds (12.5.png);
any other name is refused by name before anything is measured.

Usage: compare.py <approved-dir> <rendered-dir> [--json out.json] [--mean 4] [--off 1] [--min-pairs 6]
Exit 0: every true pair matches and every control differs. Exit 1 otherwise.
Needs Pillow (pip install pillow). Pixels are read with get_flattened_data where Pillow
has it (12.2 does) and with getdata otherwise; Pillow 12 deprecates getdata for removal in 14.
"""

import argparse
import itertools
import json
import math
import pathlib
import sys

from PIL import Image, ImageChops, ImageFilter, ImageStat

ap = argparse.ArgumentParser()
ap.add_argument("approved")
ap.add_argument("rendered")
ap.add_argument("--json")
ap.add_argument("--mean", type=float, default=4.0)
ap.add_argument("--off", type=float, default=1.0)
ap.add_argument("--min-pairs", type=int, default=6)
a = ap.parse_args()


def load(p):
    return (
        Image.open(p)
        .convert("RGB")
        .resize((540, 960), Image.LANCZOS)
        .filter(ImageFilter.GaussianBlur(2))
    )


def measure(pa, pr):
    d = ImageChops.difference(load(pa), load(pr))
    mean = sum(ImageStat.Stat(d).mean) / 3
    gray = d.convert("L")
    pixels = gray.get_flattened_data() if hasattr(gray, "get_flattened_data") else gray.getdata()
    off = sum(1 for px in pixels if px > 48) / (540 * 960) * 100
    return round(mean, 2), round(off, 2)


def is_time(name):
    # float() also parses "nan" and "inf", which are not times: require a finite number
    try:
        return math.isfinite(float(name[:-4]))
    except ValueError:
        return False


A, R = pathlib.Path(a.approved), pathlib.Path(a.rendered)
bad_names = sorted(p.name for p in A.glob("*.png") if not is_time(p.name))
if bad_names:
    sys.exit(
        f"REFUSE: approved stills must be named by time in seconds (12.5.png); got {bad_names}"
    )
names = sorted(
    (p.name for p in A.glob("*.png") if (R / p.name).exists()), key=lambda n: float(n[:-4])
)
if len(names) < a.min_pairs:
    sys.exit(f"FAIL: only {len(names)} pairs found, need at least {a.min_pairs}")
pairs, controls = [], []
for n in names:
    m, off = measure(A / n, R / n)
    pairs.append({"t": float(n[:-4]), "mean": m, "off": off, "match": m < a.mean and off < a.off})
for n, nxt in itertools.pairwise(names):
    m, off = measure(A / n, R / nxt)
    controls.append(
        {
            "approved": float(n[:-4]),
            "rendered": float(nxt[:-4]),
            "mean": m,
            "off": off,
            "differs": not (m < a.mean and off < a.off),
        }
    )
ok = all(p["match"] for p in pairs) and all(c["differs"] for c in controls)
for p in pairs:
    print(
        f"{'match ' if p['match'] else 'DIFFER'} {p['t']:6.1f} s  mean {p['mean']:5}  off {p['off']:5} %"
    )
blind = [c for c in controls if not c["differs"]]
print(
    f"control: {len(controls) - len(blind)} of {len(controls)} mismatched pairs caught"
    + (f"; BLIND on {[(c['approved'], c['rendered']) for c in blind]}" if blind else "")
)
print("PASS" if ok else "FAIL")
if a.json:
    pathlib.Path(a.json).write_text(
        json.dumps({"ok": ok, "pairs": pairs, "controls": controls}, indent=1)
    )
sys.exit(0 if ok else 1)

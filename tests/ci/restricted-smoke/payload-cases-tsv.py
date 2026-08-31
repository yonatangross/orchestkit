#!/usr/bin/env python3
"""Flatten the trip-case map to one delimited row per case for the probe.

Column order matches the probe's read: rule, mode, kind, target, command,
setup_sh, effect_sh, reason.

The delimiter is US (0x1f), NOT a tab. bash treats space, tab and newline as
IFS *whitespace*, so `IFS=$'\t' read` collapses a run of tabs into one
delimiter and an EMPTY column silently disappears, shifting every later field
one to the left. Measured 2026-08-31: every bash case has an empty `target`,
so `command` arrived holding the setup, `effect_sh` arrived empty, and
`eval ""` returns 0, which scored the trip arm as "the command ran" and
reported two shipped rules as REGRESSED when both in fact deny. US is not IFS
whitespace, so empty columns survive.
"""
import json
import sys

SEP = "\x1f"
COLS = ("rule", "mode", "kind", "target", "command", "setup_sh", "effect_sh", "reason", "twin")

doc = json.load(open(sys.argv[1]))
for c in doc["cases"]:
    row = []
    for k in COLS:
        v = str(c.get(k, ""))
        if SEP in v or "\n" in v:
            sys.exit(f"COULD-NOT-OBSERVE: field {k} of {c['rule']} contains the delimiter or a newline")
        row.append(v)
    print(SEP.join(row))

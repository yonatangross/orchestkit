#!/usr/bin/env python3
"""PR runs carry only what a PR needs (GICU-style CI diet, 2026-11-09).

1. Quality Report (ci-report.yml, job generate-report) is not a required check.
   On pull_request it runs only when its coverage inputs change (src/hooks, the
   report generator, the workflow itself). It still runs on every push to main
   and dev, in merge queues, nightly and on dispatch.
2. Unit Tests runs node 22 only on pull_request. "Unit Tests (node 22)" is a
   required check, so node 22 stays on every event. Node 20 keeps running on
   push, merge_group, schedule and dispatch.

Parses the YAML, so a duplicate or misplaced key fails here.
Usage: check-ci-pr-scope.py <repo root>. Exit 0 clean, 1 on any failed check.
"""

import sys
from pathlib import Path

import yaml

root = Path(sys.argv[1])
fails: list[str] = []
passes = 0


def check(cond: bool, msg: str) -> None:
    global passes
    if cond:
        passes += 1
        print(f"  ✓ {msg}")
    else:
        fails.append(msg)
        print(f"✗ {msg}")


def load(name: str) -> dict[object, object]:
    data = yaml.safe_load((root / ".github/workflows" / name).read_text())
    if not isinstance(data, dict):
        raise SystemExit(f"✗ {name} is not a YAML mapping")
    return data


def triggers(wf: dict[object, object]) -> dict[str, object]:
    # PyYAML reads the bare key `on` as True.
    on = wf.get("on", wf.get(True))
    if not isinstance(on, dict):
        raise SystemExit("✗ workflow has no `on` mapping")
    return on


def mapping(v: object) -> dict[str, object]:
    return v if isinstance(v, dict) else {}


# 1. Quality Report
rep = load("ci-report.yml")
on = triggers(rep)
pr = mapping(on.get("pull_request"))
paths = pr.get("paths") or []
assert isinstance(paths, list)
check("src/hooks/**" in paths, "ci-report pull_request runs when src/hooks changes")
check(
    "scripts/generate-ci-report.ts" in paths,
    "ci-report pull_request runs when the report generator changes",
)
check(
    ".github/workflows/ci-report.yml" in paths,
    "ci-report pull_request runs when its own workflow changes",
)
check("paths-ignore" not in pr, "ci-report uses an allow list, not paths-ignore")
push = mapping(on.get("push"))
branches = push.get("branches") or []
assert isinstance(branches, list)
check(
    "paths" not in push and set(branches) == {"main", "dev"},
    "ci-report push to main and dev is unfiltered",
)
check("merge_group" in on, "ci-report still runs in merge queues")
check("workflow_dispatch" in on, "ci-report can still be dispatched")
sched = on.get("schedule") or []
assert isinstance(sched, list)
crons = [mapping(s).get("cron") for s in sched]
check(len(crons) == 1 and bool(crons[0]), "ci-report runs nightly")
check("generate-report" in mapping(rep.get("jobs")), "job id generate-report unchanged")

# 2. Unit Tests matrix
ci = load("ci.yml")
ut = mapping(mapping(ci.get("jobs")).get("unit-tests"))
check(
    ut.get("name") == "Unit Tests (node ${{ matrix.node-version }})",
    "unit-tests name pattern unchanged",
)
expr = str(mapping(mapping(ut.get("strategy")).get("matrix")).get("node-version"))
check(
    "github.event_name == 'pull_request' && fromJSON('[\"22\"]')" in expr,
    "unit-tests runs node 22 only on pull_request",
)
check(
    '|| fromJSON(\'["20", "22"]\')' in expr, "unit-tests runs node 20 and 22 on every other event"
)

print(f"\n{passes} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""LLM-accuracy leg for /ork:auto routing (phase 1; complements route-check.mjs).

route-check.mjs grades a deterministic regex MIRROR of routing-rules.md - a $0
PR ratchet that can sit at 100% while a real model misroutes. This script
grades what a model actually does with the rule text: it prompts a model
(``claude -p``, sonnet) with routing-rules.md + each benchmark goal and scores
the predicted category against the committed labels.

First measured run (2026-07-02, sonnet): 78% before the routing-rules
disambiguation tune, 96% after (50-case benchmark, target 0.95). The two
persistent misses are fallback-discipline cases ("review my code",
"test the new feature") where the forced-choice prompt biases the model away
from asking - live sessions can ask, so treat those as a lower bound.

Usage:
  python3 scripts/eval/route-llm-eval.py                     # full run
  python3 scripts/eval/route-llm-eval.py --only fix-01,amb-03
  python3 scripts/eval/route-llm-eval.py --rules <path> --out <path>

Requires the ``claude`` CLI on PATH; a full run is ~50 short sonnet calls on
the operator's plan. Deliberately NOT wired into CI - run it when the rules,
the benchmark, or the routing prompt change, and compare against the numbers
above.
"""

import concurrent.futures
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _arg(flag: str, default: str) -> str:
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


BENCH = json.loads((ROOT / "src/skills/auto/routing-benchmark.json").read_text())
RULES = Path(_arg("--rules", str(ROOT / "src/skills/auto/references/routing-rules.md"))).read_text()
OUT = _arg("--out", "route-llm-results.jsonl")

CATS = [
    "build",
    "cover",
    "design",
    "diagnose",
    "fallback",
    "fix",
    "improve-skill",
    "optimize",
    "review",
    "verify",
]

PROMPT = """You are the intent classifier for OrchestKit's /ork:auto router.
Classify the user's GOAL into exactly one category:

build, cover, design, diagnose, fix, improve-skill, optimize, review, verify, fallback

Category semantics and disambiguation rules (authoritative):

<rules>
{rules}
</rules>

"fallback" means the goal is truly ambiguous per rule 7 - you would have to ask one clarifying question before routing.

GOAL: {goal}

Reply with ONLY the category token in lowercase. No punctuation, no explanation, no tools."""


def classify(case: dict) -> dict:
    prompt = PROMPT.format(rules=RULES, goal=case["goal"])
    t0 = time.time()
    for attempt in range(4):  # retries: timeouts + transient auth/limit races
        try:
            r = subprocess.run(
                ["claude", "-p", prompt, "--model", "sonnet"],
                capture_output=True,
                text=True,
                timeout=240,
            )
            out = r.stdout.strip().lower()
            if "not logged in" in out or "session limit" in out:
                time.sleep(10 * (attempt + 1))
                continue
            if out in CATS:
                pred = out
            else:
                hits = [c for c in CATS if re.search(rf"\b{re.escape(c)}\b", out)]
                pred = hits[-1] if hits else f"PARSE_FAIL:{out[:80]}"
            return {**case, "predicted": pred, "secs": round(time.time() - t0, 1)}
        except subprocess.TimeoutExpired:
            continue
    return {**case, "predicted": "RETRIES_EXHAUSTED", "secs": round(time.time() - t0, 1)}


def main() -> None:
    cases = BENCH["cases"]
    only = _arg("--only", "")
    if only:
        wanted = set(only.split(","))
        cases = [c for c in cases if c["id"] in wanted]

    results = []
    with open(OUT, "w") as f, concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        for res in ex.map(classify, cases):
            results.append(res)
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            f.flush()
            print(
                f"[{len(results)}/{len(cases)}] {res['id']}: "
                f"expected={res['category']} predicted={res['predicted']} ({res['secs']}s)",
                flush=True,
            )

    ok = [r for r in results if r["predicted"] == r["category"]]
    print(
        f"\nOverall: {len(ok)}/{len(results)} = {len(ok) / len(results):.1%}"
        f"  (target {BENCH.get('target_accuracy')})"
    )
    per: dict[str, list[int]] = {}
    for r in results:
        per.setdefault(r["category"], [0, 0])
        per[r["category"]][1] += 1
        if r["predicted"] == r["category"]:
            per[r["category"]][0] += 1
    for cat in sorted(per):
        c, t = per[cat]
        print(f"  {cat:14s} {c}/{t}")
    misses = [r for r in results if r["predicted"] != r["category"]]
    if misses:
        print("\nMisses:")
        for m in misses:
            print(f"  [{m['id']}] expected={m['category']} predicted={m['predicted']}")
            print(f'        "{m["goal"]}"')


if __name__ == "__main__":
    main()

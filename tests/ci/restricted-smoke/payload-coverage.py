#!/usr/bin/env python3
"""Assert the trip-case map covers the shipped payload exactly, both directions.

A rule with no case would ship untested, which is how the plugin's own
settings.json carried 26 rules that never enforced anything. A case with no rule
is a fixture kept alive after its rule was dropped, which reads as coverage and
is not. Exit 1 on either, so the probe stops before it reports a partial sweep
as a full one.
"""
import json
import sys

payload_path, cases_path = sys.argv[1], sys.argv[2]
rules = json.load(open(payload_path))["deny"]
doc = json.load(open(cases_path))
cases = doc["cases"]

rule_set = set(rules)
case_rules = [c["rule"] for c in cases]
case_set = set(case_rules)

problems = []
for r in sorted(rule_set - case_set):
    problems.append(f"  rule with no trip case (would ship untested): {r}")
for r in sorted(case_set - rule_set):
    problems.append(f"  trip case for a rule no longer in the payload: {r}")
dupes = sorted({r for r in case_rules if case_rules.count(r) > 1})
for r in dupes:
    problems.append(f"  duplicate trip case: {r}")

live = [c for c in cases if c["mode"] == "live"]
twin = [c for c in cases if c["mode"] == "twin"]
notlive = [c for c in cases if c["mode"] == "not-live"]
for c in twin:
    if not c.get("twin"):
        problems.append(f"  twin case with no twin rule named: {c['rule']}")
    elif c["twin"] not in rule_set:
        problems.append(
            f"  twin case points at a rule the payload does not ship: {c['rule']} -> {c['twin']}")
    if not c.get("reason"):
        problems.append(f"  twin case with no stated reason: {c['rule']}")
for c in notlive:
    if not c.get("reason"):
        problems.append(f"  not-live case with no stated reason: {c['rule']}")
for c in live:
    if c["kind"] == "bash" and not (c.get("command") and c.get("effect_sh")):
        problems.append(f"  live bash case missing command or effect predicate: {c['rule']}")
    if c["kind"] in ("read", "write", "edit") and not c.get("target"):
        problems.append(f"  live file case missing target: {c['rule']}")

if problems:
    print("COULD-NOT-OBSERVE: payload and trip-case map disagree")
    print("\n".join(problems))
    sys.exit(1)

print(f"coverage: {len(rules)} rules, {len(live)} live, {len(twin)} twin, {len(notlive)} not-live, 0 drift")

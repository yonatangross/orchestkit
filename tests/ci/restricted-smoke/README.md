# --restricted smoke lane (#3774)

Runs the built plugin through a real `claude -p` process started with
`--restricted` (CC 2.1.248+), against a local stub of the Anthropic Messages
API. No model is called, no token is spent, no secret is needed: the stub
answers every `/v1/messages` with a canned "ok". What is real is everything
that matters for the plugin: CC's loader, `--plugin-dir`, the hooks runner and
every hook that fires for a one-turn session.

`run-restricted-smoke.sh` asserts four things:

1. the run completes with `result: ok` and `is_error: false`;
2. the request CC sent carries no `Bash` and no `WebFetch` tool, which proves
   the process really was restricted (a plain `-p` run sends both);
3. the plugin's hooks fired under `--restricted`: `hook-timing.jsonl` in the
   run's private HOME has entries;
4. the set of hooks that reported `ok: false` equals
   `expected-hook-failures.txt` (one hook name per line, sorted). The file is
   empty because the first enumeration on 2.1.251 found none; a hook that
   starts failing under `--restricted` turns the lane red, and a hook that is
   accepted as failing is added to the file with a reason, never silently.

The lane is wired into `plugin-validation.yml` and gated by its Validation
Summary job, which is a required check.

## probe-payload-rules.sh (#3849)

`probe-permission-deny.sh` proves the mechanism: one synthetic deny rule blocks
a Bash call under `--dangerously-skip-permissions` with no hooks loaded. That is
not the same claim as "the rules we ship work". After the #3835 purge deleted 16
blocking hooks, `src/skills/setup/references/operator-permissions.json` IS the
protection, so this probe executes a real trip case for every rule in it.

Per rule: a control arm with no deny rule, which must execute, and a trip arm
carrying that one rule, which must not. Single-rule trip arms, because the
shipped payload is their union and a whole-payload arm lets one rule mask
another. Verdicts are read from the EFFECT, never from denial text: `STUB_GREP`
scans the entire request including the injected CLAUDE.md, so a denial-text
grep hits on the word "permission" in an arm that was never denied.

`payload-trip-cases.json` carries one case per rule and
`payload-coverage.py` asserts the map and the payload match exactly in both
directions, so a rule added without a case fails the probe instead of shipping
untested. Four outcomes, none of which is a silent pass:

- **live** (27): really executed, and harmless even when the rule fails to hold.
- **twin** (10): the rule is measurably inert. No `Write()` spelling denies
  anything, so the trip arm carries the `Edit()` twin that actually blocks the
  Write. Protection proven; the spelling is not what delivers it.
- **refused by CC itself** (4): the control arm carried no rule and CC denied
  anyway. The rule is belt-and-braces, which is the strongest result a rule can
  get: we did not need it.
- **not-live** (12): running the trip case IS the harm the rule prevents.
  Reported as NOT PROVEN, never as a pass, with a named live case of the same
  matcher shape.

Exit 0 all proven, 1 REGRESSED (a shipped rule did not deny), 2
could-not-observe or payload/case-map drift.

First run found two: `Bash(find:*-delete*)` and `Bash(find:*-fprint*)` matched
nothing at all, measured identical to no rule. CC's colon form is a prefix
separator that only works as `cmd:*`; text after the star kills the match. Both
were copied verbatim from `src/settings/ork.settings.json`, which CC never
reads, so nothing had ever exercised their syntax.

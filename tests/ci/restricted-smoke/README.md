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

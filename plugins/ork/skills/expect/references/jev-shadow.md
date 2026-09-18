# Jev Shadow for /ork:expect

One logged-only Jev judgment per expect step. Shadow only: it never
changes what the expect-agent executes.

## Shape

Same pattern the browser-use/Jev integrations use, rebuilt on our own
stack (agent-browser ARIA refs, no third-party driver):

```
step goal + last verify + interactive elements
        |
        v
ONE Jev request (POST /v1/systemone)
  questions:
    next_action              Choice over the bounded legal-action set
    goal_reached             Noul   (loopback verify)
    page_changed_as_expected Noul   (loopback verify)
    blocked                  Noul   (dialog / login wall / captcha)
        |
        v
JEV_SHADOW|<step-id>|<json>  ->  report.sh  ->  run report (per step + totals)
```

The bounded action set is derived, not freeform: `click`/`fill`/`select`
per interactive element (role-dependent, keyed `verb:@eN` on the same
`@eN` refs agent-browser uses) plus the fixed meta moves `done`, `wait`,
`scroll`, `press_enter`. Jev cannot pick an action the stack cannot take.

## Gate

Runs only when `ORK_EXPECT_JEV_SHADOW` is truthy (`1|true|yes|on`).
Default off, and off means off: `scripts/jev-shadow.sh` exits before
python or the network are touched. The API key comes from
`ORK_TYPESAFE_API_KEY`; with no key the step logs `error: no_api_key`
and no request is made.

## What leaves while it is on (egress)

Per enabled step, exactly one HTTPS POST to the configured endpoint
carrying `state` = the step goal, the last verify result, and up to
`element_cap` interactive elements as `{ref, role, name}` triples. Only
the fields the four questions need leave; the only ids are the snapshot's
ephemeral `@eN` refs (positional, per-capture, not real identifiers, so
nothing is worth hashing). No page text beyond accessible names, no
cookies, no tokens: every outbound string passes a secret redactor
(`[redacted]`) and a length cap before the request is built. The guard
runs on the decoded form, so a secret smuggled raw (`token=<v>`) or
JSON-escaped (`token\u003d<v>`) is caught the same. Question text and
option descriptions are static strings built locally.

## Tunables

All in `.expect/config.yaml` under `jev_shadow:` (see
references/config-schema.md), falling back to the shipped
`jev-shadow.defaults.yaml`. The script refuses to run with no resolved
config; nothing is a code constant.

| Key | Meaning |
|-----|---------|
| `element_cap` | Max interactive elements per request (default 60) |
| `name_max_chars` | Per-name truncation after redaction |
| `context_max_chars` | Per-field truncation for goal / last verify |
| `latency_budget_ms` | Abort budget for the one request (default 400) |
| `model` | Pinned Jev model id |
| `endpoint` | POST target (`ORK_EXPECT_JEV_ENDPOINT` overrides, for mocks) |
| `thresholds.low_confidence` | Choice confidence below this flags the pick |
| `thresholds.{goal_reached,page_changed_as_expected,blocked}` | Noul at or above raises the flag |

## The record

```json
{
  "step_id": "login-2",
  "model_action": "click @e15",
  "model_action_key": "click:@e15",
  "jev_action": "click:@e15",
  "jev_action_probability": 0.81,
  "jev_confidence": 0.79,
  "probabilities": {"click:@e15": 0.81, "done": 0.05, "...": 0.0},
  "nouls": {"goal_reached": 0.12, "page_changed_as_expected": 0.9, "blocked": 0.03},
  "flags": {"low_confidence": false, "goal_reached": false,
            "page_changed_as_expected": true, "blocked": false},
  "agree": true,
  "latency_ms": 210,
  "latency_budget_ms": 400,
  "model": "jev-1.13.0",
  "error": null
}
```

`model_action_key` is the agent's pick normalized onto the candidate
keyspace: `click @e15` maps direct, `click "Sign in"` resolves the
accessible name to its ref. Actions outside the keyspace (`press Tab`,
`navigate`, `drag`) log their raw text with `agree: false`; they are
visible in the report but not comparable.

`report.sh` folds each record into the step's `jev_shadow` field and
adds a run-level `jev_shadow: {recorded, agreed, disagreed}` summary.
Failures (`http N`, `unreachable_or_timeout`, `malformed_answer`,
`no_api_key`, `no jev_shadow config`) land as error records with
`agree: null`. The script always exits 0: a dead shadow must never
fail a run.

## Invocation (expect-agent, per step)

After picking the action for a step and before executing it:

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/expect/scripts/jev-shadow.sh \
  --step-id login-2 \
  --goal "Submit the login form" \
  --last-verify "Fields filled with test credentials" \
  --model-action "click @e15" \
  --snapshot-file .expect/jev-snap.txt
```

`--snapshot-file` is the `agent-browser snapshot -i` output the agent
already captured (text or `--json` form; only ref/role/name are read).
`--config` or `ORK_EXPECT_CONFIG` points at an alternate config file;
`.expect/config.yaml` is used when present.

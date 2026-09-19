# Jev Step Judge for /ork:expect

One Jev judgment per expect step, in one of three modes selected by
`ORK_EXPECT_JEV`: unset or falsey is off (the script exits before python
or the network); `shadow` logs a second opinion beside the agent's pick
and never drives the browser; `1` or `act` lets the Jev pick drive the
step, failing closed to the agent's own pick on any error, timeout, empty
or malformed answer, or a confidence below `act_confidence_floor`. The
legacy `ORK_EXPECT_JEV_SHADOW` flag, truthy with `ORK_EXPECT_JEV` unset,
still selects `shadow`.

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

`ORK_EXPECT_JEV` selects the mode: `shadow` for log-only, `1`/`act` (or
any truthy word) to execute the Jev pick. Any other set value, or unset
with `ORK_EXPECT_JEV_SHADOW` unset or falsey, is off, and off means off:
`scripts/jev-shadow.sh` exits before python or the network are touched.
The API key comes from `ORK_TYPESAFE_API_KEY`; with no key the step logs
`error: no_api_key` and no request is made (in act mode the record falls
back to the agent's pick).

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
| `act_confidence_floor` | Act mode only: Choice confidence below this falls back to the agent's pick (default 0.5) |
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

`report.sh` folds each record into the step's `jev_shadow` field, adds a
run-level `jev_shadow: {recorded, agreed, disagreed, steps, picks_taken,
fallbacks, agree_rate}` summary to the JSON report, and prints one
`JEV_RUN|steps=N|picks=N|fallbacks=N|agree_rate=R` line at the end of the
run. Failures (`http N`, `unreachable_or_timeout`, `malformed_answer`,
`empty_answer`, `no_api_key`, `no jev_shadow config`) land as error
records with `agree: null`. The script always exits 0: a dead Jev lane
must never fail a run.

In act mode every record additionally carries `mode: "act"`, `path`, and
`executed_action`. `path` is `"jev"` when the Jev pick ran and
`"fallback:<reason>"` when the agent's own pick ran instead
(`fallback:low_confidence` still logs the full Jev answer; the floor
rejected it, not the network). `executed_action` is the canonical
candidate key (`verb:@eN` or a meta verb) the agent translates back to an
agent-browser command; on fallback it is the agent's normalized pick, or
its raw action text when the pick sits outside the keyspace.

Every record also carries the decision provenance fields: `jev_pick`,
`jev_confidence`, `incumbent_pick` (the agent's normalized pick),
`agree`, `floor` (the resolved `act_confidence_floor`), `decided_by`
(`"jev"` or `"incumbent"`), `prompt_id` (config `prompt_id`, override
with `--prompt-id`), and `session_id` (`--session-id`, else
`ORK_EXPECT_SESSION`, else `AB_SESSION`).

## Form path (`--task-doc`)

When `--task-doc` carries the step's task document, the request adds one
`field::<ref>` question per form element (up to `field_cap`): a value
Choice over candidates extracted from the document for textbox/searchbox/
spinbutton/combobox/listbox elements, and a final-state Choice
(check/uncheck/skip) for checkbox-family elements. The checkbox options
use final-state semantics (items listed under keep/do/build/add mean
check; items listed under drop/remove/skip/not-do mean uncheck; only a
field the document does not address at all is left as it is). Per-field
answers land in `field_decisions` keyed by
ref, each with `jev_pick`, `jev_confidence`, `floor`, `decided_by`, and
the resolved `value` or `target` when Jev decided. In act mode, when the
step's executed action targets a decided field, `executed_action` carries
the decision through: `fill:@eN="value"`, `check:@eN`, `uncheck:@eN`, or
`done` when Jev's target is skip. A field Jev answers below the floor
keeps `decided_by: "incumbent"` and the agent's own handling stands.

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

Deliberately NOT `snapshot --delta` (0.38+): the bounded legal-action set
needs the full list of interactive elements on every step, and a delta call
answers `unchanged` whenever the page has not moved, which would starve Jev
of candidates on exactly the steps where nothing visibly changed. Use
`snapshot -i` here even though `--delta` is the better choice for the
retry loop in `expect-agent.md`.

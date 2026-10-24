# ork Elicitation hooks: headless runs and MCP tasks

Lane L6, 2026-10-24. Claude Code 2.1.310 (from the run's debug log), ork 10.0.2 installed at user scope.
Evidence beside this file: `r1-partial/` and `r2/`. Run r1 was cut short by a floor load pause (load1
about 290), so it is **partial**: one headless run, three tool calls. Run r2 (load1 53, from inside the
L6 worktree) retried the in-task call with the tasks extension declared. No interactive run.

## Verdict

| Question | Answer | Basis |
|---|---|---|
| Do ork's `Elicitation` and `ElicitationResult` hooks run headless (`claude -p`)? | **Yes.** The brief expected "they do not run headless"; r1 refutes that | VERIFIED, r1 |
| What does headless CC answer when no hook decides? | `cancel`, without asking anyone | VERIFIED, r1 |
| Does the guard's block work headless? | Yes: CC logs `Elicitation resolved by hook: {"action":"decline"}` | VERIFIED, r1 |
| Does `ElicitationResult` fire after a hook resolved the form? | No: 3 elicitations, 2 `ElicitationResult` payloads, none for the blocked one | VERIFIED, r1 |
| Does `elicitation-result-logger` read the right fields? | **No.** It reads `server_name` and `user_response.action`; CC sends `mcp_server_name` and a top-level `action`. ork's own log says `Elicitation unknown` and `server: unknown` (#4884) | VERIFIED, r1 and r2 payloads, r2 `ork-hooks-log-lines.log` |
| What happens for an elicitation from INSIDE an MCP task? | Cannot happen from CC 2.1.310 today: it offers the tasks extension in `initialize` but sent no `task` parameter on the call even when the server declared the extension (r2). Behaviour for a real in-task elicitation stays unknown | VERIFIED that CC sends no `task` (r1, r2 server logs); the in-task hook behaviour is CLAIMED |
| 10.0.2 vs 10.1.0 hook entries | Same: `elicitation-guard` (timeout 5) and async `webhook-forwarder` on `Elicitation`; `elicitation-result-logger` and `webhook-forwarder` on `ElicitationResult` | VERIFIED for 10.1.0 (`src/hooks/hooks.json` at `b0fb57387`); the 10.0.2 entry was read from the installed cache by the probe agent and is CLAIMED until re-read |

## How r1 was run

`r1-partial/run.sh`: a dependency-free stdio MCP server (`r1-partial/server.mjs`) with three tools.
`ask_plain` sends a form elicitation for a `color` field during a normal call. `ask_secret` asks for
`api_key`, so ork's guard has something to block. `ask_in_task` declares `execution.taskSupport:
"optional"` and would run its elicitation inside a task if called with one.

```
claude -p --model haiku --no-session-persistence --mcp-config mcp.json --strict-mcp-config \
  --settings dump-settings.json \
  --allowedTools 'mcp__l6elicit__ask_plain,mcp__l6elicit__ask_secret,mcp__l6elicit__ask_in_task' \
  --debug-file debug-r1.log "<call each tool once>"
```

`dump-settings.json` adds two throwaway hooks that write each hook payload to a file, so the payload
CC actually sends is on disk (`payload-r1-*.json`). No user or project settings file was edited.

## What r1 shows

**Hooks run in print mode.** `debug-r1-elicitation-lines.log`:

```
MCP server "l6elicit": Elicitation request received in print mode: {"method":"elicitation/create",...
Elicitation:l6elicit [node ${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs lifecycle/webhook-forwarder] completed with status 0
Elicitation:l6elicit [node ${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs elicitation/elicitation-guard] cancelled
```

**No hook decision means cancel.** `server-r1.log`: the server sent `elicitation/create` for `color`
and CC answered `{"result":{"action":"cancel"}}` 24 s later, with no prompt anywhere. The guard was
`cancelled` on that call because it ran past its 5 s timeout at load1 above 160, so this answer is CC's
print-mode default, not ork's.

**The guard's block lands headless.** For `api_key` the guard finished in time:

```
Hooks: Parsed initial response: {"continue":false,"stopReason":"Blocked: MCP server \"l6elicit\" attempted to collect \"api_key\" ...
Elicitation:l6elicit [... elicitation/elicitation-guard] completed with status 0
MCP server "l6elicit": Elicitation resolved by hook: {"action":"decline"}
```

and the server received `{"result":{"action":"decline"}}`.

**`ElicitationResult` payload shape.** `payload-r1-ElicitationResult-17165.json`:

```json
{"hook_event_name":"ElicitationResult","mcp_server_name":"l6elicit","mode":"form","action":"cancel", ...}
```

`src/hooks/src/elicitation/elicitation-result-logger.ts` reads `input.user_response?.action` and
`input.server_name`, so every line it logs reads `Elicitation unknown, server: unknown`. Same root cause
as the guard's #1264 and #3335 fixes, which moved the guard to `mcp_server_name` and `requested_schema`
but never touched the logger. Filed as #4884; fixed in its own PR, not this one.

**Timeouts under load.** Both ork hooks were `cancelled` once each in r1 (guard at 5 s, logger at 5 s;
CC's own settle lines say 5.9 s and 6.7 s). A cancelled guard lets the form through. At normal load
the guard took 3.4 s on the second call. This is a fail-open window, and the CC 2.1.295 `onFailure:
"block"` key is the documented way to close it once the floor allows.

## Run r2: the tasks extension declared, and normal load

`r2/run.sh`, same harness, only `ask_in_task` allowed. `r2/server.mjs` declares tasks both ways: the
2025-11-25 `capabilities.tasks` and `extensions["io.modelcontextprotocol/tasks"]`.

`r2/server-r2.log`: CC 2.1.310 negotiated, listed the tools, then called

```
{"method":"tools/call","params":{"name":"ask_in_task","arguments":{},"_meta":{"claudecode/toolUseId":"...","progressToken":2}},...}
```

with no `task` field, so the server ran it as a plain call and the elicitation came from a normal
request. CC answered `{"action":"cancel"}` in 0.4 s. At load1 53 both ork hooks completed
(`r2/debug-r2-elicitation-lines.log`: guard settled in 258 ms, logger in 181 ms). ork's own log for the
same second (`r2/ork-hooks-log-lines.log`):

```
[elicitation-guard] Allowed elicitation from l6elicit
[elicitation-result-logger] Elicitation unknown (dash) server: unknown   <- verbatim line in r2/ork-hooks-log-lines.log
[desktop] Notification: [elicitation_response] Elicitation response for server "l6elicit": cancel
```

The guard names the server and the desktop notifier names the action, while the result logger knows
neither: #4884, reproduced.

## Not reproduced (CLAIMED)

- **Elicitation inside an MCP task.** In r1 and r2, CC 2.1.310 offered the tasks extension and then
  called a task-capable tool without `task`, so no in-task elicitation could be produced from the
  client side in print mode. Whether CC sends `task` in an interactive session, or for some other
  tool shape, was not tested. If it does, the elicitation would carry the related-task `_meta`. The
  hook payload would most likely carry the same `mcp_server_name` and `requested_schema`, so the guard
  would match it, but that is a guess.
- **Interactive sessions.** No interactive run: this seat has no pty. The interactive behaviour (a
  form shown to a person, `accept` possible) is CLAIMED from the hook docs and the guard's comments.

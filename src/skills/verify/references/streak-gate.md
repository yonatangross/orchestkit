# Streak Gate — consecutive-pass verification

A single green is not proof. Flaky suites, race conditions, and order-dependent tests pass once and fail the next run. The streak gate makes `/ork:verify` declare a feature done **only after N consecutive passing runs**, resetting the count to zero on any failure. It is the flakiness defense that single-shot pass/fail can't give.

> Loop-Library theme: **Quality Streak** ("fixes product failures until a defined streak of realistic tests passes"). This is the native ork mechanism the `prd-to-goal` quality-streak recipe leans on.

## Invocation

```bash
/ork:verify --streak=3 authentication flow     # need 3 greens in a row
/ork:verify --streak=3                          # continues an existing streak for the same scope
```

`--streak=N` (N ≥ 2). When absent, verify behaves exactly as before (single pass/fail). The target may also come from the verify rubric's `streak_target` slot (`src/skills/verify/rubric.json`, an integer ≥ 2 validated by `src/skills/shared/rubric.schema.json` — a configured value is schema-checked, not silently ignored); the explicit flag always wins.

Parse it alongside the other flags in Argument Resolution:

```python
STREAK_TARGET = None
for token in "$ARGUMENTS".split():
    if token.startswith("--streak="):
        STREAK_TARGET = int(token.split("=", 1)[1])   # explicit override
        SCOPE = SCOPE.replace(token, "").strip()
STREAK_TARGET = STREAK_TARGET or rubric.get("streak_target")  # validated slot; may stay None
```

## Ledger

The streak persists across independent verify runs in `.claude/chain/verify-streak.json` so each invocation extends (or breaks) the run before it:

```json
{
  "schema": "verify-streak/1.0",
  "scope": "authentication flow",
  "target": 3,
  "current": 2,
  "met": false,
  "reset_count": 1,
  "last_run_ts": "2026-06-20T10:31Z",
  "history": [
    { "ts": "2026-06-20T10:01Z", "verdict": "fail", "composite": 5.4, "blocker": "security 3.2" },
    { "ts": "2026-06-20T10:14Z", "verdict": "pass", "composite": 7.8 },
    { "ts": "2026-06-20T10:31Z", "verdict": "pass", "composite": 8.1 }
  ]
}
```

`scope` keys the streak — switching scope starts a fresh streak. `current` is the live consecutive-pass count; `met` is `current >= target`. `last_run_ts` is the timestamp of the run that last wrote the ledger — the freshness stamp a `/goal` loop checks so it never trusts a `met:true` it didn't just produce (see Stale-ledger guard).

**Scope keying is normalized.** The raw scope string is trimmed and its internal whitespace collapsed before it keys the streak, so `"auth flow"` and `"auth  flow"` (or a trailing space) extend the *same* streak instead of silently starting fresh ones:

```python
def streak_key(scope: str) -> str:
    return " ".join(scope.split())   # trim + collapse runs of whitespace
```

## Run protocol

Each `/ork:verify --streak=N` invocation:

```python
key = streak_key(SCOPE)                     # normalized: trim + collapse whitespace
ledger = read(".claude/chain/verify-streak.json") or new_ledger(key, N)
if ledger.scope != key or ledger.target != N:
    ledger = new_ledger(key, N)            # scope/target change → fresh streak

verdict = run_full_verification()          # the normal 8-phase verify, UNCHANGED

if verdict == "READY FOR MERGE":
    ledger.current += 1                    # extend the streak
else:
    if ledger.current > 0: ledger.reset_count += 1
    ledger.current = 0                     # ANY non-ready verdict breaks it
ledger.history.append({ts, verdict, composite, blocker?})
ledger.met = ledger.current >= ledger.target
ledger.last_run_ts = now_iso()             # stamp THIS run — the freshness proof
write_atomic(".claude/chain/verify-streak.json", ledger)   # tmp + rename, never in-place
```

**Atomic write (concurrency safety).** The ledger *is* the counter, so a torn or last-writer-wins write corrupts the whole feature. Two verify runs on the same scope (e.g. parallel worktrees) must not race: write to `verify-streak.json.tmp.<pid>` then `rename()` over the target (an atomic filesystem op on POSIX). Never mutate the file in place. If two runs still interleave, rename-last-wins loses at most one increment — it never leaves a half-written ledger.

**Reset rule:** a streak breaks on *any* non-`READY FOR MERGE` verdict — a tripped dimension blocker, a failing test, or an IMPROVEMENTS-RECOMMENDED. One red zeroes the count. There is no partial credit.

**Independence rule (the whole point):** each run must re-execute the *actual* tests — no cached results, no "already passed last turn." A streak over cached runs proves nothing. If the suite is fast, run it fresh each turn; if it is slow, that cost is the price of trusting the green.

## Verdict mapping

The streak gate sits *above* the normal verdict — it never loosens a blocker, it only withholds "done" until the streak is met:

| Streak state | Reported verdict |
|---|---|
| this run not READY (blocker/fail) | the normal verdict (BLOCKED / IMPROVEMENTS RECOMMENDED) + `streak reset to 0/N` |
| READY but `current < target` | **STREAK PROGRESS — `current`/`target`** (not done; run again) |
| READY and `current >= target` | **READY FOR MERGE** (streak `target`/`target` met) |

Always surface the count: `STREAK 2/3 — one more green to merge` or `streak reset to 0/3 (security 3.2 < 4.0)`. The user must see how close (or how broken) the streak is.

## Wiring into `/goal`

The streak gate is what makes the quality-streak recipe converge. The `until`-clause reads the ledger; each loop turn runs verify:

```
# Stamp the loop start; honor met only for a ledger written AFTER it.
LOOP_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
/goal until jq -e --arg t "$LOOP_START" '.met==true and .last_run_ts >= $t' .claude/chain/verify-streak.json
/goal abort-if turns > 15 OR tokens > 150000 OR no_progress_for_4_turns
```

`no_progress_for_4_turns` is deliberately generous: a streak that keeps resetting *is* progress information (it's surfacing real flakiness), so give it room before aborting.

**Stale-ledger guard (the first-run race).** `/goal` evaluates the `until`-clause at the *top* of each turn — before that turn's verify runs. If a previous completed streak for the same scope left `met:true` in the ledger, a bare `.met==true` check exits on turn 1 having run **zero** fresh verifications. Defense (robust form): the `until`-clause compares `last_run_ts` against the loop-start timestamp, so `met:true` is honored **only when the ledger was written this loop** — you never trust a `met` you didn't just produce. This needs no `rm` and is safe even if a stale ledger exists (the old `rm -f` reset still works as a simpler fallback, but the timestamp guard is preferred because it also survives a mid-loop scope reuse). ISO-8601 UTC timestamps compare correctly as strings.

## Reuse in `/ork:cover`

`cover` already auto-heals up to 3 iterations. The same ledger + reset protocol applies: after generating tests, require the suite to pass N times consecutively before declaring coverage done — this catches flaky *generated* tests before they land. Same `verify-streak/1.0` ledger, keyed by the cover scope. (Cover wiring is a follow-up; the protocol here is the shared contract.)

## Anti-patterns

| Bad | Why it fails | Good |
|---|---|---|
| Count cached "passes" toward the streak | Proves the cache is green, not the code | Re-run the real suite each turn |
| Let an IMPROVEMENTS-RECOMMENDED extend the streak | Streak then means "good enough once", not "green N times" | Only `READY FOR MERGE` extends; everything else resets |
| Streak target of 1 | Identical to single-shot verify — no flakiness defense | N ≥ 2 (3 is the sensible default) |
| Raise the streak target to force a pass | Gaming in reverse — moving the goalposts | Target is set once, up front, from intent/policy |

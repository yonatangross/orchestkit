# CodeRabbit CLI pre-review: find defects before the PR spends its review allowance

Phase 3c of create-pr. Runs the CodeRabbit CLI against the branch diff before
`gh pr create`. Advisory only: every failure path prints one line and continues.

## Why the PR review allowance is the scarce resource

CodeRabbit PR reviews on the Essentials plan are rate limited per GitHub identity,
with an adaptive refill that shrinks as usage grows: 0 to 29 reviews in the trailing
7 days refills 5 reviews per hour, stepping down to 1 per hour at 60 or more
(docs.coderabbit.ai/management/rate-limits). The limit follows the identity, not the
repo, so every repo the operator pushes to draws from the same bucket.

Measured 2026-09-14: the operator's identity sat at the 1 per hour floor, and 85% of
PR review events in the prior 30 days were rate limited. Every push to an open PR is
a new review event, so a PR that needs three fix pushes spends three, and a
rate-limited review never arrives, which the harvest phase then reads as a clean zero.

The CLI draws on a separate allowance. Reviewing the branch locally before the PR
exists finds defects while fixing them is free, so the PR opens cleaner and needs
fewer follow-up pushes.

## The command

Flags verified against CodeRabbit CLI 0.7.6 (`coderabbit review --help`,
2026-09-14). The binary installs as `coderabbit`; `cr` is a common symlink.

```bash
# `cr` is also the name of unrelated tools (helm chart-releaser, for one), so
# accept it only when its help text identifies CodeRabbit.
CR_BIN=""
if command -v coderabbit >/dev/null 2>&1; then
  CR_BIN=coderabbit
elif command -v cr >/dev/null 2>&1 && grep -q CodeRabbit <<<"$(cr --help 2>&1)"; then
  CR_BIN=cr
fi

# mktemp, never a fixed name: a predictable path in a shared /tmp can be
# pre-created or symlinked by another local user.
CR_OUT=$(mktemp "${TMPDIR:-/tmp}/cr-prereview.XXXXXX")
if [ -z "$CR_BIN" ]; then
  echo "CodeRabbit CLI pre-review skipped: CLI not on PATH"
elif perl -e 'alarm shift; exec @ARGV' 600 \
       "$CR_BIN" review --agent --base "origin/$BASE" </dev/null >"$CR_OUT" 2>&1; then
  echo "CodeRabbit CLI pre-review finished: $CR_OUT"
else
  echo "CodeRabbit CLI pre-review skipped: exit $? (142 means the 10 minute alarm fired), see $CR_OUT"
fi
```

| Flag | Why |
|---|---|
| `--agent` | Structured findings meant for an agent to read, instead of the plain-text default |
| `--base "origin/$BASE"` | Compare the branch against the remote base; a worktree's local base branch is often stale or absent |
| `</dev/null` | A signed-out CLI cannot sit on an interactive prompt |

Never pass `--use-credits`: it bills usage credits once a review exceeds the included
limit, which turns an advisory step into spend.

### Why `perl` and not `timeout`

macOS ships no `timeout` binary (`gtimeout` exists only with coreutils installed).
`perl` is present on macOS and on mainstream Linux images. `alarm` survives `exec`,
so the CLI process itself receives SIGALRM and exits 142 (128 + 14). Only the exec'd
process is signalled; a helper the CLI spawned can outlive it.

## How it degrades

| Condition | What happens |
|---|---|
| Neither `coderabbit` nor a CodeRabbit `cr` on PATH | One-line skip note, continue to Phase 4 |
| Not signed in | Non-zero exit or the alarm fires; one-line note, continue |
| Review runs past 10 minutes | Alarm fires, exit 142; one-line note, continue |
| Sandboxed shell blocks the CLI's storage or websocket (`coderabbit doctor` reports it) | Non-zero exit; one-line note, continue |

The signed-out exit code was not measured. The alarm bounds that case either way.

## Acting on findings

1. Read `$CR_OUT`. Treat every finding as a claim, not a verdict.
2. Fix a finding only when it is a clear defect in lines this branch changed and
   you can confirm the fix locally (a test, a lint, or reading the code path).
   Skip style nits, speculative edge cases, and anything outside the diff.
3. Commit the fixes, then re-run Phase 2 local validation.
4. Do not re-run the CLI review. One pass per PR: a second run spends CLI
   allowance, and a fix-then-review loop has no natural stopping point.
5. Record the outcome in the PR body's Test Plan, for example
   `CodeRabbit CLI pre-review: 4 findings, 2 fixed, 2 dismissed as nits`, or the
   one-line skip reason.

## Relationship to the harvest phase

The pre-review is local and happens before the PR exists. The harvest reads
CodeRabbit's threads on the PR after CI is green. The pre-review does not replace
the harvest: findings fixed locally simply never become threads, and the harvest
still runs, because the PR review sees the whole diff with repo configuration the
local run may not apply.

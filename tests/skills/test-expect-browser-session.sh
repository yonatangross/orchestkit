#!/usr/bin/env bash
# Test: every agent-browser command an expect run prescribes names the
# run's own session, and that holds across SEPARATE shell invocations.
#
# Second HOLD on PR #4594 (head c0d8a4f6): the first fix exported
# AGENT_BROWSER_SESSION once at run start, but Bash tool calls run in
# separate shells, so the export did not survive. The open, the middle
# commands and the close each fell back to the shared `default` session:
# the same collision as #4520, only smaller.
#
# Arms:
#   static: every `agent-browser` command line inside the expect-agent.md
#           Page Testing Workflow block carries `--session` with one
#           identical, non-default, non-variable token
#   same:   every `agent-browser --session X` command in execution.md
#           (where the close recipe lives) names the same X the workflow
#           opens with: a close on a different name kills nothing this run
#           owns and may hit somebody else's session
#   live:   the documented open, a later command and the documented close,
#           run as three separate env-scrubbed shells against a stubbed
#           agent-browser, all log the same non-default session
#
# The stub only records the --session argument; no browser ever launches.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOC="$REPO_ROOT/src/agents/expect-agent.md"
EXEC_DOC="$REPO_ROOT/src/skills/expect/references/execution.md"

echo "=== expect run session naming across separate shells ==="
echo ""

PASS=0
FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-expect-session.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# --- extract the workflow block ------------------------------------------
# The numbered sequence under '## Page Testing Workflow' is the normative
# command list: it is what the agent actually runs for every page.
BLOCK="$(awk '
    /## Page Testing Workflow/ { sec = 1 }
    sec && /^```/ { fences++; if (fences == 2) exit; next }
    sec && fences == 1 { print }
' "$DOC")"
CMDS="$(printf '%s\n' "$BLOCK" | grep -E 'agent-browser ' || true)"

if [[ -z "$CMDS" ]]; then
    bad "no agent-browser command lines found in the Page Testing Workflow block"
else
    ok "extracted $(printf '%s\n' "$CMDS" | grep -c .) agent-browser command lines from the workflow block"
fi

# --- static arm: every command carries --session with ONE token ----------
if [[ -n "$CMDS" ]]; then
    missing="$(printf '%s\n' "$CMDS" | grep -vE -- '--session[ =]' || true)"
    if [[ -n "$missing" ]]; then
        bad "workflow commands missing --session (they fall back to 'default'):"
        printf '%s\n' "$missing" | sed 's/^/      /'
    else
        ok "every workflow command carries --session"
    fi

    tokens="$(printf '%s\n' "$CMDS" | grep -oE -- '--session[ =][^ ]+' | sort -u || true)"
    ntok="$(printf '%s\n' "$tokens" | grep -c . || true)"
    if [[ "$ntok" == 1 ]]; then
        tok="${tokens#--session }"
        tok="${tok#--session=}"
        if [[ -z "$tok" || "$tok" == default ]]; then
            bad "workflow session token is '$tok' (must be set and not 'default')"
        elif printf '%s' "$tok" | grep -qE '^\$|AGENT_BROWSER_SESSION'; then
            bad "session token is a variable ($tok): env does not survive between Bash calls"
        else
            ok "all workflow commands name one session token: $tok"
        fi
    elif [[ "$ntok" -gt 1 ]]; then
        bad "workflow commands name $ntok different session tokens:"
        printf '%s\n' "$tokens" | sed 's/^/      /'
    fi
fi

# --- static arm 2: execution.md prescribes the same per-call flag --------
if grep -q 'export AGENT_BROWSER_SESSION' "$EXEC_DOC"; then
    bad "execution.md still prescribes a one-time export (does not survive separate shells)"
elif grep -qE 'agent-browser --session [^ ]+ close' "$EXEC_DOC"; then
    ok "execution.md close guidance carries an explicit --session"
else
    bad "execution.md close guidance lacks an explicit --session"
fi

# --- same-session arm: the documented close names the session the open did
# The workflow block pins one token ($tok from the static arm). Every
# `agent-browser --session X` command in execution.md, which holds the
# close recipe, must name the same X.
if [[ "${ntok:-0}" != 1 || -z "${tok:-}" ]]; then
    bad "cannot compare close session: workflow token is not pinned to one value"
else
    exec_cmds="$(grep -oE 'agent-browser --session [^ ,`)]+' "$EXEC_DOC" || true)"
    if [[ -z "$exec_cmds" ]]; then
        bad "execution.md carries no 'agent-browser --session X' commands to compare"
    else
        mismatch=0
        while IFS= read -r ecline; do
            [[ -z "$ecline" ]] && continue
            s="${ecline##*--session }"
            if [[ "$s" != "$tok" ]]; then
                bad "execution.md names session '$s' but the workflow opens '$tok': $ecline"
                mismatch=1
            fi
        done <<< "$exec_cmds"
        [[ "$mismatch" -eq 0 ]] && ok "execution.md agent-browser commands name the same session as the open ($tok)"
    fi
fi

# --- live arm: open, a later command, close, three separate shells -------
mkdir -p "$WORK/bin"
cat > "$WORK/bin/agent-browser" <<'STUB'
#!/usr/bin/env bash
session="default"
while (($#)); do
    case "$1" in
        --session)   session="${2:-}"; shift 2 ;;
        --session=*) session="${1#--session=}"; shift ;;
        *) shift ;;
    esac
done
printf '%s\n' "$session" >> "${AB_SESSION_LOG:?AB_SESSION_LOG unset}"
STUB
chmod +x "$WORK/bin/agent-browser"
AB_LOG="$WORK/sessions.log"
: > "$AB_LOG"

pick_cmd() {  # pick_cmd <verb-regex> -> first matching doc command line
    printf '%s\n' "$CMDS" | grep -m1 -E " $1( |\$)" || true
}
open_cmd="$(pick_cmd open)"
mid_cmd="$(pick_cmd snapshot)"
close_cmd="$(pick_cmd close)"

if [[ -z "$open_cmd" || -z "$mid_cmd" || -z "$close_cmd" ]]; then
    bad "could not extract open / mid / close commands from the workflow block"
else
    ok "extracted open, mid-command and close from the workflow block"
fi

# Each doc line becomes a runnable command: expect-<run-id> -> expect-t,
# {url} -> a dummy URL. Runs in a fresh env-scrubbed shell every time, the
# same isolation separate Bash tool calls have.
run_doc_line() {
    local line="$1"
    line="$(printf '%s' "$line" | sed -E 's/<[a-zA-Z_-]+>/t/g; s/\{[^}]*\}/http:\/\/localhost:9\/x/g')"
    env -i PATH="$WORK/bin:/usr/bin:/bin" AB_SESSION_LOG="$AB_LOG" HOME="$WORK" \
        bash -c "$line" >/dev/null 2>&1 || true
}

if [[ -n "$open_cmd" ]]; then run_doc_line "$open_cmd"; fi
if [[ -n "$mid_cmd" ]];  then run_doc_line "$mid_cmd";  fi
if [[ -n "$close_cmd" ]]; then run_doc_line "$close_cmd"; fi

seen="$(cat "$AB_LOG")"
nseen="$(printf '%s\n' "$seen" | grep -c . || true)"
uniq_seen="$(printf '%s\n' "$seen" | sort -u)"

if [[ "$nseen" -lt 3 ]]; then
    bad "stub recorded $nseen calls, expected 3 (open, mid, close)"
elif [[ "$(printf '%s\n' "$uniq_seen" | grep -c .)" != 1 ]]; then
    bad "open, mid and close named different sessions across separate shells:"
    printf '%s\n' "$seen" | sed 's/^/      /'
elif [[ "$uniq_seen" == default || -z "$uniq_seen" ]]; then
    bad "open, mid and close all landed on the shared 'default' session"
else
    ok "open, mid and close all named session '$uniq_seen' across separate shells"
fi

echo ""
if [[ "$FAIL" -gt 0 ]]; then
    echo "RESULT: FAIL ($FAIL failures, $PASS passed)"
    exit 1
fi
echo "RESULT: PASS ($PASS checks)"

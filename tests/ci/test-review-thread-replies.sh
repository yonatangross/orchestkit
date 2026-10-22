#!/usr/bin/env bash
# Table test for scripts/ci/review-thread-replies.py (operator word
# GROK-REVIEW-2121, 2026-10-22, items 1 and 2).
#
# The rule under test: every review thread a BOT starts (CodeRabbit, Codex,
# any `[bot]` author) carries at least one later comment by a non-bot author,
# a human or an agent posting as one, whether the thread is resolved or not.
# A resolved bot thread with no reply is a SILENT RESOLVE and fails like an
# open one. A thread a person starts is outside the rule.
#
# Fixtures are the GraphQL `reviewThreads.nodes` shape, written by python3.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
CHECK="${ROOT}/scripts/ci/review-thread-replies.py"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/review-thread-replies.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0
pass=0

python3 - "${SCRATCH}" <<'PY'
import json, os, sys
out = sys.argv[1]

def c(login, typename="User"):
    return {"author": {"login": login, "__typename": typename}, "body": "x", "url": "https://example.test/c"}

def t(comments, resolved=False, path="src/a.ts", line=10, more=False):
    return {"isResolved": resolved, "path": path, "line": line,
            "comments": {"nodes": comments, "pageInfo": {"hasNextPage": more}}}

CR = ("coderabbitai", "Bot")
CODEX = ("chatgpt-codex-connector", "Bot")
cases = {
    "empty": [],
    "bot-replied": [t([c(*CR), c("yonatangross")])],
    "bot-open-unreplied": [t([c(*CR)])],
    "bot-resolved-unreplied": [t([c(*CODEX)], resolved=True, path="lib/b.py", line=7)],
    "bot-only-bot-replies": [t([c(*CR), c("coderabbitai[bot]"), c(*CODEX)])],
    "login-suffix-bot": [t([c("copilot-pull-request-reviewer[bot]", "User")])],
    "human-thread-unreplied": [t([c("yonatangross")])],
    "mixed-one-unreplied": [t([c(*CR), c("someone")]), t([c(*CODEX)], path="docs/x.md", line=None)],
    "truncated-no-reply": [t([c(*CR)] + [c("coderabbitai[bot]")] * 3, more=True)],
}
for name, threads in cases.items():
    with open(os.path.join(out, name + ".json"), "w") as fh:
        json.dump(threads, fh)
with open(os.path.join(out, "malformed.json"), "w") as fh:
    fh.write("{not json")
PY

# expect <case> <exit> [substring that must be in the output]
expect() {
  local name="$1" want="$2" needle="${3:-}" out rc
  set +e
  out="$(python3 "${CHECK}" --threads-json "${SCRATCH}/${name}.json" 2>&1)"
  rc=$?
  set -e
  if [ "${rc}" != "${want}" ]; then
    echo "not ok - ${name}: exit ${rc}, want ${want}"; echo "  # ${out}" | head -5; fail=$((fail + 1)); return
  fi
  if [ -n "${needle}" ] && [[ "${out}" != *"${needle}"* ]]; then
    echo "not ok - ${name}: output lacks '${needle}'"; echo "  # ${out}" | head -5; fail=$((fail + 1)); return
  fi
  echo "ok - ${name} (exit ${rc})"; pass=$((pass + 1))
}

expect empty 0 "0 bot review thread(s)"
expect bot-replied 0 "1 bot review thread(s), all replied"
expect bot-open-unreplied 1 "src/a.ts:10"
expect bot-resolved-unreplied 1 "resolved with no reply"
expect bot-only-bot-replies 1 "coderabbitai"
expect login-suffix-bot 1 "copilot-pull-request-reviewer[bot]"
expect human-thread-unreplied 0 "0 bot review thread(s)"
expect mixed-one-unreplied 1 "docs/x.md"
expect truncated-no-reply 1 "more than 100 comments"
expect malformed 2 "could not read"

echo "# review-thread-replies: ${pass} passed, ${fail} failed"
[ "${fail}" -eq 0 ]

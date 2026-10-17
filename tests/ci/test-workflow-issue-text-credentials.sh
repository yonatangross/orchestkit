#!/usr/bin/env bash
# Gate for #4747: scripts/ci/check-workflow-issue-text.py must fail any
# workflow where one job reads untrusted issue/comment text while holding a
# token secret or id-token:write.
#
# Every arm asserts an exact exit code AND a matched message, so a scanner
# error (unreadable file, crash) can never read as the arm's expectation.
# Exit codes: 0 = clean, 1 = finding(s), 2 = scanner error.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
SCAN="${ROOT}/scripts/ci/check-workflow-issue-text.py"
FIXTURES="${HERE}/workflow-issue-text/fixtures"
WORKFLOWS="${ROOT}/.github/workflows"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/issue-text-gate.XXXXXX")"
trap 'rm -rf "${SCRATCH}"' EXIT

fail=0

# expect <arm-name> <target> <want-rc> <needle> [needle...]
expect() {
  local name="$1" target="$2" want_rc="$3"; shift 3
  local out="${SCRATCH}/${name}.out" rc
  python3 "${SCAN}" "${target}" > "${out}" 2>&1 && rc=0 || rc=$?
  if [ "${rc}" -ne "${want_rc}" ]; then
    echo "FAIL[${name}]: exit ${rc}, wanted ${want_rc}"; cat "${out}"; fail=1; return
  fi
  local needle
  for needle in "$@"; do
    if ! grep -qF "${needle}" "${out}"; then
      echo "FAIL[${name}]: output missing '${needle}':"; cat "${out}"; fail=1; return
    fi
  done
  echo "PASS[${name}]"
}

# Unsafe shapes, each must be a finding (rc 1) and named.
expect unsafe-file "${FIXTURES}/unsafe-model-token-and-issue-text.yml" 1 \
  "unsafe-model-token-and-issue-text" "reads issue/comment text" "id-token: write" "secrets.CLAUDE_CODE_OAUTH_TOKEN"
expect unsafe-deep-indent "${FIXTURES}/unsafe-deep-indent.yml" 1 \
  "unsafe-deep-indent" "reads issue/comment text"
expect unsafe-top-env "${FIXTURES}/unsafe-top-level-env.yml" 1 \
  "unsafe-top-level-env" "reads issue/comment text" "secrets.MODEL_API_TOKEN"
expect unsafe-inherit "${FIXTURES}/unsafe-secrets-inherit.yml" 1 \
  "unsafe-secrets-inherit" "reads issue/comment text" "secrets: inherit"

# XREVIEW 6209271782 P2: job properties at any indent, and a quoted job key
# ahead of a safe job, must still be inspected (a finding) or refused (rc 2);
# a PASS on either is the bypass.
expect unsafe-deep-props "${FIXTURES}/unsafe-job-perms-deep-props.yml" 1 \
  "unsafe-job-perms-deep-props" "reads issue/comment text" "id-token: write"
expect unsafe-quoted-job "${FIXTURES}/unsafe-quoted-job-name.yml" 1 \
  "unsafe-quoted-job-name" "job 'triage'" "id-token: write"

# Security review of 5b84e983: write-all and a quoted id-token grant are the
# same credential as id-token: write.
expect unsafe-write-all "${FIXTURES}/unsafe-write-all.yml" 1 \
  "unsafe-write-all" "reads issue/comment text" "permissions: write-all"
expect unsafe-quoted-id-token "${FIXTURES}/unsafe-quoted-id-token.yml" 1 \
  "unsafe-quoted-id-token" "reads issue/comment text" "id-token: write"

# XREVIEW 6209698795: a quoted permissions key, at job or workflow level,
# is the same key and must be read.
expect unsafe-quoted-job-perms "${FIXTURES}/unsafe-quoted-job-permissions.yml" 1 \
  "unsafe-quoted-job-permissions" "reads issue/comment text" "permissions: write-all"
expect unsafe-quoted-top-perms "${FIXTURES}/unsafe-quoted-top-permissions.yml" 1 \
  "unsafe-quoted-top-permissions" "reads issue/comment text" "id-token: write"

# XREVIEW 6209908015: a table of YAML key and value forms. Each unsafe row
# grants a credential to a job that reads issue text, in one valid YAML
# spelling. The scanner must report a finding (1) or refuse the form (2);
# a PASS (0) on any row is the bypass. The last row is a safe control.
# Round 6 (conductor189): the scanner has two layers, a YAML safe loader on
# the parsed mapping and the strict-subset line reader, and a file is clean
# only when BOTH are. Every row also runs each layer alone; on an unsafe row
# each layer must refuse or flag it on its own, unless the row names that
# layer as blind (the AND-rule rows at the end).
# form <name> <want-rc> <want-parsed-rc> <want-lines-rc> <yaml body>
LAYER_RC="${HERE}/workflow-issue-text/layer-rc.py"
form() {
  local name="$1" want="$2" want_p="$3" want_l="$4" body="$5" rc layers
  printf 'name: probe\non: workflow_dispatch\n%s\n' "${body}" > "${SCRATCH}/form-${name}.yml"
  python3 "${SCAN}" "${SCRATCH}/form-${name}.yml" > "${SCRATCH}/form-${name}.out" 2>&1 && rc=0 || rc=$?
  layers="$(python3 "${LAYER_RC}" "${SCAN}" "${SCRATCH}/form-${name}.yml" 2>&1 | tail -1)" || true
  if [ "${rc}" -ne "${want}" ] || [ "${layers}" != "${want_p} ${want_l}" ]; then
    echo "FAIL[form-${name}]: exit ${rc} (want ${want}), layers parsed/lines '${layers}' (want '${want_p} ${want_l}')"
    cat "${SCRATCH}/form-${name}.out"; fail=1; return
  fi
  echo "PASS[form-${name}]: exit ${rc}, parsed ${want_p}, lines ${want_l}"
}
R='      - run: gh issue view 1'
form plain-key 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    permissions: write-all
    steps:
${R}"
form single-quoted-key 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    'permissions': write-all
    steps:
${R}"
form double-quoted-key 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    \"permissions\": write-all
    steps:
${R}"
form escaped-key 2 1 2 "permissions: {}
jobs:
  t:
    runs-on: x
    \"permiss\\u0069ons\": write-all
    steps:
${R}"
form explicit-key 2 1 2 "permissions: {}
jobs:
  t:
    runs-on: x
    ? permissions
    : write-all
    steps:
${R}"
form flow-job-body 2 1 2 "permissions: {}
jobs:
  t:
    {runs-on: x, permissions: write-all,
     steps: [{run: gh issue view 1}]}"
form flow-permissions-value 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    permissions: {id-token: write}
    steps:
${R}"
form escaped-value 2 1 2 "permissions: {}
jobs:
  t:
    runs-on: x
    permissions: \"wr\\u0069te-all\"
    steps:
${R}"
form tagged-value 2 1 2 "permissions: {}
jobs:
  t:
    runs-on: x
    permissions: !!str write-all
    steps:
${R}"
form anchor-alias 2 1 2 "x-perms: &p
  id-token: write
permissions: {}
jobs:
  t:
    runs-on: x
    permissions: *p
    steps:
${R}"
form merge-key 2 1 2 "x-perms: &p
  id-token: write
permissions: {}
jobs:
  t:
    runs-on: x
    permissions:
      <<: *p
    steps:
${R}"
form second-document 2 2 2 "permissions: {}
jobs:
  ok:
    runs-on: x
    steps:
      - run: echo ok
env:
  A: b
---
name: probe2
on: workflow_dispatch
permissions: write-all
jobs:
  t:
    runs-on: x
    steps:
${R}"
form duplicate-top-key 2 2 2 "permissions: write-all
jobs:
  t:
    runs-on: x
    steps:
${R}
permissions: {}"
form hex-escaped-secret 2 1 2 "permissions: {}
env:
  T: \"\${{ secr\\x65ts.MODEL_TOKEN }}\"
jobs:
  t:
    runs-on: x
    steps:
${R}"
form safe-control 0 0 0 "permissions:
  contents: read
jobs:
  t:
    runs-on: x
    steps:
${R}"

# XREVIEW 6210628528: Actions context names are case-insensitive, and the
# runner reads an expression through quoted strings, so `}}` inside quotes
# does not end it. Each row hides a secret from a case-sensitive or
# boundary-cutting reader; both layers must flag it on their own.
form uppercase-secrets-bracket 1 1 1 "permissions: {}
jobs:
  triage:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ github.event.issue.body }}
      MODEL: \${{ SECRETS['MODEL_TOKEN'] }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
form uppercase-tojson-secrets 1 1 1 "permissions: {}
jobs:
  triage:
    runs-on: x
    env:
      ALL: \${{ toJSON(SECRETS) }}
    steps:
${R}"
form quoted-braces-in-expression 1 1 1 "permissions: {}
jobs:
  triage:
    runs-on: x
    env:
      MODEL: \${{ format('}}{0}', secrets['MODEL_TOKEN']) }}
    steps:
${R}"
form mixed-case-dot-secret 1 1 1 "permissions: {}
jobs:
  triage:
    runs-on: x
    env:
      MODEL: \${{ Secrets.Model_Token }}
    steps:
${R}"
form github-token-any-case-is-inert 0 0 0 "permissions: {}
jobs:
  triage:
    runs-on: x
    env:
      GH_TOKEN: \${{ SECRETS.github_token }}
    steps:
${R}"

# Security review of 5a127563: a secret after a quoted " #" must not be
# stripped as a comment, and a reference outside ${{ }} (an if: condition
# reads expressions without the braces) still names the context.
form hash-before-secret 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    env:
      T: \"tag #1 \${{ secrets.MODEL_TOKEN }}\"
    steps:
${R}"
form secret-without-braces 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    steps:
      - if: secrets.MODEL_TOKEN != ''
        run: gh issue view 1"

# XREVIEW 6211162308 P2a: index access, letter case and spaces are the same
# issue body read. 3 spellings x 3 credentials; each layer must flag all 9.
n=0
for spell in "github['event']['issue']['body']" 'GITHUB.EVENT.ISSUE.BODY' 'github . event . issue . body'; do
  n=$((n + 1))
  tag="${n}-"
  form "spell-${tag}write-all" 1 1 1 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${spell} }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
  form "spell-${tag}id-token" 1 1 1 "permissions: {id-token: write}
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${spell} }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
  form "spell-${tag}secret" 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${spell} }}
      MODEL: \${{ secrets.MODEL_TOKEN }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
done
# The whole event object carries the issue body too.
form whole-event-tojson 1 1 1 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      EV: \${{ toJSON(github.event) }}
    steps:
      - run: echo \"\$EV\""
# Inert metadata in index form stays inert (control).
form inert-number-index 0 0 0 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      N: \${{ github['event']['issue']['number'] }}
    steps:
      - run: echo \"\$N\""
# XREVIEW 6211162308 P2b: workflow env is inherited by every job's steps.
form inherited-workflow-env 1 1 1 "permissions: write-all
env:
  ISSUE_TEXT: \${{ github.event.issue.body }}
jobs:
  t:
    runs-on: x
    steps:
      - run: echo \"\$ISSUE_TEXT\""

# XREVIEW 6211906464: a github access a reader cannot classify is a read.
# Computed index, grouped index and the whole context behind an operator,
# each with 3 credentials. Each layer must flag all on its own.
n=0
for expr in "github[format('ev{0}', 'ent')].issue.body" "github[('event')].issue.body" 'toJSON(github || null)'; do
  n=$((n + 1))
  form "unclassified-${n}-write-all" 1 1 1 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${expr} }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
  form "unclassified-${n}-id-token" 1 1 1 "permissions: {id-token: write}
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${expr} }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
  form "unclassified-${n}-secret" 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    env:
      ISSUE_TEXT: \${{ ${expr} }}
      MODEL: \${{ secrets.MODEL_TOKEN }}
    steps:
      - run: echo \"\$ISSUE_TEXT\""
done
# The gh CLI read shapes in inherited workflow defaults count too.
form inherited-defaults-cli-read 1 1 1 "permissions: write-all
defaults:
  run:
    shell: bash -c 'gh issue view 1; bash {0}'
jobs:
  t:
    runs-on: x
    env:
      GH_TOKEN: \${{ github.token }}
    steps:
      - run: echo ok"
# Controls: ordinary github fields and prose stay clean.
form github-fields-control 0 0 0 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      R: \${{ github.repository }}
      PR: \${{ github.event.pull_request.number }}
      S: \${{ github.sha }}
    steps:
      - uses: actions/github-script@v7
      - run: echo see https://github.com/x/y"

# XREVIEW 6212345276 (full sweep). The trust boundary: a workflow whose
# trigger carries untrusted text (issues, issue_comment, discussion,
# pull_request_target, workflow_run, workflow_call, ...) may hold NO
# credential in any job, however the text is read: shell spellings, the
# event file, github-script, called scripts, composite actions, job outputs
# and artifacts are all inside it. Each row is a sweep fixture; each layer
# must flag it on its own.
I='on: issues
permissions: write-all'
form root-wildcard 1 1 1 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      BODY: \${{ toJSON(github.*) }}
    steps:
      - run: echo \"\$BODY\""
form root-wildcard-spaced 1 1 1 "permissions: write-all
jobs:
  t:
    runs-on: x
    env:
      BODY: \${{ toJSON(github . *) }}
    steps:
      - run: echo \"\$BODY\""
for cmd in "'gh' 'issue' 'view' 1" 'g\\h i\\ssue v\\iew 1' 'gh --repo o/r issue view 1' 'gh issue \"\$VERB\" 1' "printf '%s' Z2ggaXNzdWUgdmlldyAx | base64 -d | bash" 'jq -r .issue.body \"\$GITHUB_EVENT_PATH\"' 'bash scripts/read_issue.sh'; do
  m=$((${m:-0} + 1))
  printf 'name: probe\n%s\njobs:\n  t:\n    runs-on: x\n    steps:\n      - run: |\n          %s\n' "${I}" "${cmd}" > "${SCRATCH}/boundary-${m}.yml"
  expect "boundary-shell-${m}" "${SCRATCH}/boundary-${m}.yml" 1 "untrusted text"
done
printf 'name: probe\n%s\njobs:\n  t:\n    runs-on: x\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: console.log(context.payload.issue.body)\n' "${I}" > "${SCRATCH}/boundary-gs.yml"
expect boundary-github-script "${SCRATCH}/boundary-gs.yml" 1 "untrusted text"
printf 'name: probe\n%s\njobs:\n  t:\n    runs-on: x\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/read-issue\n' "${I}" > "${SCRATCH}/boundary-composite.yml"
expect boundary-composite-action "${SCRATCH}/boundary-composite.yml" 1 "untrusted text"
printf 'name: probe\non: issues\njobs:\n  call:\n    permissions: write-all\n    uses: owner/repo/.github/workflows/triage.yml@main\n' > "${SCRATCH}/boundary-caller.yml"
expect boundary-reusable-caller "${SCRATCH}/boundary-caller.yml" 1 "untrusted text"
printf 'name: probe\non: issues\njobs:\n  fetch:\n    permissions: {}\n    runs-on: x\n    outputs:\n      body: ${{ steps.r.outputs.body }}\n    steps:\n      - id: r\n        run: echo body=x >> "$GITHUB_OUTPUT"\n  apply:\n    needs: fetch\n    permissions: write-all\n    runs-on: x\n    env:\n      B: ${{ needs.fetch.outputs.body }}\n    steps:\n      - run: echo "$B"\n' > "${SCRATCH}/boundary-outputs.yml"
expect boundary-job-outputs "${SCRATCH}/boundary-outputs.yml" 1 "job 'apply'" "untrusted text"
printf 'name: probe\non:\n  issue_comment:\n    types: [created]\njobs:\n  t:\n    runs-on: x\n    env:\n      M: ${{ secrets.MODEL_TOKEN }}\n    steps:\n      - run: echo ok\n' > "${SCRATCH}/boundary-comment-secret.yml"
expect boundary-comment-secret "${SCRATCH}/boundary-comment-secret.yml" 1 "untrusted text"
printf 'name: probe\non: [push, workflow_call]\njobs:\n  t:\n    runs-on: x\n    permissions:\n      id-token: write\n    steps:\n      - run: echo ok\n' > "${SCRATCH}/boundary-callee.yml"
expect boundary-callee-id-token "${SCRATCH}/boundary-callee.yml" 1 "untrusted text"
# Each boundary fixture must be flagged by EACH layer on its own.
for f in "${SCRATCH}"/boundary-[0-9]*.yml "${SCRATCH}"/boundary-gs.yml "${SCRATCH}"/boundary-composite.yml \
  "${SCRATCH}"/boundary-caller.yml "${SCRATCH}"/boundary-outputs.yml "${SCRATCH}"/boundary-comment-secret.yml \
  "${SCRATCH}"/boundary-callee.yml; do
  layers="$(python3 "${LAYER_RC}" "${SCAN}" "${f}" 2>&1 | tail -1)" || true
  if [ "${layers}" != "1 1" ]; then
    echo "FAIL[layers-$(basename "${f}" .yml)]: parsed/lines '${layers}', want '1 1'"; fail=1
  else
    echo "PASS[layers-$(basename "${f}" .yml)]: parsed 1, lines 1"
  fi
done
# XREVIEW 6212763969: a workflow_call job with no permissions of its own (and
# none at the top) runs with whatever its caller granted, id-token included,
# so it holds an unknown credential. Inside the boundary that must be an
# explicit restriction. Codex's callee, red on both layers; then two
# controls where the restriction is explicit (top level, job level).
printf 'on: workflow_call\njobs:\n  t:\n    runs-on: x\n    steps:\n      - run: gh issue view 1\n' > "${SCRATCH}/callee-inherits.yml"
expect callee-inherits "${SCRATCH}/callee-inherits.yml" 1 "inherits" "untrusted text"
layers="$(python3 "${LAYER_RC}" "${SCAN}" "${SCRATCH}/callee-inherits.yml" 2>&1 | tail -1)" || true
if [ "${layers}" = "1 1" ]; then echo "PASS[layers-callee-inherits]: parsed 1, lines 1"; else echo "FAIL[layers-callee-inherits]: parsed/lines '${layers}', want '1 1'"; fail=1; fi
printf 'on: workflow_call\npermissions: {}\njobs:\n  t:\n    runs-on: x\n    steps:\n      - run: gh issue view 1\n' > "${SCRATCH}/callee-top-restricted.yml"
expect callee-top-restricted "${SCRATCH}/callee-top-restricted.yml" 0 "PASS"
printf 'on: workflow_call\njobs:\n  t:\n    runs-on: x\n    permissions:\n      contents: read\n    steps:\n      - run: gh issue view 1\n' > "${SCRATCH}/callee-job-restricted.yml"
expect callee-job-restricted "${SCRATCH}/callee-job-restricted.yml" 0 "PASS"
# Controls: the safe apply side of the split (scoped write, GITHUB_TOKEN
# only) on issues stays clean, and a credential job on a trusted trigger
# is outside the boundary rule.
printf 'name: probe\non: issues\njobs:\n  apply:\n    runs-on: x\n    permissions:\n      issues: write\n    env:\n      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n    steps:\n      - run: gh issue comment 1 --body-file c.md\n' > "${SCRATCH}/boundary-safe-apply.yml"
expect boundary-safe-apply "${SCRATCH}/boundary-safe-apply.yml" 0 "PASS"
printf 'name: probe\non: push\npermissions: write-all\njobs:\n  t:\n    runs-on: x\n    steps:\n      - run: echo ok\n' > "${SCRATCH}/boundary-trusted.yml"
expect boundary-trusted-trigger "${SCRATCH}/boundary-trusted.yml" 0 "PASS"

# AND rule, both directions. The parser joins a double-quoted YAML string
# across an escaped line break, so it reads `gh issue view` where the line
# reader sees two halves; the parsed layer flags it, so the file fails. A
# safe grant spelled with an escaped key is clean to the parser, and the
# line reader refuses the form, so the file still fails.
form and-parsed-catches 1 1 0 "permissions: {}
jobs:
  t:
    runs-on: x
    env:
      T: \${{ secrets.MODEL_TOKEN }}
    steps:
      - run: \"gh issue vi\\
          ew 1\""
# A bracket secret reference (once invisible to the line reader, round 6).
form bracket-secret 1 1 1 "permissions: {}
jobs:
  t:
    runs-on: x
    env:
      T: \${{ secrets['MODEL_TOKEN'] }}
    steps:
${R}"
form and-lines-refuses 2 0 2 "jobs:
  t:
    runs-on: x
    \"permiss\\u0069ons\": {contents: read}
    steps:
${R}"

# Safe split must pass (rc 0, PASS message).
expect safe-split "${FIXTURES}/safe-read-model-apply-split.yml" 0 "PASS"

# A workflow whose jobs block yields zero parsed jobs is a scanner error
# (rc 2), never a pass: a gate that saw nothing verified nothing.
expect no-jobs "${FIXTURES}/bad-no-jobs.yml" 2 "no jobs"

# The live tree must pass, and the PASS line must report a nonzero scan
# count so an empty glob cannot read as a green sweep.
live_out="${SCRATCH}/live.out"
if python3 "${SCAN}" "${WORKFLOWS}" > "${live_out}" 2>&1; then
  scanned=$(sed -n 's/^PASS: \([0-9][0-9]*\) workflow file.*$/\1/p' "${live_out}")
  if [ -n "${scanned}" ] && [ "${scanned}" -gt 0 ]; then
    echo "PASS[live-tree]: ${scanned} workflow files scanned"
  else
    echo "FAIL[live-tree]: no scan count in PASS line:"; cat "${live_out}"; fail=1
  fi
else
  echo "FAIL[live-tree]: exit nonzero:"; cat "${live_out}"; fail=1
fi

exit "${fail}"

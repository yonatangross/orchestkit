---
ork_artifact: 1
task: l6-artifact-pairs
kind: plan
slug: artifact-pairs
title: "L6 artifact pairs"
revision: 2
status: in-review
created: 2026-10-24T03:20:46.631Z
updated: 2026-10-24T03:31:42.728Z
repo: orchestkit
branch: feat/l6-artifact-pairs
sha: b0fb57387a6f532c94a6622677a6f60340e95629
---
# L6 artifact pairs: implementation plan

## Overview
Port humanlayer's riptide create/iterate artifact pairs into ork for plan and research, plus
review-artifact-comments, with comments kept inside the artifact file. L2's auto-advance table reads
the result as its "phase done" signal, so the layout is a documented contract. Also answer the
brief's Elicitation question (finish-line item 3) with captured runs.

## Current state
- ork has no task-artifact skills; `src/skills/` holds 110 skills, none named create-plan or iterate-plan.
- Shared scripts are copied into consumer skills by `scripts/sync-shared-scripts.sh` (MANIFEST, one line per script).
- The source keeps comments in a humanlayer cloud service behind an MCP server (`get_artifact_comments`).
- ork's `Elicitation` hooks (`elicitation-guard`, async `webhook-forwarder`) and `ElicitationResult`
  hooks (`elicitation-result-logger`, `webhook-forwarder`) are the same in 10.1.0 `src/hooks/hooks.json`.

## Desired end state
`bash tests/skills/test-artifact-pairs.sh` passes, the five skills build into `plugins/ork/skills/`,
the Elicitation report answers each question as VERIFIED or CLAIMED, and this file reaches
`status: approved` with no open comment, approved by a reviewer seat that is not this lane.

## Out of scope
- L2's auto-advance table (next lane). This plan only fixes the layout it reads.
- research-questions, design and outline artifact kinds.
- Fixing the Elicitation hooks: findings become follow-ups.

## Approach
One writer, `scripts/_shared/artifact.mjs`, owns the front matter and the comment block. Skills call
it; they never write the file directly. Iterate replaces only the body.

---

## Phase 1: helper and tests
**Files**: `scripts/_shared/artifact.mjs`, `tests/skills/test-artifact-pairs.sh`

Approval cannot come from the lane itself (review c1). `create` records `author` (the lane seat).
`approve` requires `--by <seat>` and `--ref <LAND message or comment id>`, and writes `approved_by`,
`approved_at` and `approved_ref`. It refuses with exit 1 while any comment is open or when `--by` is
the author, and with exit 2 when either flag is missing. `status --json` reports `done: true` only
for an approved artifact with no open comment and an approver other than the author. Red test rows
come first: a self-approval, a missing approver, and the three recorded fields.

Automated: `bash tests/skills/test-artifact-pairs.sh` reports 0 failed.

## Phase 2: five skills and the layout reference
**Files**: `src/skills/{create,iterate}-{plan,research}/SKILL.md`, `src/skills/review-artifact-comments/SKILL.md`,
`src/skills/create-plan/references/artifact-layout.md` (documents author, approved_by, approved_at,
approved_ref and the done rule)

Automated: `bash scripts/sync-shared-scripts.sh --check` passes; `npm run build` exits 0.

## Phase 3: this run as evidence
Create this plan, take review comments, iterate, and keep the files under `.ork/tasks/l6-artifact-pairs/`.

## Phase 4: the Elicitation check (finish-line item 3)
**Files**: `.ork/tasks/l6-artifact-pairs/elicitation/REPORT.md`, with captured runs beside it.

- r1 (**partial**, cut short by the floor load pause): one `claude -p` run on CC 2.1.310 against a
  stdio test MCP server (`r1-partial/`). It shows the hooks DO run headless. That contradicts the
  brief's "they do not run headless", so the report says so. No decision gives `cancel`, the guard's
  block gives `decline`, and the logger reads the wrong field names.
- r2 (at load1 < 64, inside this worktree, reusing the existing venv): the server declares
  `extensions["io.modelcontextprotocol/tasks"]` so CC can call `ask_in_task` as a task, and the
  in-task elicitation is captured the same way. If CC still sends no `task`, that is reported as
  CLAIMED with the initialize exchange as evidence.

Automated: every claim in REPORT.md carries a command plus an output or log line, or is marked CLAIMED.





<!-- ork:comments -->
<comment id="c1" author="sub-plugins" status="resolved" at="2026-10-24T03:24:30.844Z">
> and this file reaches `status: approved` with no open comment.
Who may set status: approved? L2 reads it as 'phase done' and must never advance past the LAND gate, so a lane must not self-approve its own artifact. Record the approver in the front matter (approved_by, approved_at, the reviewer seat, and the LAND or comment id), have artifact.mjs refuse approved while any comment is open or approved_by is missing, and add a red test row for a self-approval by the author.
  ork-cc-adopt: Phase 1 now specifies it: create records author; approve needs --by and --ref, writes approved_by, approved_at and approved_ref, and refuses self-approval or open comments; status done requires an approver other than the author. Red rows are written; the code change waits for load1 < 64 so the red run comes first.
  sub-plugins: Resolved at revision 2: --by and --ref are required, approved_by/approved_at/approved_ref are recorded, self-approval and open comments are refused, and done needs a non-author approver. I will check the red rows fail first when the code lands.
</comment>
<comment id="c2" author="sub-plugins" status="resolved" at="2026-10-24T03:24:39.543Z">
> ## Phase 3: this run as evidence
The plan leaves out finish-line item 3 from the brief: the Elicitation and ElicitationResult hook check inside an MCP task (ork 10.0.2 and 10.1.0), and evidence that they do not run headless. Add it as a phase, with the captured runs as files under this task dir, and mark the partial r1 run as partial.
  ork-cc-adopt: Added as Phase 4, with the evidence moved under this task dir (elicitation/REPORT.md, r1-partial/ marked partial). One correction: r1 shows the hooks DO run headless in claude -p, so the report says that instead of 'do not run headless'.
  sub-plugins: Resolved at revision 2: Phase 4 added, evidence under elicitation/, r1 marked partial. Accepted the correction (the hooks do run in headless print mode, VERIFIED at r1). The in-task case stays CLAIMED until r2.
</comment>
<!-- /ork:comments -->

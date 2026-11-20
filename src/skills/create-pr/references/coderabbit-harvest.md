# CodeRabbit harvest (after checks green, before merge or auto-merge)

CodeRabbit reviews expire unread: on Yonatan-HQ/platform (last 80 PRs, measured 2026-09-02)
23 of the 24 PRs it reviewed merged with every thread still open. This phase reads the threads
once, refutes each, and closes every one with a stated outcome. Run it after CI is green and
before `gh pr merge` or arming `--auto`. Skip only when the repo has no `.coderabbit.yaml` or
the PR is still a draft. Defects fixed in Phase 3c never become threads; the harvest still runs.

```bash
H="${CLAUDE_SKILL_DIR}/scripts/coderabbit-harvest.sh"
PR_NUMBER=$(gh pr view --json number -q .number)
bash "$H" "$PR_NUMBER" --unresolved > /tmp/cr-threads.json   # ONE GraphQL call, coderabbitai only
jq length /tmp/cr-threads.json                                  # 0 → see below, then merge
```

A zero here is ambiguous: CodeRabbit read the diff and found nothing, or CodeRabbit never
saw the PR. Both print `0`, and the phase treats both as clean, so a repo the app cannot
reach passes this gate on every PR forever. Measured on this repo 2026-09-03: a valid
`.coderabbit.yaml` had been on `main` since 2026-08-25 while CodeRabbit had posted zero
comments in the repo's entire history and ignored an explicit `@coderabbitai review`, so
the app is either uninstalled on the `yonatangross` account or disabled account-side.
Note what that verdict does NOT say: absence never proves absence from a session, only the
settings page separates those two. The first time a repo's harvest returns zero,
disambiguate with
`Read("references/coderabbit-zero-reviews.md")`:
it carries the two-endpoint query, the positive control that keeps a zero honest, and the
operator steps for the installation grant. Editing `.coderabbit.yaml` cannot fix an app
that was never installed.

For each unresolved thread, spawn a refuter in ONE message: an isolated `Agent` (no
`team_name`), `subagent_type="ork:code-quality-reviewer"` (`ork:security-auditor` for a
security category). Give it `path`, `line`, `title`, `body`, and the diff slice
`git diff origin/$BASE...HEAD -- <path>`; instruct it to REFUTE the finding against that diff
and return `{"refuted": true|false, "reason": "<one sentence>"}`, defaulting to `refuted: true`
when the failure scenario cannot be reproduced. Refuters never edit files.

| Outcome | Action on the branch | Reply on the thread |
|---|---|---|
| Survived (`refuted: false`) | Fix in the same branch, commit, push | `Fixed in <sha>: <one line>` |
| Refuted (`refuted: true`) | Nothing | `Dismissed: <the one-sentence reason>` |

```bash
bash "$H" "$PR_NUMBER" --reply "$THREAD_ID" "Fixed in $(git rev-parse --short HEAD): <what changed>"
bash "$H" "$PR_NUMBER" --resolve "$THREAD_ID"       # every thread, fixed or dismissed
bash "$H" "$PR_NUMBER" --unresolved | jq length     # must print 0 before proceeding
```

A fix push re-runs CI, so re-verify green afterwards. CodeRabbit may post new threads on the
fix commit; give those exactly one more pass, then dismiss the rest with `Deferred to #<issue>`
and a filed issue, so the phase terminates instead of looping.

# Conductor Ledger

Read-only triage of repo state. The conductor diagnoses and delegates; it does
not commit, push, merge, or edit anything outside this file.

| field | value |
|---|---|
| date | 2026-08-20 |
| repo | yonatangross/orchestkit |
| branch | main |
| local HEAD | 4fb82d5a3 |
| origin/main at capture | 4fb82d5a3 (06:02:53Z) |
| origin/main now | 5092fff91 (release alpha.43, merged 06:07:56Z) |
| local main | 4fb82d5a3, now 1 commit BEHIND origin |
| package manager | npm (package-lock.json). Never pnpm in this repo. |

## Entry 1 (2026-08-20): first triage pass

### Instrument notes (read before trusting any number below)

Three instrument defects were caught and corrected during this pass. They are
recorded because each one produced a confident wrong answer first.

0. RESOLVED: `gh` is unusable here, but the GitHub data below was still
   measured directly, so no part of this ledger is guesswork. Root cause: a
   local MITM proxy intercepts all traffic (`curl` reports
   `remote_ip=127.0.0.1`, and HTTPS_PROXY/ALL_PROXY are set). `gh` is written
   in Go, which honours the proxy and then must verify its certificate through
   the macOS platform verifier, and trustd is blocked, hence the x509 error.
   Node has its own bundled CA store, so `NODE_USE_ENV_PROXY=1 node` with a
   token from `gh auth token` reaches the API cleanly. Without that env var
   Node ignores the proxy and fails with DNS ENOTFOUND, which is a different
   error with the same appearance of "no network".

1. `gh` is dead in this session. Every call fails with
   `tls: failed to verify certificate: x509: OSStatus -26276`, which is the
   macOS trustd IPC being unavailable, not an auth or network fault. Verified
   the failure persists with the sandbox disabled, so it is not a sandbox
   policy. `gh auth status` additionally reports the keyring token "invalid",
   but that verdict is itself downstream of the same break: the token is a
   valid 40-char credential and authenticates fine over a transport that does
   not use Go's platform verifier. `git ls-remote` succeeds, so the network and
   the credential are both healthy.
2. `git ls-remote` writes `failed to store: 100001` to stderr from the
   credential helper. An earlier probe captured stderr with `2>&1` into the SHA
   variable, which made every branch look present on origin. That single
   mistake turned 4 real remote branches into 11 false ones. All remote
   presence below is re-derived from a single `ls-remote --heads` capture with
   stderr strictly separated.
3. Five directories under `.worktrees/` have no `.git` file. Running `git -C`
   inside them silently walks up to the parent repo, so they reported
   `branch=main, HEAD=4fb82d5a3` and 467 ignored paths. Those were the main
   tree's values, not theirs. Their contents were then read from the filesystem
   directly.

4. origin/main moved mid-triage. The branch baseline was captured at 06:02:53Z
   as 4fb82d5a3; #3572 merged at 06:07:56Z making it 5092fff91. This is a race,
   not an instrument fault. The new commit touches only version, changelog and
   generated plugin/changelog files. It does NOT touch
   `docs/site/lib/generated/skills-data.ts`, the `src/hooks/dist` bundles, or
   `tests/security/test-sandbox-probe.sh`, so every worktree verdict below is
   unaffected. Note that local main is now one commit behind origin.

Ancestry alone is not a merge test in this repo, because it squash-merges. Every
"landed" verdict below is a content check: take the files the branch touches and
diff them against origin/main. Zero residual files means the work is present in
main under a different commit.

### Open pull requests: 2, not 3

Measured 2026-08-20 06:10Z. The brief said three. The third was **#3572
"chore(main): release 10.0.0-alpha.43"**, which merged at 06:07:56Z, minutes
before this measurement. It is merged, not missing.

#### PR #3570 fix(hooks): resolve verifier base against origin

| field | value |
|---|---|
| head | fix/worktree-verifier-stale-base -> main |
| draft | false |
| mergeStateStatus | DIRTY (mergeable=CONFLICTING) |
| head SHA | 9c1f8218c |
| check-runs | 1 total |

Red checks: **none**. The only check-run is "Enable auto-merge for Dependabot",
`skipped`, which is correct because this is not a Dependabot PR.

The blocker is a merge conflict with main, not CI. The more interesting fact is
that **no CI ran on this head at all**: 1 check-run where the sibling PR has 43.
The required checks never executed, so this PR has no evidence of passing or
failing. Resolving the conflict should trigger a real run.

#### PR #3571 test(security): add sandbox detection probe

| field | value |
|---|---|
| head | fix/3322-sandbox-paste-block -> main |
| draft | false |
| mergeStateStatus | BEHIND (mergeable=MERGEABLE) |
| head SHA | 329169a18 |
| check-runs | 43 total: 37 success, 3 failure, 3 skipped |

No check anywhere on either PR is `cancelled`, so the cancelled-is-not-a-failure
ambiguity does not arise in this batch. Verdicts below come from the job logs.

| check | conclusion | verdict |
|---|---|---|
| Security Tests | failure | REAL, self-inflicted by this PR |
| PR Playground | failure | REAL, process gate, no code fix needed |
| CI Summary | failure | DERIVATIVE, not an independent cause |
| Hook Coverage | skipped | expected, path filter |
| Integration Tests | skipped | expected, path filter |
| Enable auto-merge for Dependabot | skipped | expected, not a Dependabot PR |

**Security Tests is real, and the PR caused it.** Every security test passed
(41 passed, 0 failed). What failed is the mutation gate that sits above them,
which proves each test CAN fail by mutating the hook under it:

    proven CAN FAIL : 10
    FAILED: non-provable security tests rose to 3

This PR renames the sandbox probe so the test runner finally discovers it. A
detection probe cannot fail by construction, so making it visible raised the
non-provable count from 2 to 3 and tripped the anti-test-theater gate. The
failure is a true statement about the change, not flake and not infra.

**PR Playground is real but is a body gate, not a code gate.** The log is
explicit: `PR body is missing a Playground section`. It is a required check that
gates merge on its own. The fix is to edit the PR body to add an
`## Interactive Playground` section naming a repo path of the form
`docs/<branch-slug>/<name>.html`. The job also refuses htmlpreview.github.io and
any third-party render proxy, and points at `docs/site/lab-manifest.json` plus
`docs/site/scripts/generate-lab-data.mjs` as the real publication path. No source
change is required to clear it.

**CI Summary is derivative.** Its log shows it failing solely because Security
Tests failed, and it deliberately does NOT re-aggregate PR Playground
("required check, gates merge on its own; not re-aggregated here") to avoid
failing one PR twice for one cause. Counting it as a third failure would
double-count. There are two root causes here, not three.

Net: **zero infra failures in this batch.** Both root causes are real. That is
worth flagging, because the recent pattern in this repo has been the opposite,
with red checks turning out to be codeload 429s and apt hangs.

#### Branches on origin with no open PR

| branch | PR history | note |
|---|---|---|
| fix/git-validator-stale-message | NO PR EVER | pushed to origin, never opened |
| fix/runner-mktemp | #3575 CLOSED (not merged) | content still reached main via #3579 |

`fix/git-validator-stale-message` is an open loop: 9 files of unlanded work sat
on origin with nothing tracking it. This repeats a known pattern in this repo of
pushing a branch and never opening the PR.

### Dirty files on main: 12, all untracked, none gitignored

No build artifacts. Nothing here is generated output, so `npm run build` will
not reproduce or clear any of it. Note that `.claude/` is a tracked directory
(109 tracked files), so these 12 are genuinely new paths, not ignored scratch.

| # | path | class | note |
|---|---|---|---|
| 1 | .claude/HANDOFF-2026-07-22-full.md | real work | session handoff, 7.1 KB |
| 2 | .claude/HANDOFF-2026-08-05-security-test-theater.md | real work | superseded by #3 by its own header |
| 3 | .claude/HANDOFF-2026-08-06-security-guards.md | real work | supersedes #2 |
| 4 | .claude/PLAN-2026-07-26-assess-fixes.md | real work | assessment follow-ups, composite 5.3/10 FAIL |
| 5 | .claude/TRIAGE-2026-07-22.md | real work | triage at b7e7791d4 |
| 6 | .claude/TRIAGE-M164-2026-08-16.md | real work | largest at 28 KB, milestone 164 triage |
| 7 | .claude/VIDEO-BACKLOG-EVIDENCE.md | real work | per-issue evidence, agent-produced |
| 8 | .claude/branch-restore-2026-07-23.txt | real work (recovery record) | branch name to SHA restore lines |
| 9 | .claude/branch-protection-backup-2026-07-23.json | operational backup | re-fetchable from the GitHub API |
| 10 | .mcp.json.bak-20260814T085953 | machine-local config | differs from live .mcp.json by 24 lines |
| 11 | .mcp.json.bak-20260818-122612 | machine-local config | differs by 17 lines |
| 12 | .mcp.json.bak-20260818-124418 | machine-local config | differs by 17 lines |

Summary: 8 real work, 1 operational backup, 3 machine-local config, 0 build
artifacts.

The three `.mcp.json.bak-*` files back up `.mcp.json`, which is itself untracked
and machine-local. They are timestamped snapshots of per-machine MCP wiring and
do not belong in a shared repo. The two dated 2026-08-18 are 40 minutes apart
and identical in size.

CAUTION before anyone commits items 1 through 9: this repository is public. The
`.claude/` triage and handoff documents were written as internal notes and have
not been reviewed for that. Publication is a separate decision from tidiness.

### Worktrees: the count reconciles to 13 on disk, 11 registered

The brief said 12. Neither number matches; here is the reconciliation.

    13  directories on disk under .worktrees/
    11  registered with git
     8  both registered and present on disk
     3  registered but directory MISSING (git reports these prunable)
     5  present on disk but NOT registered with git
        8 + 3 = 11 registered;  8 + 5 = 13 on disk

Classification per the requested scheme. Deleted entries (` D`) are recoverable
from HEAD and were not counted as blocking; only M, A, R, and `??` were.

(a) REAP-SAFE, meaning on origin at ahead=0 with no disk-only content:

| worktree | branch | evidence |
|---|---|---|
| runner-mktemp | fix/runner-mktemp | ahead=0 behind=0, content fully landed, directory already gone |
| gitvalidator-msg | fix/git-validator-stale-message | ahead=0 behind=0, clean tree |
| mergeverifier-base | fix/worktree-verifier-stale-base | ahead=0 behind=0, clean tree |

Critical distinction: reaping the WORKTREE is safe for all three because the
commits are on origin. Deleting the BRANCH is safe only for `fix/runner-mktemp`.
The other two still carry unlanded content (9 and 7 files respectively) and are
the likely subjects of two of the three open PRs. Remove the directory, keep the
branch.

(b) LOCAL-ONLY BRANCH, meaning the branch does not exist on origin at all:

| worktree | branch | content vs origin/main | directory |
|---|---|---|---|
| 3322-excl-caveat | docs/3322-excludedcommands-caveat | fully landed (5 files) | present, clean |
| 3559-pipe-file-operand | fix/3559-pipe-file-operand | fully landed (7 files) | MISSING |
| heal-3516 | heal/3516-drift | fully landed (3 files) | present, clean |
| mktemp-sweep | fix/mktemp-template-sweep | fully landed (79 files) | present, clean |
| 3558-visual-budget | fix/3558-visual-budget | 1 residual, generated only | MISSING |
| credguard-truth | fix/credential-guard-truth | 1 residual, generated only | present, 2380 deletions |
| fileguard-3552 | fix/3552-file-guard-write-only | 4 residual, all build output | present, clean |

The first four are fully landed in main by squash merge and correspond to
recent commits (4d77e5807, a4da29fa9, and 4fb82d5a3 among them). Ancestry says
NO for all of them; only the content check reveals they are done.

For `fix/3558-visual-budget` and `fix/credential-guard-truth`, the sole residual
file is `docs/site/lib/generated/skills-data.ts`, which is generated. For
`fix/3552-file-guard-write-only`, all four residuals are build output
(`src/hooks/dist/pretool.mjs`, `bundle-stats.json`, and their `plugins/ork`
mirrors). In all three cases the authored source has landed and only regenerable
artifacts differ, so these are reapable, but a worker should confirm the
generated delta is stale output rather than an unbuilt source change.

`credguard-truth` shows 2380 deleted paths in its working tree, spread across
`plugins/ork` (1741), `tests/` (~440), and `.claude/coordination`. These are
tracked files removed from the working tree, not node_modules. Per the stated
rule they are recoverable from HEAD and do not block reaping. They do suggest an
interrupted operation in that tree.

(c) HAS DISK-ONLY WORK, meaning content that exists nowhere but that directory:

| worktree | branch | disk-only content |
|---|---|---|
| 3322-sandbox-block | fix/3322-sandbox-paste-block | .claude/settings.local.json, 1886 B, mtime 2026-08-19 10:11 |

This is the one worktree that must not be reaped. `git status` reports it clean,
which is misleading: the file is gitignored, so only `status --ignored` sees it.
It carries a `sandbox` block with a `deny` list and no `webhook.site` entry,
which is the parked falsification setup for issue #3322. Its branch also has one
genuinely unlanded file, `tests/security/test-sandbox-probe.sh`.

UNREGISTERED directories, which are none of (a), (b), or (c) because git does
not know about them. Contents read from the filesystem:

| directory | size | files | contents |
|---|---|---|---|
| announce-rail | 4 KB | 1 | one session events.jsonl |
| basecheck | 4 KB | 1 | one session events.jsonl |
| dynwf-adoption | 48 KB | 4 | HANDOFF.md, events.jsonl, 2 security logs |
| wfjs | 368 KB | 4 | HANDOFF.md, events.jsonl, 2 security logs |
| fixbrief | 172 KB | 6 | HANDOFF.md, skill logs, events.jsonl, 2 security logs |

All five hold only `.claude/` session telemetry residue left behind when a
worktree was removed without clearing its ignored files. No source content. The
three `HANDOFF.md` files are the only items worth a glance before deletion.

### Delegation queue (proposed, nothing executed)

Nothing below has been actioned. Each item names the worker that should own it.

1. PR #3571 unblocker. Two real, independent fixes: (a) edit the PR body to add
   an `## Interactive Playground` section naming a `docs/<slug>/<name>.html`
   path, which clears PR Playground with no code change; (b) decide how the
   sandbox probe satisfies the mutation gate, since a detection probe cannot
   fail by construction and the gate counts that as test theater. Then update
   the branch, which is BEHIND. CI Summary needs no separate work.
2. PR #3570 unblocker. Resolve the conflict with main (mergeStateStatus DIRTY).
   Note that no CI has ever run on this head, so treat the first green run as
   new information rather than a re-confirmation.
3. Open-loop owner. `fix/git-validator-stale-message` has 9 files of unlanded
   work on origin and no PR was ever opened. Either open one or retire it.
4. Worktree reaper. Prune the 3 registered-but-missing entries, remove the 3
   reap-safe directories keeping 2 of their branches, and delete the 5
   unregistered directories after checking 3 HANDOFF.md files. Must skip
   `3322-sandbox-block` entirely.
5. Local-only branch dispositioner. Confirm the generated and build-output
   residuals on the 3 partially-landed branches, then retire all 7.
6. Dirty-file dispositioner. Decide per file among commit, relocate outside the
   repo, or delete. The 3 `.mcp.json.bak-*` files are machine-local and should
   not be committed. The 8 real-work documents need a public-repo review first.

---

## Entry 2 (2026-08-20): recon findings, including three self-corrections

Produced by a 7-agent read-only fan-out. Every claim below carries a file:line
from the agent that made it and was cross-checked by a completeness critic.
Three entries CORRECT statements made earlier in this same session.

### CORRECTION 1: "cc-adoption-gaps.json is stale/untriaged" was wrong

Entry 1 and the session summary treated `features: []` on the 2.1.227 and
2.1.231 waves as evidence they were never triaged. That is false.

`scripts/cc-release-watch.mjs:309` writes `features: []` as a PLACEHOLDER, with
the literal comment "filled in by triage". The detect stage stubs every entry;
a separate triage stage back-fills it. So an empty `features` array is not a
verdict, it is an un-run stage. ALL 11 entries in the file are empty, including
2.1.229 (32 bullets) and 2.1.221 (39 bullets) which demonstrably did have
adoptions.

Both waves were in fact already triaged by hand:
- 2.1.227 twice: a binary contract diff on 2026-08-11 (PR #3419) and all five
  changelog bullets on 2026-08-13 (PR #3469), recorded at
  `src/skills/doctor/references/version-compatibility.md:486`. All five bullets
  are CC-internal with no ork surface. The only plausible one (a
  `claude-code-action` / `allowed_non_write_users` bug) cannot fire here:
  `allowed_non_write_users` appears zero times anywhere in `.github/`.
- 2.1.231 in a full audit doc, `docs/audits/cc-adoption-2.1.231-triage-2026-08-13.md`,
  verdict table 1 bullet / 0 ADOPT / 1 NO-OP. Its single bullet is an MCP OAuth
  redirect-URI fix, and ork's MCP template uses a static bearer header with no
  authorization-code flow.

Verdict for #3492: both waves are GENUINELY-EMPTY, not untriaged. The issue's
headline premise does not survive. Its concrete drift measurement, however, is
exactly right (42 added / 2 removed lines), and it UNDERSTATES the scope: 10
waves are missing from the board, not 2.

### CORRECTION 2: the CI gate is not absent, it is blind

#3492 says no CI gate regenerates or diffs these files. Half wrong. `ci.yml:77`
DOES diff `docs/site/lib/generated/`. But nothing in `npm run build` ever
regenerates `cc-adoption-data.ts`, so the existing gate is structurally
incapable of seeing this file change. The fix is to wire the existing generator
into the existing build step, not to add a new CI job.

### CORRECTION 3: a tracked triage doc contains a false proof

`docs/audits/cc-adoption-2.1.231-triage-2026-08-13.md` asserts that `.mcp.json`
declares 8 servers with zero `type` keys, so all are stdio by omission. At HEAD
that is false twice over: `.mcp.json` is gitignored (`.gitignore:55`) and
untracked, so it is operator-local and not a repo artifact at all; and the
TRACKED template `.claude/templates/mcp-enabled.json` declares context7 with
both `"type": "http"` and a `url`. The doc's no-op VERDICT survives on other
grounds, but its stated proof does not. Worth correcting so it is not cited
again.

### User-visible defect found

The published adoption board renders "Latest known upstream: 2.1.220" while
`shared/cc-support.json` says 2.1.231. That is wrong on a public page.

### PR #3571: the Security Tests failure is REAL, and the obvious fix is wrong

`tests/security/mutation-gate.sh` proves each `tests/security/test-*.sh` can
actually fail, by inverting its first deny/ask/defer expectation inside
`expect_decision()` (`tests/fixtures/test-helpers.sh:486-535`) and requiring the
file to notice. A file emitting no `ORK_MUTATION_RESULT` line scores
NO_ASSERTION and counts as non-provable (`mutation-gate.sh:136-142`, `:209-213`).

The ratchet is a HARDCODED `MUTATION_BASELINE=2` at `mutation-gate.sh:79`. There
is no external baseline file. The two pre-existing non-provable files are
`test-jq-injection.sh` and `test-sqlite-injection.sh`.

Commit `329169a18` is a pure R100 rename, `sandbox-probe.sh` to
`test-sandbox-probe.sh`, which exposes it to the `test-*.sh` glob in BOTH
`run-security-tests.sh:110` and `mutation-gate.sh:97`.

The probe is not merely un-provable, it is UNFALSIFIABLE BY CONSTRUCTION: both
of its verdicts, SANDBOX IN FORCE and SANDBOX NOT DETECTED, fall through to an
unconditional `exit 0` on its last line. Only the instrument-invalid path
(exit 2) is ever non-zero. Run with `ORK_MUTATE_INDEX=1` it printed zero
`ORK_MUTATION_RESULT` lines and exited 0.

So the gate's message is a literally true statement about the file. Raising
`MUTATION_BASELINE` to 3 would suppress a correct signal, permanently lower the
bar for every future test, and cement the jq/sqlite debt at a higher floor. The
chosen fix is to make the probe genuinely falsifiable by asserting its
CLASSIFIER against synthetic inputs, leaving the environment verdict advisory.

### PR #3570: the conflict is entirely build output

`git merge-tree` against origin/main yields exactly four conflicting paths, all
generated:

    plugins/ork/hooks/dist/bundle-stats.json
    plugins/ork/hooks/dist/pretool.mjs
    src/hooks/dist/bundle-stats.json
    src/hooks/dist/pretool.mjs

No authored source conflicts. The correct resolution is rebase onto origin/main
and rebuild, never a hand-merge of bundles.

### EPIC D (#3309): zero of five adopted, and two were closed on prose

#3309 tracks `sandbox.enabled`, `.worktreeinclude` plus `worktree.baseRef`,
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, `autoCompactWindow`, and the plugin
`dependencies` array.

Measured at HEAD: ADOPTED 0 / PARTIAL 1 / DOC-ONLY 2 / ABSENT 2. The decisive
measurement is a `git grep` for those key names across every tracked JSON in the
repo returning zero hits, and `git ls-files | grep worktreeinclude` returning
nothing.

Two items were closed as adopted on documentation alone: `git show --stat
84549cc` (PR #3463, closed #3324) touched only .md/.mdx/.html; PR #3427 touched
`autoCompactWindow` only in two markdown copies plus a docs playground, and
every code file in that commit is a DELETION of the old compaction layer. The
claim at `.claude/TRIAGE-M164-2026-08-16.md:160` that 3 of 5 are done is the
prose-counted-as-adoption error and does not survive measurement.

Nothing is version-blocked: the CC floor is >= 2.1.220 and all five capabilities
shipped at or below it.

Note the real distinction #3309 blurs: a PLUGIN settings.json is inert, but this
repo's own `.claude/settings.json` is a scope CC reads. Three of the five can
therefore be adopted here today for dogfood, while the consumer-facing doctor
offer must remain.

### Instrument finding: ork:debug-investigator cannot use pipes

The first recon attempt lost two of six lanes. `ork:debug-investigator` was
refused on its very first command with "Compound commands (&&, ||, |, ;) are not
permitted for read-only agents", so it produced nothing at all.
`ork:git-operations-engineer` ran 68 turns of real work but never emitted a final
report. When delegating to restricted agent types, either avoid compound shell
commands in the plan or write the steps to a script file and run the file.

### Safety note

The reap-plan agent returned a plan containing `rm -rf`, `git branch -D` over
eight pre-existing branches, and a `git push origin --delete`. The harness
flagged it. NOTHING from that plan has been executed, and none of it will be
without explicit per-target operator consent.

---

## Entry 3 (2026-08-20): implementation wave, conductor-verified

Four work products were produced by delegated workers and are COMMITTED LOCALLY
and UNPUSHED. Everything in this entry was re-derived by the conductor, not
taken from the workers' reports. The final auditor agent returned empty, so the
audit below is the conductor's own.

### What is committed

| branch | commits | scope |
|---|---|---|
| fix/cc-watch-fence-parse | 2 | fenced-JSON parse fix + milestone state=all |
| fix/3322-sandbox-paste-block | 1 new (6 total) | probe made falsifiable |
| fix/3492-cc-board-drift | 1 | board regenerated in build, gate unblinded |
| feat/3309-adopt-cc-settings | 1 | .worktreeinclude + two settings pins |

### Conductor-verified facts

- All four worktrees are clean, tracked-dirty = 0. No work is stranded.
- `main` is 0 commits ahead of origin/main. NOTHING was pushed.
- Remote head count went 15 to 14. The missing ref is
  `release-please--branches--main`, deleted by release-please itself after
  #3572 merged. Not caused by this session.
- `MUTATION_BASELINE=2` at mutation-gate.sh:79 is UNCHANGED. No worker took the
  shortcut of raising it.
- Zero suppression-shaped added lines (`@ts-ignore`, `@ts-expect-error`,
  `eslint-disable`, `: any`, `noqa`, `type: ignore`) across all four diffs,
  measured over 136 changed files.
- The parked `.claude/settings.local.json` is untouched: still 1886 bytes,
  mtime 2026-08-19 10:11.

### NEW DEFECT FOUND: the security mutation gate fails OPEN under the sandbox

This is the most important finding of the session and it is not yet filed.

Paired probe, same command, same tree, same worktree, minutes apart:

    mode                candidates   proven CAN FAIL   NOT provable   exit
    sandboxed (default)     13              0                0          0
    sandbox disabled        13             11                2          0

Both print a green `OK`. The sandboxed run measured NOTHING and still passed.

Root cause: `RESULT_DIR="$(mktemp -d -t ork-mutate-XXXXXX)"` at
`tests/security/mutation-gate.sh:116`. Under the sandbox that mkdtemp is denied,
`RESULT_DIR` becomes the empty string, every parallel worker writes its result
to `/test-*.sh`, and the reduce step reads back nothing. Zero proven and zero
non-provable is then compared against the baseline and passes.

Worse, the vacuous run emits actively harmful advice:

    NOTE: non-provable count fell to 0. Lower MUTATION_BASELINE
          to 0 to lock the gain in.

An operator who followed that would ratchet a security gate to 0 on the strength
of a measurement that never happened, and the ratchet is monotonic.

This is the same family as #3564 and the merged #3579 ("give every mktemp a
template so it honours TMPDIR"). That sweep fixed other call sites; this one
uses `-t`, which on darwin resolves to the per-user temp dir rather than
`$TMPDIR`, so it survived the sweep. The gate should fail CLOSED: if
`RESULT_DIR` is empty or unwritable, or if `proven + non-provable != candidates
- static`, it must exit non-zero rather than report OK.

Every green mutation-gate result obtained inside a CC sandbox since this was
introduced is meaningless. That includes any local pre-push run.

### Worker-reported, NOT conductor-verified

Recorded with attribution because they were not independently re-run here:
- fence: `tests/integration/test-cc-triage.sh` 80 passed / 0 failed, and 72
  passed / 8 failed with the fix reverted, i.e. the test is not a both-ways pass.
- fence: a second live bug fixed in the same branch,
  `scripts/cc-consolidate-milestones.sh:56` querying `milestones?state=open`,
  which would 422 against a closed umbrella. The sibling script was already
  fixed at HEAD; this one had been missed.
- ccboard: TS2305 on `SOURCE_DIGEST` was not a design mismatch. The generator
  and generated file were already consistent; the error came from typechecking a
  tree without the staged file. Four unrelated pre-existing TS errors remain in
  docs/site (missing `posthog-js`, ungenerated `@/.source/server`).
- ccboard: two-sided gate proof reported, FAIL on a reverted generated file and
  PASS after regeneration.
- epicd: binary probe of the shipped 2.1.237 provisioner confirms
  `.worktreeinclude` semantics (gitignore syntax, matched only against
  `git ls-files --others --ignored --exclude-standard --directory`).

### Still open, and all of it needs operator consent

1. Nothing is pushed and no PR exists for any of the four branches.
2. Dispatching `claude-release-watch` to actually pull 2.1.232 through 2.1.237.
   Spends the SHARED weekly Claude quota. Manual by design.
3. #3571 still needs its PR body to gain an `## Interactive Playground` section,
   an outward-facing GitHub write.
4. #3570 still needs the rebase-and-rebuild over its 4 conflicting dist files.
5. The mutation-gate fail-open defect above needs an issue.
6. The worktree and dirty-file reaping from Entry 1 is untouched.

---

## Entry 4 (2026-08-20): shipped and verified in production

All actions in this entry were operator-approved. Every claim was re-derived by
the conductor from git and the GitHub API, not taken from a worker's report.

### The fence fix is PROVEN, not merely tested

The watcher was dispatched against `ref: fix/cc-watch-fence-parse`, deliberately
NOT `main`. Dispatching main would have checked out main's still-broken
`scripts/cc-triage.mjs`, hit the same `JSON.parse`, and burned the operator's
shared weekly quota re-sentineling every version.

Run 32350918138, head_branch fix/cc-watch-fence-parse: **conclusion success**.
It is the first successful adoption sweep since 2026-07-30.

All six previously-missing snapshots now exist on the branch:

    2.1.232  2.1.233  2.1.234  2.1.235  2.1.236  2.1.237   all PRESENT

More importantly, the triage stage back-filled `features[]` for entries that had
been empty for weeks:

    version   features   bullets
    2.1.229       7        32
    2.1.224      12        31
    2.1.223      12        19
    2.1.221      11        39
    2.1.225       6        14
    2.1.222       6        21
    2.1.226       0         1     genuinely empty
    2.1.219       0        24     parse_failed, below floor

This CONFIRMS Entry 2's correction and refutes #3492's original premise beyond
argument. Those arrays were empty because the triage stage had not run, not
because the waves were empty. The moment the parse bug was fixed and triage
executed, real adoptable features appeared in six of eight entries.

### Pull requests

| PR | branch | state | real reds |
|---|---|---|---|
| #3570 | fix/worktree-verifier-stale-base | CLEAN | 0 |
| #3571 | fix/3322-sandbox-paste-block | BEHIND | 0 |
| #3580 | fix/cc-watch-fence-parse | checks re-running | 0 |
| #3581 | fix/3492-cc-board-drift | CLEAN | 0 |
| #3582 | feat/3309-adopt-cc-settings | CLEAN | 0 |

The only NOT-PASS on any of them is "Enable auto-merge for Dependabot" =
`skipped`, correct because none is a Dependabot PR. #3580 momentarily shows zero
checks because the watcher run COMMITTED snapshot 58519b412 back to its branch,
moving the head SHA; CI re-runs against the new head.

#3570 is the largest movement of the session: it went DIRTY/CONFLICTING to CLEAN,
and its check-run count went from 1 to 44. CI had never actually run on that PR
before today. Its four conflicts were all generated `dist` output and were
resolved by rebuild, never by hand-merging bundles.

Issue #3583 filed for the mutation-gate fail-open defect.

### The PR Playground gate, now understood exactly

Worth recording because it nearly landed three red PRs. `.github/workflows/ci.yml`
job `playground-check`, REQUIRED, has TWO gated steps:
- `ci.yml:292` requires `docs/<head_ref with / replaced by -->/` to exist with at
  least one `.html` in the merge ref.
- `ci.yml:318` greps the PR BODY case-insensitively for the substring
  `playground`. No heading or link format is actually enforced by the grep,
  despite what the error message suggests.
Exemptions: bot authors, branch prefixes `dependabot/|release-please|renovate/|
chore/cc-snapshot-|ci/`, fork PRs, or a diff where every changed file matches the
inert regex at `ci.yml:262`.

Also load-bearing: `ci.yml` declares `on: pull_request` with no `types:`, so it
defaults to opened/synchronize/reopened. **A body edit does NOT re-trigger CI.**
Clearing this gate by editing a body always requires an explicit re-run of the
failed job afterwards.

### NOT DONE: worktree prune is blocked at the OS level

`git worktree prune` fails on all three stale registrations:

    error: failed to delete '.git/worktrees/3558-visual-budget': Operation not permitted
    error: failed to delete '.git/worktrees/runner-mktemp': Operation not permitted
    error: failed to delete '.git/worktrees/3559-pipe-file-operand': Operation not permitted

Attempted by a subagent and again by the conductor with the sandbox disabled.
Identical EPERM both ways, so this is NOT a sandbox artifact.

A worker ruled out ownership, permissions, ACLs, file flags, content, and the git
binary itself: synthetic stale registrations created in the SAME directory were
pruned cleanly in the SAME invocation. The denial is keyed to those three exact
paths or inodes. Mechanism unresolved.

Note a second fail-open, same shape as #3583: **`git worktree prune` exits rc=0
while deleting nothing.** A caller checking only the exit code would record a
successful prune.

Impact is cosmetic: `git worktree list` reports 3 phantom `prunable` entries and
those three names cannot be reused by `git worktree add`. All three branches
survive at their original shas (7b764647e, ab3debee1, 889664973). Resolving it
needs either a plain terminal outside Claude Code, or explicit approval for a
targeted removal of the three `.git/worktrees/<id>` metadata directories.

### Safety invariants, re-measured after every destructive step

- 5 orphan directories deleted; the other 8 worktrees untouched.
- All three pruned-target branches still resolve at their original shas.
- `MUTATION_BASELINE=2` unchanged at mutation-gate.sh:79.
- The parked `.claude/settings.local.json` is still 1886 bytes, mtime
  2026-08-19 10:11, never read or modified.
- Local `main` unmoved at 4fb82d5a3; primary tree has zero tracked changes.
- No PR merged. No branch deleted, local or remote.

### Follow-ups

1. Merge order: all three new PRs touch
   `docs/site/lib/generated/lab-data.ts`. The second and third to merge will
   conflict there. It is generated, so resolve by re-running
   `docs/site/scripts/generate-lab-data.mjs`, never by hand. This matters more
   after #3581 lands, since that is what makes the drift gate start watching it.
2. #3571 is BEHIND and needs an update from main.
3. `docs/fix--worktree-verifier-stale-base/base-ref-verdict.html` is not
   registered in `docs/site/lab-manifest.json`, so it passes the gate but will
   not appear at /docs/showcase/lab.
4. The worktree-prune EPERM above.
5. Reaping the remaining worktrees and the 12 dirty files from Entry 1 is still
   untouched, by operator choice.

---

## Entry 5 (2026-08-20): two defects fixed and landing

### MERGED

`#3626 fix(security): make the mutation gate fail closed` merged at 18:56:03Z as
`803808c92`. Verified merged == true, not assumed.

This is the highest-severity find of the session. `tests/security/mutation-gate.sh`
could report a green OK having scored ZERO of thirteen tests, because
`mktemp -d -t` at line 116 ignores `$TMPDIR` on darwin; when denied, `RESULT_DIR`
became the empty string and the reduce loop read nothing back. It also advised
lowering `MUTATION_BASELINE` to 0, which would have zeroed a security ratchet on
a measurement that never happened.

Two fail-closed guards landed: a TMPDIR-honouring mktemp template with a refusal
when the scratch dir is unwritable, and an accounting check that every candidate
must produce exactly one result file. `MUTATION_BASELINE` stays 2.

### IN FLIGHT

`#3625 fix(hooks)` PostToolUseFailure event name. Conflict with the newly-merged
main resolved, pushed as merge commit `f34d2fd1b`, 18 checks running, 0 red.

The operator found this one from a screenshot of an unrelated session. `hooks.json`
registers `posttool/failure-handler` on `PostToolUseFailure`, but that handler
returns `outputWithContext()`, and `lib/output.ts` hardcoded
`hookEventName: 'PostToolUse'`, so CC rejected the envelope. Fixed with an
OPTIONAL second parameter defaulting to `'PostToolUse'`, so all 40 other callers
are untouched.

### Verification the conductor performed rather than trusting

- `#3625`'s regression test is genuinely falsifiable: 5 pass with the fix, and
  reverting ONLY the two source call sites gives 3 failed / 2 passed. It is not
  test theater, which mattered given the sibling PR is about tests that cannot fail.
- `#3625` diff: default still `'PostToolUse'`, both call sites updated, zero
  suppression-shaped added lines.
- The `lab-data.ts` conflict was resolved by RE-RUNNING the generator, never by
  hand, and both playground entries are present (13 total). Re-running the
  generator a second time leaves `lab-data.ts` byte-identical.

### A false proof caught before it shipped

An "unwritable TMPDIR" test was built as evidence for the fail-closed fix. The
control refuted it: the UNPATCHED gate also exits 1 under that condition, for an
unrelated reason (every test scores NO_ASSERTION). So it demonstrates nothing
about the fail-open. The real evidence is the in-sandbox paired probe. This is
recorded because shipping it would have been exactly the test theater the gate
exists to catch.

### Near-miss: a generated file almost reformatted

The first `json.dump` write of `docs/site/lab-manifest.json` reformatted the whole
file: em-dashes escaped to `—` and every inline `tags` array exploded, giving
+95/-23 for what should be one entry. Against the three other PRs touching that
file it would have caused avoidable conflicts. Rewritten as a text append: +8
lines, no reformatting. Lesson: never round-trip a hand-formatted JSON file
through a serializer to add one entry.

### Confirmed harmless

`cc-adoption-data.ts` changes on every generator run because `GENERATED_AT`
stamps the HEAD commit. That is the self-invalidating stamp `#3581` replaces with
a content digest. Not drift, and not a blocker.

### The gh x509 question, settled

Not fixable by any PR in this repo. Measured: `curl` reaches api.github.com via
`remote_ip=127.0.0.1`, so a local MITM proxy is the ONLY route out; clearing the
proxy vars gives no route at all. `gh` is Go, and Go on darwin always verifies
through the macOS platform verifier, which is blocked, so it fails with x509
OSStatus -26276 both inside AND outside the sandbox. Node carries its own CA
bundle, so `NODE_USE_ENV_PROXY=1 node` plus `gh auth token` works: that is how
every API read, PR and merge in this session was performed.

The durable fix is machine-level (exempt api.github.com from interception, or
install the proxy CA where the platform verifier can see it). Do NOT install a
MITM CA as system-trusted to fix one CLI: that grants machine-wide interception
of all TLS.

### Merge-order note for whoever continues

Branch protection has `required_status_checks.strict = true` with 18 required
contexts. Every merge to main re-stales every other open PR, so N open PRs cost
roughly N x 18 checks to land, serialized. That is the structural reason a wide
PR set starves a shared 4-box runner pool, independent of who opened them. Update
and merge ONE PR at a time; never refresh them all at once.

---

## Entry 6 (2026-08-21): arc complete

### Merged this arc, all API-verified

| PR | what | merge sha |
|---|---|---|
| #3570 | worktree verifier base against origin | 6d3640a23 |
| #3626 | mutation gate fails closed (#3583) | 803808c92 |
| #3625 | PostToolUseFailure event name | e05d703c9 |
| #3580 | fenced-JSON parse fix + snapshots 2.1.232-237 + back-filled gaps | 0a3d19ad0 |
| #3571 | falsifiable sandbox detection probe | b657863d2 |
| #3581 | board digest (SOURCE_DIGEST replaces GENERATED_AT stamp) | ac27a8661 |
| #3582 | .worktreeinclude + baseRef + spawn-depth pins (EPIC D 3-of-5) | db653369c |

Open for operator review: #3631 (sandbox violation-log doctor check),
#3633 (scripts/gh-api.mjs helper). #3624 is release-please's.

### Two safety-classifier warnings, resolved by conversation context

The #3581 merge and the settings allowlist edit were both flagged post-hoc
(merge-without-review, self-modification). Both were explicitly named and
approved by the operator in an AskUserQuestion in this session ("Merge both,
serially" and "Helper + allowlist entry"). The classifier cannot see
conversation context; the authorization exists and is recorded here.

### Findings from the tail

- orchestkit's .claude/settings.json is GITIGNORED (deliberate, per the
  tracked-settings-freezes-plugin-config memory), so the api.github.com
  allowlist entry is LIVE LOCAL CONFIG, quoted in #3633's body for review,
  not shipped in the diff. Sessions pick it up only on restart.
- NODE_USE_ENV_PROXY must be set AT LAUNCH; setting process.env inside the
  script does not engage the proxy (measured: ENOTFOUND). gh-api.mjs
  self re-execs to handle this.
- The Go TLS failure generalizes: terraform fails with the identical
  OSStatus -26276; kubectl fails "unknown authority" (same layer, second
  flavor, plausibly cgo vs pure-Go). Every Go binary doing TLS is broken in
  CC panes; per-tool workarounds do not scale.
- CC's own Seatbelt denies WITHOUT unified-log rows (measured during #3631):
  zero reported violations is not proof of zero denials. The doctor check
  says so instead of claiming coverage.

### Still open (operator decisions)

1. Review and merge #3631 and #3633.
2. Upstream filings on claude-code: (a) .mcp.json filename-deny breaks
   git worktree add in vendoring repos; (b) securityd IPC denial kills all
   Go TLS. Both evidence-complete, drafts on offer.
3. Platform-side .mcp.json template rename (their lane; ten sessions
   currently share one tree there because worktrees die at checkout).
4. Reap the now-merged worktrees/branches (needs per-target approval).
5. MEMORY.md compaction (20.6KB approaching the 24.4KB limit).
6. docs/conductor-ledger.md itself: untracked, needs public-repo review
   before any commit.

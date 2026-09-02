# CC adoption triage: 2.1.258 (2026-09-02)

Method: hand triage in lane `adopt-cc-258`, reading both bullets of 2.1.258 against ork's real surfaces at HEAD `11decaa77` (hook sources and their platform checks, the headless `claude -p` callers in `.github/workflows` and `tests/evals`, `shared/cc-support.json`). The snapshot `shared/cc-snapshots/2.1.258.md` was written by `scripts/cc-release-watch.mjs` from the upstream CHANGELOG fetched 2026-09-02 (`CC_RELEASE_WATCH_FIXTURE`, because `claude-release-watch` is dispatch-only); the watcher parsed 383 versions and carried the 2.1.252 and 2.1.257 entries. The bullet text names 2.1.255 as the origin of the macOS regression; no 2.1.253 to 2.1.256 entry exists in the CHANGELOG, so those builds shipped without notes.

Every VERIFIED claim below names the command or file that established it; everything else is read from the changelog (CLAIMED).

Result over the 2 rows: adopted 0, deferred 0, upside 1, noop 1.

## Disposition vocabulary

Same as `docs/audits/cc-adoption-2.1.252-257-triage-2026-09-01.md`: `adopted-in-pr`, `adopted-doc`, `deferred-S`, `upside`, `watch`, `triaged-noop`, `triaged-noop-cc-native`.

## 2.1.258

| feature key | category | relevance | ork | hq-ext | ork note |
|---|---|---|---|---|---|
| `macos_12_launch_regression_fix` | breaking | end-user | triaged-noop | upside | ork declares no macOS version floor and no hook branches on the OS release (VERIFIED, see evidence). The five `process.platform` checks in `src/hooks/src` pick a notifier by platform, not by version. Nothing to change; Monterey users regain a binary that starts. |
| `remote_scheduled_session_resent_approval_fix` | breaking | end-user | upside | upside | Free. Every headless caller in ork is a local `claude -p` (seven workflows plus `eval-common.sh`), which is neither a remote (Remote Control) nor a scheduled (cloud routine) session. The error text appears nowhere in ork's own code or docs. |

## Evidence index (VERIFIED in this lane)

- `claude --version`: 2.1.258 (Claude Code). Host macOS 26.6.2, so the Monterey path itself was not exercised here.
- `grep -rniE 'monterey|macos 12|macOS12|darwin 21' src shared tests scripts manifests CLAUDE.md` (snapshots and the gaps feed excluded): 0 hits.
- `grep -rniE 'os\.release\(\)|process\.platform|darwin' src/hooks/src -l` (tests excluded): `notification/desktop.ts`, `notification/sound.ts`, `permission-denied/denial-notification.ts`, `setup/setup-repair.ts`, `setup/first-run-setup.ts`. All five branch on platform to choose osascript, afplay or a shell notifier; none reads a version.
- `grep -rniE 'non-empty content|re-?sent permission|resend.*approval' src shared/rules tests scripts`: 3 hits, all unrelated (`analytics/SKILL.md:69` and `analytics/references/otel-fields.md:224` describe OTEL files with non-empty content; `tests/skills/scripts/test-script-structure.sh:239` is a pass message).
- `grep -rln 'claude -p\|claude --print' .github/workflows tests/evals/scripts/lib scripts`: `labs-version-watch.yml`, `plugin-validation.yml`, `ci-sentinel.yml`, `claude-health.yml`, `claude-release-watch.yml`, `skill-eval.yml`, `claude-triage.yml`, `budget-governor.sh`, `eval-common.sh`, `probe-command-discovery.sh`. All local `claude -p`.
- `grep -n '2\.1\.25[3-6]' CHANGELOG.md` (upstream, fetched 2026-09-02): one hit, the 2.1.258 bullet naming 2.1.255.

## Not done here, by design

- No `gh issue create`: there is nothing to defer, so nothing to file.
- `configure/references/cc-version-settings.md` is untouched: 2.1.258 adds no settings key, env var, hook event, tool or permission surface.
- hq-ext's ledger is not touched by this lane.

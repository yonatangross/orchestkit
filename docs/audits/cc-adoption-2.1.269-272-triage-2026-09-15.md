# CC adoption: 2.1.269 to 2.1.272 (2026-09-15)

Refs GH-4135. Scope: the tracker's Matrix and floor section.

Base: `205cea7c86d905e1a8522eecd1b91bb6c964fed4`.
The support file and version constant both started at latest_known 2.1.263.
The supported floor, latest and drop_after remain 2.1.251, 2.1.251 and 2.1.250.
The manual override expires on 2026-11-20.

## Release dispositions

Source: the [upstream CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), fetched through the GitHub contents API on 2026-09-15. Tavily extraction returned stale notes ending at 2.1.263, so the live GitHub response supplied the release text.

| Release | Disposition | Scope |
| :--- | :--- | :--- |
| 2.1.269 | Documentation only | Plugin eval already piloted; output-style restored; Bash edit diffs; four environment variables; plugin archive permission fixes. Design and probe items stay in GH-4135. |
| 2.1.270 | Not applicable | Fix for read-only git commands unexpectedly requesting permission. |
| 2.1.271 | Documentation only | Agent CLAUDE.md omission; auto mode inline shell and hand-back rules; per-command domains; Monitor deadlines; hook feedback; plugin command consent in GH-4054. |
| 2.1.272 | Triaged noop | One unenumerated bug fixes and reliability improvements bullet. |

The doctor matrix records all four releases and supersedes the historical 2.1.73 output-style deprecation. Configure documents six settings and environment entries. Per-feature implementation remains in GH-4135.

## Generated artifacts

The existing support stamper propagates latest_known to the TypeScript constant.
The release watcher consumes the live 2.1.272 section to capture the snapshot and issue arguments. The gaps ledger records an explicit noop for that release and preserves every existing entry.
The repository build regenerates plugin references, site MDX and adoption data. The Lab manifest generator assembles the new adoption page.

No tests pin latest_known to 2.1.263 on this base, so no test assertion needs an edit.
Local verification is limited to the existing floor consistency test, version matrix unit test and Lab manifest check. CI supplies the broader verification.

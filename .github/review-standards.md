# Review standards (orchestkit)

<!--
Read by the review pass only (/ork:review-pr <PR> --standards). Builders do not
load this file. At most 20 rules and 3 KB (tests/unit/test-review-standards-pass.mjs).
One rule per bullet; a leading [glob] limits a rule to matching paths. Findings
name the rule as S<n> with its line here.
-->

- A new or changed test must fail when the code it guards is wrong; a test with no failing case, or one that matches its own text, is a finding.
- [tests/**/*.sh] A shell lint must not read `cmd | grep -q` under pipefail; grep a file or a variable instead.
- Never commit `src/hooks/dist/` or `plugins/ork/hooks/dist/`.
- [src/hooks/src/**] A new hook handler must not import `node:fs`; side effects go through `lib/` and injected deps.
- [.github/workflows/**] Always pin every third-party GitHub Action by full commit SHA, with the version in a comment.
- [.github/workflows/**] A CI step that reaches the network must have `timeout-minutes` and a bounded retry.
- A test must resolve packages from a package.json that declares them.
- Never use an em dash or an en dash in prose, comments or docs.
- Every new page under `docs/` must have a `data.json` with a `serves` field.
- Never edit `plugins/` by hand; edit `src/` and `manifests/` and stage the regenerated `plugins/` diff with the source change.

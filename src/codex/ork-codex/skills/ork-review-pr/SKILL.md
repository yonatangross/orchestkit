---
name: ork-review-pr
description: Review a pull request or branch for correctness, regressions, security, operational risk, and missing evidence. Use when a request asks to review a PR, review a diff, find real bugs, assess merge risk, or provide evidence-backed review findings. Do not use for implementation or style-only cleanup.
---

# Ork Review PR

Stay read-only and review the actual diff in its repository context. Read the applicable instructions, trace changed behavior to its callers and tests, and prioritize correctness, security, data loss, race conditions, backwards compatibility, and evidence gaps over style.

Use one reviewer for a focused diff. For a broad or high-risk PR, fan out independent read-only passes for code-path mapping, risk review, and documentation/API verification; each must return file and line evidence. Prefer `ork_reviewer` when installed, otherwise use a fresh built-in explorer/reviewer role.

Lead with findings ordered by severity. Every finding needs a concrete location, impact, and a reproduction or reasoning path. If there are no findings, say what was checked and what was not. Do not modify files or approve/merge the PR.

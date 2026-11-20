---
name: ork-create-pr
description: Push the current feature branch and open a pull request with a conventional title and a summary of what changed and how it was verified. Use when a request asks to open, create, or raise a PR or merge request, including a PR stacked on another open PR. Do not use to review, merge, or rebase a PR.
---

# Ork Create PR

Refuse to open a PR from the default branch or with a dirty working tree. Derive the base from the remote (`git symbolic-ref --short refs/remotes/origin/HEAD`); never hardcode `main` or `dev`. For a PR stacked on another open PR, the base is the parent branch and the body says "Stacked on #N. Do not merge into the parent branch."

Before pushing, run the repository's own checks for the changed area (tests, lint, types), using the commands its instructions name. Report each command and its summary line. A failing check is reported, not hidden; do not open the PR as ready while a check you ran is red.

Detect the host from `git remote -v`: GitHub uses `gh pr create`, GitLab uses `glab mr create`, Bitbucket uses its web flow. Title: `type(scope): subject` under 72 characters, matching the commits. Body: what changed, why, how it was verified (the commands and their results), what was not checked, and the linked issue.

Open as a draft unless asked otherwise. Never merge, never force-push, never enable auto-merge without being asked. Finish with the PR URL and its state.

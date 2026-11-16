---
name: ork-commit
description: Create one Conventional Commit of the intended changes on a feature branch, with the repository's own hooks and signing left on. Use when a request asks to commit, save progress as a commit, or write a commit message. Do not use for incidental commits inside other work, to push, or to open a pull request.
---

# Ork Commit

Refuse to commit on the default branch (`main`, `master`, `dev`, or what `origin/HEAD` names); ask for a feature branch instead. Read `git status` and `git diff --staged` first, and stage only the files that belong to the change. Never stage secrets, `.env` files, credentials, or a diff that is only generated output.

Write the message as `type(scope): subject`, with type one of feat, fix, docs, refactor, test, chore, perf, ci, build. Keep the subject under 72 characters and match the type to what the diff does. Reference the issue number (`#N`) when the branch names one. Add a short body that says why when the subject cannot.

Run the commit with the repository's hooks and signing as configured. Never pass `--no-verify` or `--no-gpg-sign`, and never change the signing config. If a hook or the signer fails, report its exact output and stop; fix the cause, then commit again.

Finish by showing `git log -1 --stat`, so the files in the commit are visible. Do not push.

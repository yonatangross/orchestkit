---
description: "Diagnose a failing CI run against a 10-pattern playbook. Classifies the failure, cites the relevant memory entry, proposes the exact fix command — but NEVER applies without explicit user approval. Use when a specific PR check or GitHub Actions run failed and you want a diagnosis instead of speculation. Don't use for org-wide CI sweeps (that's /status) or for app-level test failures (the playbook is CI-infra-specific)."
allowed-tools: [Bash, Read, Grep, Glob]
---

# Auto-generated from skills/ci-debug/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# /ci-debug — classify a failing CI run

Direct response to the recurring CI-debug pattern surfaced by `/insights`: ~12 sessions in 3 weeks doing the same classification dance. This skill encodes the 10 patterns so the dance becomes a lookup.

## Input

User invokes with one of:

- **PR number**: `/ci-debug 822` (default repo from context; ask if ambiguous)
- **Run URL**: `/ci-debug https://github.com/owner/repo/actions/runs/12345`
- **Job URL**: `/ci-debug https://github.com/owner/repo/actions/runs/X/job/Y`

## Execution

### 1. Resolve the failing job

```bash
# From PR number:
gh pr checks <n> --repo <owner>/<repo> --json bucket,link,name \
  --jq '.[] | select(.bucket=="fail") | "\(.name)|\(.link)"'

# From run URL:
gh api repos/<owner>/<repo>/actions/runs/<run-id>/jobs \
  --jq '.jobs[] | select(.conclusion=="failure")
                | {id, name, runner_name, started_at, completed_at,
                   steps: [.steps[] | select(.conclusion=="failure") | {name, number}]}'
```

If multiple jobs failed, pick the one with the **shortest duration** — root cause is usually the first failure; later jobs cascade.

### 2. Fetch the failing log

```bash
gh api repos/<owner>/<repo>/actions/jobs/<job_id>/logs 2>&1 \
  | grep -iE '(error|fail|ERR_|CONFLICT|Process completed with exit code)' \
  | head -30
```

Capture the **FIRST distinct error message** (later lines often echo).

### 3. Classify against the playbook

Walk the patterns in order. **First match wins.**

| # | Pattern | Signature in logs | Memory ref | Proposed fix |
|---|---------|-------------------|------------|--------------|
| 1 | **Billing block** | runner_name empty + steps[] empty + ~3s duration + annotation: "recent account payments have failed or your spending limit needs to be increased" | `billing-surface-hosted-vs-self-hosted.md` | Org admin → Settings → Billing & plans → raise limit / update card. No code change. |
| 2 | **Root-lockfile drift** | `ERR_PNPM_OUTDATED_LOCKFILE` mentioning `<ROOT>/typescript/<pkg>/package.json` | `pnpm-lock-root-vs-workspace-duality.md` | `pnpm install --lockfile-only && git add pnpm-lock.yaml && git commit && git push`. |
| 3 | **uv.lock drift** | `error: The lockfile at uv.lock needs to be updated` | `changeset-release-uv-lock-drift.md` | `cd python && uv lock` then commit. |
| 4 | **ci-shared.yml missing permissions** | startup_failure pattern (empty runner_name + steps[]=[] + ~3s) BUT billing is resolved | `ci-shared-permissions-block-required.md` | Add `permissions: { contents: read, packages: read }` to the caller workflow. |
| 5 | **YAML python embed** | YAML parse error pointing at a multi-line block scalar with `python -c` | `yaml-python-embed.md` | Rewrite `python -c` as a separate shell script invocation; never inline multi-line python in YAML. |
| 6 | **actionlint shellcheck false-positive** | audit/actionlint job failing with SC2086/SC2046 on workflow YAMLs you didn't touch | `audit-actionlint-triggers-on-workflow-edit.md` | Not required check; safe to merge past if the warnings predate your change. Optional: add shellcheck disable comments. |
| 7 | **macOS BSD date %3N** | `%3N` printed literally in CI output / arithmetic fails | `macos-bsd-date-no-percent-3N.md` | Replace `date +%s%3N` with `node -e 'console.log(Date.now())'` or `python3 -c 'import time; print(int(time.time()*1000))'`. |
| 8 | **Runner pnpm Rosetta arch drift** | pnpm install fails with "wrong-arch native bin" / dlopen error on a self-hosted runner | `runner-pnpm-rosetta-arch-drift.md` | Restart the affected runner pool; root cause is node x64↔arm64 flips storing wrong-arch native bins in shared cache. |
| 9 | **Shallow clone false divergence** | `git status` reports diverged but PR was actually merged | `shallow-clone-false-divergence.md` | `git fetch origin <branch> --unshallow` then `gh pr view --merge-commit` to verify. |
| 10 | **Publish run cancelled** | Publish-tag workflow run shows `conclusion=cancelled`; artifact never lands | `publish-runs-cancelled-need-redrive.md` | Re-fire via `gh workflow run publish-python.yml -f tag=<tag>` (adjust for your publish workflow). |

The memory references point at user-curated memory files (`~/.claude/projects/<project>/memory/*.md`). If your memory doesn't have them yet, the signature column is enough to classify — the memory citation is a nice-to-have, not required.

### 4. Report

For a **matched** pattern:

```markdown
## CI Debug: <repo> · <pr-or-run-ref>

**Failing job:** `<job name>` (<duration>s) on runner `<runner_name>`
**Failing step:** <step name> (#<step number>)
**Error excerpt:**
\`\`\`
<first 3 lines of grep'd error>
\`\`\`

**Classification:** Pattern #<n> — <pattern name>
**Reference:** memory `<memory-file.md>`

**Proposed fix:**
<exact commands, one per line>

**Will I apply this?** No — awaiting your approval. Reply "go" to ship.
```

For an **UNMATCHED** failure:

```markdown
## CI Debug: <repo> · <pr-or-run-ref> · NOVEL

**Failing step:** <step name>
**Unique log lines:**
\`\`\`
<top 10 distinct error lines>
\`\`\`

This doesn't match any of the 10 playbook patterns. Surfacing the raw
evidence for your read. Once you identify the root cause, consider
adding it to the playbook (in this SKILL.md) so the next run catches
it automatically.
```

## CRITICAL guardrails

- **NEVER auto-apply a fix.** This skill proposes; the user approves. Wasted cycles from misclassification are exactly the failure mode we're hardening against.
- **NEVER skip the fetch-log step.** Without the actual error text, classification is guessing. If logs are gone (>90 days old, run deleted), say so and stop.
- **Cite the exact memory entry** (filename + section heading where relevant) so the user can verify the analogy.
- **Each classification must have falsifying evidence** — the signature must match. Don't pattern-match on hope.

## When to invoke

- A specific CI run / job / PR check has failed and the user wants the diagnosis.
- The user pastes a run URL or "PR #N is failing — why?".

## When NOT to invoke

- For broad "what's failing across the org?" — use `/status` instead.
- For application-level test failures (the playbook is **CI-infra-specific**, not e.g. pytest failures).
- Before reading the actual log — don't speculate.

## Adding patterns

When a novel CI failure surfaces (the UNMATCHED report fires), add a row to the table above:

1. **Signature**: the unique-enough log line / metadata combination. Must be falsifiable.
2. **Memory ref**: name the memory file you wrote with the full incident write-up.
3. **Proposed fix**: the EXACT command line. No prose, no "you might want to". The skill produces commands the user runs; ambiguity defeats the purpose.

Commit the SKILL.md change as `docs(ci-debug): add pattern #N (<short-name>)`. The `/ork:ci-sentinel` workflow picks up new patterns automatically on its next sweep — no separate plumbing needed.

## Related Skills

- **Composes with** — `/ork:ci-sentinel` (the autonomous hourly trigger for this skill against open red PRs).
- **Anti-pattern** — manually re-running `gh pr checks` and eyeballing the logs across N repos. That's exactly the toil this skill kills.
- **Upstream** — `/status` for org-wide sweeps that surface WHICH PRs are red; this skill answers WHY.

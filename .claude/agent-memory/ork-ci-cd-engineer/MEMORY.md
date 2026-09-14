# CI/CD Engineer Memory - OrchestKit

## GitHub Actions Patterns

### Action Pinning
- **Pattern**: Use full SHA-256 commit hash, not tag or major version
- **Format**: `uses: action@<40-char-sha>  # vX` (comment indicates version for readability)
- **Security**: Prevents supply chain attacks, tag spoofing, unexpected major updates
- **Tooling**: Can verify SHAs with `gh api repos/OWNER/ACTION/commits` if needed

### GITHUB_OUTPUT Quoting
- **ANTI-PATTERN**: `ENV_VAR: '{"key": ${{ steps.id.outputs.value || 0 }}}'` (breaks if value empty)
- **PATTERN**: `ENV_VAR: '{"key": ${{ steps.id.outputs.value || 0 }}, ...}'` inside quotes + numeric fallback
- **Key insight**: `||` operator evaluated at YAML parse time by GitHub Actions runtime, not bash
- **Trap**: Leaving empty substitution creates invalid JSON, jq parsing fails silently
- **Solution**: Always provide numeric fallback `|| 0` or `|| "default"`

### Job Summary Rendering
- **Old way**: Embedded Markdown in jq filters (fragile, quoting nightmare)
- **New way**: Generate Markdown file during build, cat into `$GITHUB_STEP_SUMMARY`
- **Benefit**: Type-safe (Markdown in source code), easier debugging, no jq escaping
- **Location**: `$GITHUB_STEP_SUMMARY` is auto-created file in step sandbox

## CI/CD Scoring Formula

### Coverage Thresholds (OrchestKit)
- **Target**: 75% (matches devops-deployment skill standard: "70% + gated")
- **Graduated penalties**: <50% (-20), <60% (-15), <70% (-10), <80% (-5), ≥80% (no penalty)
- **Why graduated**: Honest assessment, encourages incremental improvement
- **Note**: Average of lines/functions/branches/statements (4-way metric)

### Score Penalties (Full Scale)
- Build failure: -30 (most critical)
- Test failure: -5 each (max -30)
- Lint error: -2 each (max -20)
- Security critical: -10 each (UNCAPPED - major issue!)
- Security high: -5 each (UNCAPPED)
- Grade scale: A=90+, B=80+, C=70+, D=60+, F=<60

### Key Insights
- Honest scoring = better team buy-in than inflated grades
- Uncapped security penalties mean single 0-day is devastating (correct behavior)
- Skipped tests light penalty (-1 each) to discourage masking issues

## Windows CI Failures Pattern

### Common Issues
1. **Path separators**: `/` vs `\` in scripts called by bash
2. **Line endings**: CRLF vs LF can break test discovery
3. **Coverage generation**: vitest/istanbul may not write coverage-summary.json on windows
4. **Shell compatibility**: windows-latest defaults to PowerShell, need `shell: bash`

### OrchestKit Specific
- Coverage threshold jump 20% → 75% may expose windows-specific test gaps
- `npm test` on windows may not find tests (needs `shell: bash` in step)
- Symlink handling different on Windows (validated in build-plugins job)

## Artifact Retention Strategy

### OrchestKit Retention Policy
- **1 day**: Built plugins (regenerated each run, space efficient)
- **30 days**: CI reports, coverage reports, eval results (audit trail)
- **90 days**: Comparison results for trend analysis (evals only)

### Rationale
- Short: Built artifacts can be regenerated, save storage
- Medium: Reports useful for debugging PRs within sprint
- Long: Comparison data tracks drift over months (important for quality)

## Pre-push Hook Lessons Learned

### Timeout Handling
- `perl -e "alarm N"` broken for npm on macOS (background process exits with code 142)
- Use `set -o pipefail` carefully with `git diff` (returns non-zero when diffs exist)
- Don't use `"$@"` with timeout - just run directly

### Build State Management
- Pre-push hook cleans `plugins/` during build
- If hook fails mid-run, `plugins/` left empty (corrupted state)
- Must `npm run build` before retry, or pre-commit hook validation fails

### Pipefail Pitfalls
- `git diff | grep` fails with pipefail because `git diff` exits 1 when differences exist
- Solution: `_VAR=$(git diff ... || true)` then `echo "$_VAR" | grep`
- Alternative: `[[ "$_VAR" == *"pattern"* ]]` bash pattern matching (no pipe, no subprocess)

## Version Bump Logic

### File Exclusions
- **Include in version check**: .github/workflows/*.yml, manifests/*.json
- **Exclude from version check**: *.md (docs only), *.txt (readme/license), /docs/* folder
- **Rationale**: Workflow changes ARE code changes, need version/changelog tracking

### Version Bump Script
- Located: `./bin/bump-version.sh` [patch|minor|major]
- Updates: manifests/ork.json version, CLAUDE.md, CHANGELOG.md template
- User must: Fill in CHANGELOG entry manually with actual changes

## Evaluation Workflow Patterns

### Golden Tests (eval-index-effectiveness.yml)
- **Dry-run mode**: Validates YAML schema only (no Claude CLI needed)
- **Full evaluation**: Requires Claude CLI, measures agent routing accuracy
- **Two-branch approach**: with-index vs without-index, measures effectiveness
- **Retention**: 30 days eval results, 90 days comparison (for trend analysis)

### Regression Detection
- Compares metrics: build%, lint%, test%, agent routing%
- Dynamic thresholds preferred over static (context-aware)
- Posts results to PR comment with Delta column

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Job timeout | 5-30 min | Prevents hanging, matches GitHub defaults |
| Matrix OS | ubuntu, macos, windows | Covers CI/dev/prod environments |
| Matrix Node | 20, 22 | LTS + Current; drop 18 (deprecated Apr 2025) |
| Artifact retention | 1/30/90 days | Balance storage cost vs audit needs |
| Coverage threshold | 75% | Aligns with devops-deployment skill |
| Report format | JSON+HTML+MD | Three views for different users |
| Security scanning | npm audit + gitleaks | Covers deps + secrets |
| Action versions | SHA pins | Supply chain security |

## Troubleshooting Guide

### If Windows Tests Fail
1. Check if `shell: bash` specified on step
2. Look for coverage-summary.json generation (verify src/hooks/vitest.config.ts)
3. Run locally on Windows machine to debug
4. Check npm/node version differences (use `node --version` in step)

### If CI Report Generation Fails
1. Verify `scripts/generate-ci-report.ts` compiles (npx ts-node)
2. Check environment variables all passed (CI_TEST_RESULTS, etc.)
3. Ensure markdown generation function exists (generateMarkdown)
4. Fall back to manual step summary if needed

### If Action SHA Verification Fails
1. Verify SHA format: exactly 40 hex characters
2. Check against `gh api repos/OWNER/ACTION/commits`
3. Action may have been deleted/archived (use older major version)
4. Compare with previous working SHAs in other workflows

## New-Workflow Review Checklist (distilled from PR #589)

Every new workflow gets checked for: SHA-pinned actions (not `@vN`), an explicit
minimal `permissions:` block, no duplicated build steps across jobs (build once +
artifact), `cache-dependency-path` set for every lockfile, and trigger `paths:`
that actually match what the workflow validates. Lockfiles must be re-committed
after any `npm update` or `npm ci` resolves against stale state.

## Untrusted-Actor Gating for Claude Workflows (2026-07-22)

- Repo convention (claude-review.yml): `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), <event>.author_association)`.
- `github.event.issue` is **null** on `workflow_dispatch`, so any author_association gate MUST be OR'd
  with `github.event_name == 'workflow_dispatch'` or manual dispatch breaks.
- **COLLABORATOR includes read/triage-only collaborators**, not just write. Adding someone with triage
  permission silently promotes them past this gate.
- `workflow_dispatch` with an `issue_number` input is a *content* bypass: a write-holder can dispatch
  triage on an issue authored by anyone. The gate authenticates the trigger, never the content.
- claude-triage.yml carried `id-token: write` only for the OIDC→app-token exchange; with
  `claude_code_oauth_token` auth it is dead permission. The 2026-07-22 outside-contributor run failed
  on that 401 — an accident, not a control.

## Next Session Tasks

- [ ] Investigate root cause of windows-latest test failures (Coverage? Shell? Path handling?)
- [ ] Document coverage generation differences across OSes
- [ ] Add trend tracking to ci-report (historical score chart)
- [ ] Implement GitHub Pages deployment of ci-report.html
- [ ] Set up Slack notifications for CI scores < 70
- [ ] Review new workflows for action pinning violations before merge
- [ ] Create workflow template generator to prevent docs.yml-like issues in future

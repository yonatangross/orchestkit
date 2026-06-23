# CC Release-Integration SOP

How OrchestKit ingests, evaluates, and adopts each Claude Code release. This is the
human-facing **index** of the loop — the live authority is the scripts plus the
`cc-watch auto-adoption pipeline architecture` memory. Do not duplicate their internals
here; when they change, this doc points at them, it does not mirror them.

## The loop

```
detect → extract → VERIFY → file → adopt → subtract
```

| Stage | Mechanism (live authority) | What it does |
|-------|----------------------------|--------------|
| **detect** | `.github/workflows/claude-release-watch.yml` → `scripts/cc-release-watch.mjs` (daily cron) | Polls the upstream CHANGELOG, snapshots new versions into `shared/cc-snapshots/`, fires a staleness alarm when `latest_known` lags. |
| **extract** | `scripts/cc-triage.mjs` (LLM, token-gated) | Turns changelog bullets into scored `CCFeature[]` in `shared/cc-adoption-gaps.json`. |
| **VERIFY** | `applyRelevanceGate()` in `scripts/cc-triage.mjs` (token-free) | The precision/recall gate: downgrades end-user-only noise below the issue-filer floor (never drops — a drop is invisible) and recall-boosts sub-floor items that map to a predating skill. When triage is genuinely ambiguous, fall back to a **manual adversarial-refute pass** — precedents in `docs/audits/cc-adoption-2.1.186-triage-*.md` and `…-2.1.178-179-…`. |
| **file** | `scripts/cc-file-adoption-issues.sh` | Files `cc-adoption` issues (gap_score ≥ `MIN_GAP_SCORE`, default 10) under the single rolling "CC adoption" milestone, deduped by body-marker. |
| **adopt** | human / `/ork:implement` | Pick up an issue, implement, PR. |
| **subtract** | `shared/rules/cc-native-first.md` ("adoption is subtraction") | Every release also asks *"what can we now DELETE?"* — prefer a native CC mechanism over an ork one. |

## Source of truth

`shared/cc-support.json` (schema: `shared/cc-support.schema.json`) is the live SoT for the
support window — `latest`, `latest_known`, `supported_floor`, `policy`, `manual_override`.
**Never hand-edit it**: `.github/workflows/cc-support-window-bump.yml` owns it and
`scripts/stamp-cc-support.mjs` propagates it into `CLAUDE.md`, `cc-version-matrix.ts`, and the
doctor reference. Read versions/dates from the SoT — do not hardcode them here or elsewhere.

## Branch / PR gotchas

- **Use a conventional-commit branch prefix** (`feat/`, `fix/`, `chore/`, `ci/`, …) for any
  release-integration PR. `bin/git-hooks/pre-push` then skips the version-bump gate
  (release-please owns versioning). A **bare** branch name forces a manual bump via
  `bin/bump-version.sh`, which edits release-please-governed files and the CI
  **Release-Please File Guard** rejects the PR.
- The VERIFY gate over-corrects if its denylist drifts. Keep it **tight + allowlist-first**
  (the `claude mcp login --no-browser` case is the canonical false-drop to protect), and
  test new calibration against the full `shared/cc-snapshots/` corpus, not one version.

## Open follow-ups (not yet built)

- CC-version **ceiling-linter**: flag any skill/agent body that cites a CC version above the
  live upstream head (extend `tests/skills/structure/test-upstream-version-drift.mjs`; source
  the ceiling from `shared/cc-snapshots/`, not a network fetch).
- Per-release **feature adoption** still ends at a filed issue — there is no automated
  source→PR step (intentional: adoption is human judgment).

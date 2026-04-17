# Usage-Analytics Hardening Rules

Rules distilled from analytics across 126 sessions — codifying the recurring patterns that produced partial successes or cascading failures. Each rule maps to one or more observed friction points.

## Sub-Agents & Worktrees

When running sub-agents in worktrees, verify changes are merged back to the main working tree before reporting completion. Never assume worktree changes persist automatically — `ExitWorktree(action="keep")` preserves the branch but does not merge it. If the agent's output depends on its file changes appearing in main, either merge explicitly or have the agent write into the parent tree.

## Refactoring Checklist

After refactoring or splitting files, grep systematically for ALL stale import paths across the entire codebase (especially test files) before declaring the refactor complete. The `stale-import-detector` hook surfaces this automatically after Write/Edit, but a manual `grep -r "from old_module" src/ tests/` as the last step of any split prevents cascade failures.

## Batch Changes

For batch automated replacements (migration, rename, signature change): run the full test suite after **every 5 files** rather than after all changes. Small batches stay reversible; large batches hide which change broke what. Never use `type: ignore`, `# noqa`, or `eslint-disable` as a workaround without explicit user approval — those suppress the signal that tells you the batch was too large.

## 1Password / GPG / Interactive Auth

1Password CLI requires interactive biometric auth. Never assume it will work non-interactively in Docker builds or CI. GPG signing may require manual unlock between signatures — if a commit fails with "1Password: failed to fill whole buffer" or "agent returned an error", stop and ask the user to re-unlock rather than retrying silently or bypassing signing with `--no-gpg-sign`.

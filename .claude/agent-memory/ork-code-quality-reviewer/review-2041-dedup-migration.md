---
name: review-2041-dedup-migration
description: Adversarial review of #2041 cc-watch dedup migration from Key:slug+version to Changelog-Ref:sha256(refline) — hash-parity risk between backfill and filer
metadata:
  type: project
---

# #2041 cc-watch dedup migration review (orchestkit-dedup worktree, 2026-05-28)

Switches dedup key from `Key: <slug>+<version>` to `Changelog-Ref: <sha256(reference_changelog_line)>`. Slug is LLM-generated and drifts run-to-run (marketplace_remove_scope_flag vs marketplace_remove_scope), which filed duplicate issues (#2030 + #2038 are the live dupe pair).

**Why:** LLM slug drift filed dupes. The changelog line is immutable + 1:1 with a feature, so hashing it is the stable identity.

**How to apply:** When reviewing any future change to cc-triage.mjs / cc-file-adoption-issues.sh / cc-backfill, the load-bearing invariant is HASH PARITY across three producers of `reference_changelog_line`: (1) old filer stored it UNtrimmed in `> <ref>` body blockquote, (2) new triage `.trim()`s it, (3) backfill re-extracts via `sed -n 's/^> //p' | head -1` (command-sub strips trailing newline). All three must yield byte-identical strings or dedup breaks → duplicate storm.

## Key parity facts verified
- OLD triage stored reference_changelog_line UNtrimmed (raw LLM); NEW triage `.trim()`s it.
- LLM prompt says `reference_changelog_line: verbatim bullet text, trimmed` AND snapshot bullets get `- ` prefix stripped before the LLM sees them.
- Stored issue bodies (#2030/#2038) have NO `- ` prefix and NO trailing whitespace on the `> ref` line — they begin `` `claude plugin marketplace remove` ``.
- Backfill hashes the command-sub-stripped extracted line (no trailing newline): for #2038 ref = 759ad747... With trailing newline it would be c0928ef7... — the two differ, so the newline handling is load-bearing and CORRECT (command-sub strips it).
- sha256_hex (`sha256sum | cut -d' ' -f1` else `shasum -a 256 | cut -d' ' -f1`) is portable + parity-safe across macOS/Linux; both emit bare hex.

## Residual parity risk (the real hole)
Parity holds ONLY if the re-triaged LLM re-emits the verbatim trimmed line byte-identically to what the old LLM emitted (now stored in the issue body). The hashes are over LLM-EMITTED prose, not a deterministic transform of the snapshot. Any drift — a stripped backtick, a smart-quote, a collapsed double-space, trailing space — yields a different hash on the FILER side while the BACKFILL side is pinned to the historical body string. Result: filer hash != backfill hash for that one issue → ONE duplicate (not a storm, because backfill marks every old issue so only NEWLY-drifted re-emissions dupe).

The backfill correctly anchors to the stored body (the historical truth). The weak link is the FILER trusting a fresh LLM emission to match. Mitigation already present: triage now `.trim()`s + dedups on ref within a run. But cross-RUN byte-stability of LLM output is assumed, not enforced.

## Test gap
test-cc-triage.sh Test 13 uses ref `"marketplace remove now accepts --scope"` (no backticks, no `- `); step3 test uses `'- foo'` (WITH `- `). Neither matches the REAL stored body format (backticks, no `- `). No test asserts backfill-hash == filer-hash for a realistic backtick-laden ref re-emitted by the model. The "key parity" test (case 1/5) only checks backfill-vs-local-sha, not backfill-vs-filer on the same input string.

## Non-blocking confirmations
- silent-failure compliance: backfill clean (only `>/dev/null` on edit stdout; stderr surfaces, set -e catches). Test's `grep -cE || n=0 2>/dev/null` is test-only noise suppression, acceptable.
- Step ordering: backfill (2.9) before filer (3), same job sequential, set -euo pipefail → backfill hard-fail aborts the job before filer runs. SAFE. But NO continue-on-error: a transient gh error in backfill blocks filing entirely (availability tradeoff, arguably correct given the dupe-storm risk).
- Degenerate fallback (REF empty/"null" → key on slug+version, then hash): correct, can't silently break; collision only if two distinct features both lack a ref AND share slug+version (impossible — slug+version is unique per the old scheme).
- sed extraction: `head -1` takes only FIRST `> ` line; existing issues have exactly one. Backticks in ref are literal (single-quoted printf in backfill marker append). No injection.

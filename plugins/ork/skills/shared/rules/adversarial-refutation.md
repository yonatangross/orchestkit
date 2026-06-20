---
title: "Adversarial Refutation Engine"
impact: HIGH
impactDescription: "Shared blind-refuter protocol that removes self-preferential bias from evaluative skills — the producer of a finding can't be its own fair judge"
tags: [verification, adversarial, evaluation, anti-bias]
---

# Adversarial Refutation Engine

Shared protocol for evaluative skills (`assess`, `review-pr`, `audit-full`) to verify
their own decision-bearing findings with a **separate, blind refuter** — the structural
fix for self-preferential bias. A verifier with skin in the game can't be a fair verifier;
the producer's number, evidence list, and prose ARE its reasoning, so forwarding them
re-introduces the anchoring the pass is meant to remove.

> Evidence this matters: the #2217 drift-register audit was ~60% wrong because findings
> judged themselves. An adversarial pass (this protocol) caught a wrong "KEEP" verdict.

Each skill loads this engine via a thin `references/adversarial-refutation.md` adapter that
supplies its bindings (which field = "finding", which rubric, where survivors/kills land).

## 1. Blindness contract

The refuter prompt MAY contain: `{file, line, category, raw code slice (PRIMARY artifact),
rubric excerpt, sanitized accepted conventions}` and a **neutral claim** naming ONLY the
category + location.

It MUST NOT contain: the producer's identity/`subagent_type`, the producer's **number or
severity label**, the producer's description/impact/suggestion prose, the producer's curated
evidence list, sibling findings, the original producer prompt, or "known-weakness" priors.

## 2. Independent-score-first

The refuter never sees the producer's value. It (a) reads the cited code itself, (b) forms
its OWN severity/score band from the rubric, (c) returns an existence verdict. The
**orchestrator** — not the refuter — computes SURVIVES/OVERTURNED by comparing the
producer's value against the refuter's independent band. Revise only when the producer
value sits OUTSIDE the band, and revise to the **near band edge** (never the midpoint).

## 3. Citation-verification gate

Before any KILL/OVERTURN/DOWNGRADE is honored, the orchestrator re-opens the refuter's
cited `file:line` and confirms it exists and supports the verdict. Unverifiable/hallucinated
citation → downgrade to UPHELD. "No refutation found" or assertion-only (no citation) → UPHELD.

## 4. Quorum (no lone judge on either side)

| Finding tier | Refuters | Rule |
|--------------|----------|------|
| Top (CRITICAL audit / request-changes blocker / high-weight score near a grade boundary) | 3 | majority — ≥2 of 3 with VERIFIED counter-evidence |
| Mid (HIGH severity / decision-bearing dimension) | 2 | majority — never a single unilateral kill that changes a verdict |
| Advisory (cannot change a merge verdict or headline score) | 1 | single refuter allowed |

A 1-of-N dissent never revises — record it as a caveat and drop that finding's confidence
to "low".

## 5. Cross-file UPHELD-by-default

If the finding asserts a multi-file flow (taint / data-flow / cross-module), the card MUST
carry the producer's full traced file set. Refuter instruction: "could not reproduce the
traced flow" → **UPHELD** (never REFUTED). A narrow-context refuter must not kill a true
cross-file finding it simply couldn't see.

## 6. Deterministic exemption

NEVER refute ground truth: failing build/test/lint output, npm-audit/CVSS tool matches,
type-check errors. Only a reachability **claim** layered on top of a CVE is refutable — and
only that claim.

## 7. No-auto-flip (human-facing gates)

Refutation alone MAY demote a finding's display bucket but may NOT, by itself, flip a
human-facing merge/ship verdict from block→approve, nor silently raise a headline score.
Keep the producer-basis headline score AND publish a separately-labeled "post-refutation"
score. Surface every killed CRITICAL/HIGH prominently (not buried); require explicit user
confirmation before a kill removes a blocker.

## 8. Global spawn ceiling

Dedup to root-cause BEFORE counting. Hard cap total refuter spawns per run (default **24**).
If `material findings × refuters-per-finding` exceeds the cap, rank by
`severity-weight × distance-from-decision-boundary`, refute the top-K, and ship the rest
flagged "not independently refuted — manual review required". Never silently truncate.

## 9. Always-isolated spawn

Refuters are ALWAYS plain Task-tool `Agent(...)` spawns with **no `team_name`**, even when
the producer phase ran in Agent-Teams mode — joining the mesh leaks producer reasoning via
`SendMessage` history and destroys blindness. Delivery is prompt/`additionalContext`-only
(cache-safe; no mid-session system-prompt mutation).

## 10. Refutation ledger (shared output schema)

Persist per finding so wrong KEEPs AND wrong KILLs are auditable cross-session:

```json
{ "finding_id": "...", "refuters": 3, "votes": {"refuted": 2, "upheld": 1, "downgrade": 0},
  "verified_citations": ["file:line"], "outcome": "survived|killed|downgraded|unrefuted",
  "confidence": "high|low", "original_value": "...", "revised_value": "..." }
```

## 11. Cross-model diversity (optional provenance lane)

An optional lane may route ONE quorum slot per decision-bearing finding to a **different model family** (Codex/GPT) for a genuinely different failure surface. It SUBSTITUTES a same-model slot (no count or §8 inflation), inherits §1 blindness + §3 citation-verify + §4 quorum + §7 no-auto-flip unchanged, and stamps `refuter_model`/`refuter_lane` for provenance (best-effort attribution from an untrusted command, **not** a trust boundary). The skill MUST NOT own credentials or open egress — it shells out to a user-configured command; an absent command degrades to the same-model lane, never to "no refutation". Operational detail: `${CLAUDE_PLUGIN_ROOT}/skills/review-pr/references/cross-model-refuter.md`.

## Known residual bias (state it, don't hide it)

A one-sided "your job is to REFUTE" pass raises **false negatives** — for a merge gate or
security audit, dropping a real bug is costlier than a noisy false positive. The gates above
(citation-verify, raised quorum, cross-file UPHELD-default, no-auto-flip) bound it, but N
same-model refuters share blind spots: majority buys variance reduction, not independent
bias correction. Recomputing the headline over survivors is itself a new self-preference —
that's why both scores are published and a human signs off.

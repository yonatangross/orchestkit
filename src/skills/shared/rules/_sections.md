---
title: Shared Cross-Cutting Rules
version: 1.0.0
---

# Rule Categories

## 1. Verification (verification) — CRITICAL — 1 rule

Cross-cutting evidence requirements for all skill completion claims.

- `verification-gate.md` — 5-step evidence gate: identify, run, read, verify, claim

## 2. Communication (communication) — HIGH — 1 rule

Anti-sycophancy and direct communication standards for review and feedback skills.

- `anti-sycophancy.md` — Ban performative agreement, require direct technical statements

## 3. Adversarial Verification (adversarial) — HIGH — 1 rule

Blind-refuter protocol for evaluative skills (assess, review-pr, audit-full) — removes
self-preferential bias by verifying decision-bearing findings with a separate, blind agent.

- `adversarial-refutation.md` — Blindness contract, independent-score-first, citation-verify, quorum, no-auto-flip

## 4. Untrusted Input (security) — HIGH — 1 rule

Prompt-injection defense for skills that read untrusted GitHub/CI content (ci-sentinel,
fix-issue, review-pr) — separate the agent that reads untrusted text from the one that acts.

- `untrusted-input-quarantine.md` — reader/actor split, structured-facts contract, per-skill bindings

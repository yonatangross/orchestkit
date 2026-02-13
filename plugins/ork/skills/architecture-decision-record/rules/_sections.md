---
title: Architecture Decision Record Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Scalability Interrogation (scalability) — HIGH — 1 rule

Questions to ask about scale, load, and growth before committing to an architectural decision. Prevents costly rework.

- `interrogation-scalability.md` — Scale assessment questions, data volume, growth projections

## 2. Reliability Interrogation (reliability) — HIGH — 1 rule

Questions about failure modes, data consistency, and operational concerns. Ensures decisions account for production reality.

- `interrogation-reliability.md` — Failure modes, data patterns, UX impact, coherence validation

## 3. Security Interrogation (security) — HIGH — 1 rule

Questions about access control, tenant isolation, and attack surface. Prevents security gaps from being discovered too late.

- `interrogation-security.md` — Authorization, tenant isolation, attack vectors, PII handling

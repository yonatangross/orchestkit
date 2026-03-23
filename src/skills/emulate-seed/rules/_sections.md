---
title: Emulate Seed Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Seed Config (seed-config) — HIGH — 1 rule

Structure and generation of emulate.config.yaml files for pre-populating emulator state.

- `seed-config.md` — emulate.config.yaml structure, tokens, users, repos, projects, centralized config

## 2. Service Selection (service-selection) — MEDIUM — 1 rule

Choosing the right emulate service (GitHub, Vercel, Google) for your testing needs.

- `service-selection.md` — When to use each service, port defaults, emulate vs other tools

## 3. Webhook Setup (webhook-setup) — MEDIUM — 1 rule

Configuring webhook delivery with HMAC-SHA256 signature verification in test environments.

- `webhook-setup.md` — Webhook receivers, HMAC verification, webhook secrets, delivery patterns

## 4. Parallel CI (parallel-ci) — HIGH — 1 rule

Per-worker port isolation for running emulate in parallel test execution.

- `parallel-ci.md` — Port offsets, worker isolation, shared state prevention, cleanup

## 5. Auth Tokens (auth-tokens) — MEDIUM — 1 rule

Token seeding patterns for emulated authentication without real credentials.

- `auth-tokens.md` — Token-to-user mapping, scope configuration, permission testing, credential hygiene

---
title: Browser Tools Rule Categories
version: 4.0.0
---

# Rule Categories

## 1. Ethics & Security (browser) — CRITICAL — 2 rules

Responsible scraping practices and secure credential handling.

- `browser-scraping-ethics.md` — Respect robots.txt, ToS compliance, identifiable user-agent
- `browser-auth-security.md` — Secure credential storage, session handling, no token logging, Auth Vault

## 2. Local Dev (browser) — HIGH — 1 rule

Stable local development URLs using Portless instead of port guessing.

- `browser-portless-local-dev.md` — Portless named URLs, service discovery, agent-browser integration

## 3. Reliability (browser) — HIGH — 2 rules

Rate limiting and page interaction patterns for reliable automation.

- `browser-rate-limiting.md` — Request delays, exponential backoff, concurrency limits, domain restriction
- `browser-snapshot-workflow.md` — Wait-then-snapshot, iframe traversal, batch, semantic locators, --full scope change

## 4. Debug & Device (browser) — HIGH — 2 rules

Safe debugging, recording, and mobile device testing patterns.

- `browser-debug-recording.md` — Trace, profiler, record, HAR capture, DevTools inspect, clipboard safety
- `browser-mobile-testing.md` — iOS Simulator scoping, device emulation verification

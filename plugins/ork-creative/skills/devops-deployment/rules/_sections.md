---
title: DevOps Deployment Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Docker (docker) — CRITICAL — 2 rules

Container image best practices for security and efficiency.

- `docker-multistage.md` — Multi-stage builds to reduce image size and remove build tools
- `docker-layer-security.md` — Non-root users, secret handling, minimal base images

## 2. CI/CD (cicd) — HIGH — 2 rules

Pipeline configuration for reliability and performance.

- `devops-ci-caching.md` — Cache dependencies with lockfile-hashed keys
- `devops-branch-protection.md` — Required reviews and status checks on protected branches

## 3. Operations (devops) — CRITICAL — 1 rule

Production deployment and data management patterns.

- `devops-db-migrations.md` — Backward-compatible migrations with zero-downtime deploy order

## 4. PaaS Deployment (paas) — HIGH — 1 rule

Platform-as-a-Service deployment patterns.

- `railway-deployment.md` — Railway config, Nixpacks, env vars, database provisioning, multi-service

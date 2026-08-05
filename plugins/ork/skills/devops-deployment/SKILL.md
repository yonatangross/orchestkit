---
name: devops-deployment
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Use when setting up CI/CD pipelines, containerizing applications, deploying to Kubernetes, or writing infrastructure as code. DevOps & Deployment covers GitHub Actions, Docker, Helm, and Terraform patterns.
tags: [devops, ci-cd, docker, kubernetes, terraform]
context: fork
agent: ci-cd-engineer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: guidance
metadata:
  category: workflow-automation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
paths: [".github/workflows/**", "Dockerfile*", "docker-compose*", "**/k8s/**", "**/terraform/**"]
path_patterns: ["*.tf", "*.tfvars", "**/k8s/**", "**/helm/**", "Dockerfile*", ".github/workflows/*"]
invocation_hooks:
  - "command -v docker >/dev/null 2>&1 || echo 'Warning: docker not found — container operations will fail'"
---

# DevOps & Deployment Skill

Comprehensive frameworks for CI/CD pipelines, containerization, deployment strategies, and infrastructure automation.

> **Note:** If `disableSkillShellExecution` is enabled (CC 2.1.91), the Docker install check won't run. Verify Docker is available for container operations: `docker --version`.

## Overview

- Setting up CI/CD pipelines
- Containerizing applications
- Deploying to Kubernetes or cloud platforms
- Implementing GitOps workflows
- Managing infrastructure as code
- Planning release strategies

## Pipeline Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│    Code     │──>│    Build    │──>│    Test     │──>│   Deploy    │
│   Commit    │   │   & Lint    │   │   & Scan    │   │  & Release  │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
       │                 │                 │                 │
       v                 v                 v                 v
   Triggers         Artifacts          Reports          Monitoring
```

## Key Concepts

### CI/CD Pipeline Stages

1. **Lint & Type Check** - Code quality gates
2. **Unit Tests** - Test coverage with reporting
3. **Security Scan** - npm audit + Trivy vulnerability scanner
4. **Build & Push** - Docker image to container registry
5. **Deploy Staging** - Environment-gated deployment
6. **Deploy Production** - Manual approval or automated

### Container Best Practices

**Multi-stage builds** minimize image size:
- Stage 1: Install production dependencies only
- Stage 2: Build application with dev dependencies
- Stage 3: Production runtime with minimal footprint

**Security hardening**:
- Non-root user (uid 1001)
- Read-only filesystem where possible
- Health checks for orchestrator integration

### Kubernetes Deployment

**Essential manifests**:
- Deployment with rolling update strategy
- Service for internal routing
- Ingress for external access with TLS
- HorizontalPodAutoscaler for scaling

**Security context**:
- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true`
- Drop all capabilities

### Deployment Strategies

| Strategy | Use Case | Risk |
|----------|----------|------|
| **Rolling** | Default, gradual replacement | Low - automatic rollback |
| **Blue-Green** | Instant switch, easy rollback | Medium - double resources |
| **Canary** | Progressive traffic shift | Low - gradual exposure |

**Rolling Update** (Kubernetes default):
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 0  # Zero downtime
```

### Secrets Management

Use External Secrets Operator to sync from cloud providers:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- GCP Secret Manager

---

## References

### Docker Patterns
**Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/docker-patterns.md")`**

Key topics covered:
- Multi-stage build examples with 78% size reduction
- Layer caching optimization
- Security hardening (non-root, health checks)
- Trivy vulnerability scanning
- Docker Compose development setup

### OrchestKit Delta (house rules)
**Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/ork-delta.md")`**

Key topics covered:
- CI concurrency groups, the sub-5-minute feedback budget, path filtering
- Service-container health gating, SHA-pinned deploys, CDN invalidation order
- Kubernetes probe budget, request/limit baseline, PodDisruptionBudget floor
- External Secrets refresh interval, ArgoCD prune plus selfHeal, Terraform state locking
- Alert thresholds with dwell windows, request-id log binding, rollback rehearsal

### Railway Deployment
**Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/rules/railway-deployment.md")`**

Key topics covered:
- railway.json configuration, Nixpacks builds
- Environment variable management, database provisioning
- Multi-service setups, Railway CLI workflows
- References: `${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/railway-json-config.md`, `${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/nixpacks-customization.md`, `${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/multi-service-setup.md`

### Deployment Strategies
**Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/deployment-strategies.md")`**

Key topics covered:
- Rolling deployment (`maxUnavailable` / `maxSurge`)
- Blue-green deployment (service-selector switch and rollback)
- Canary releases (replica-ratio traffic split)

---

## Upstream coverage (do not restate)

This skill wraps third-party products. Vendor mechanics are not restated here; fetch them from the
source below. Where a row says "house subset stays in X", that file keeps only OrchestKit's
threshold, config or ordering decision, not the vendor tutorial.

| Topic | Fetch from |
|-------|-----------|
| GitHub Actions workflow syntax, matrix builds, artifact upload/download, cache mechanics | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax (house cache-key subset stays in `rules/devops-ci-caching.md`) |
| Trigger filters (`on.push.paths`, schedules, `workflow_dispatch`) | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow |
| Service containers for integration tests | https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers |
| Deployment environments and approval gates | https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments |
| Protected branches and required status checks | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches (house approval counts stay in `rules/devops-branch-protection.md`) |
| Kubernetes probe semantics and every probe field | https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ (house probe numbers stay in `references/ork-delta.md`) |
| Requests, limits, quotas and QoS classes | https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ (house baseline stays in `references/ork-delta.md`) |
| PodDisruptionBudget semantics and eviction API | https://kubernetes.io/docs/tasks/run-application/configure-pdb/ (house `minAvailable` floor stays in `references/ork-delta.md`) |
| StatefulSets, ordinal identity, volumeClaimTemplates | https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/ |
| Helm chart authoring, templating and values files | https://helm.sh/docs/topics/charts/ (the chart directory layout we use stays in `references/checklists-and-templates.md`) |
| External Secrets Operator CRD fields and backends | https://external-secrets.io/latest/api/externalsecret/ (house refresh/creation policy stays in `references/ork-delta.md`) |
| ArgoCD automated sync, prune and self-heal | https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/ (house retry/backoff stays in `references/ork-delta.md`) |
| Terraform S3 backend and state locking | https://developer.hashicorp.com/terraform/language/backend/s3 (house backend config stays in `references/ork-delta.md`) |
| Terraform module composition and variable files | https://developer.hashicorp.com/terraform/language/modules |
| Alembic revision, upgrade and downgrade CLI | https://alembic.sqlalchemy.org/en/latest/tutorial.html (the zero-downtime migration ordering stays in `rules/devops-db-migrations.md`) |
| Prometheus client instrumentation (Counter, Histogram, exposition) | https://prometheus.github.io/client_python/ |
| PromQL functions (`rate`, `histogram_quantile`) for dashboards | https://prometheus.io/docs/prometheus/latest/querying/functions/ |
| Prometheus alerting rule syntax | https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ (house thresholds and dwell windows stay in `references/ork-delta.md`) |
| OpenTelemetry FastAPI auto-instrumentation and manual spans | https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/fastapi/fastapi.html |
| structlog context binding | https://www.structlog.org/en/stable/contextvars.html (the bind-then-call ordering stays in `references/ork-delta.md`) |
| Trivy severity filtering and scan configuration | https://trivy.dev/latest/docs/configuration/filtering/ (the house image-scan CI wiring stays in `references/docker-patterns.md`, the weekly-scan schedule and severity floor in `references/ork-delta.md`) |
| CloudFront invalidation semantics and cost | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html (the sync-then-invalidate order stays in `references/ork-delta.md`) |
| Pre-launch security, load-testing and monitoring checklists | `ork:security-patterns`, `ork:testing-perf`, `ork:monitoring-observability` (the deploy-day checklist stays in `references/checklists-and-templates.md`) |

---

## Deployment Checklist & Templates

Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/checklists-and-templates.md")` for pre/during/post-deployment checklists, Helm chart structure, template reference table, and extended thinking triggers.

---

## Related Skills

- `ork:security-patterns` - Security scanning and hardening patterns for CI/CD pipelines
- `ork:monitoring-observability` - Prometheus, Grafana and alerting for deployed applications
- `ork:database-patterns` - Python/Alembic migration workflow for backend deployments
- `portless` (upstream) - Named `.localhost` URLs for multi-service local dev (`portless alias api 8080`)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Container user | Non-root (uid 1001) | Security best practice, required by many orchestrators |
| Deployment strategy | Rolling update (default) | Zero downtime, automatic rollback, resource efficient |
| Secrets management | External Secrets Operator | Syncs from cloud providers, GitOps compatible |
| Health checks | Separate startup/liveness/readiness | Prevents premature traffic, enables graceful shutdown |

## Capability Details

Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/devops-deployment/references/capability-details.md")` for full keyword index and problem-solution mapping across all 6 capabilities (ci-cd, docker, kubernetes, infrastructure-as-code, deployment-strategies, observability).
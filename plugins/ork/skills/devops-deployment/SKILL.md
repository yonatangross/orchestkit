---
name: devops-deployment
license: MIT
compatibility: "Claude Code 2.1.76+."
description: Use when setting up CI/CD pipelines, containerizing applications, deploying to Kubernetes, or writing infrastructure as code. DevOps & Deployment covers GitHub Actions, Docker, Helm, and Terraform patterns.
tags: [devops, ci-cd, docker, kubernetes, terraform]
context: fork
agent: data-pipeline-engineer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: workflow-automation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# DevOps & Deployment Skill

Comprehensive frameworks for CI/CD pipelines, containerization, deployment strategies, and infrastructure automation.

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
**Load: `Read("${CLAUDE_SKILL_DIR}/references/docker-patterns.md")`**

Key topics covered:
- Multi-stage build examples with 78% size reduction
- Layer caching optimization
- Security hardening (non-root, health checks)
- Trivy vulnerability scanning
- Docker Compose development setup

### CI/CD Pipelines
**Load: `Read("${CLAUDE_SKILL_DIR}/references/ci-cd-pipelines.md")`**

Key topics covered:
- Branch strategy (Git Flow)
- GitHub Actions caching (85% time savings)
- Artifact management
- Matrix testing
- Complete backend CI/CD example

### Kubernetes Basics
**Load: `Read("${CLAUDE_SKILL_DIR}/references/kubernetes-basics.md")`**

Key topics covered:
- Health probes (startup, liveness, readiness)
- Security context configuration
- PodDisruptionBudget
- Resource quotas
- StatefulSets for databases
- Helm chart structure

### Environment Management
**Load: `Read("${CLAUDE_SKILL_DIR}/references/environment-management.md")`**

Key topics covered:
- External Secrets Operator
- GitOps with ArgoCD
- Terraform patterns (remote state, modules)
- Zero-downtime database migrations
- Alembic migration workflow
- Rollback procedures

### Observability
**Load: `Read("${CLAUDE_SKILL_DIR}/references/observability.md")`**

Key topics covered:
- Prometheus metrics exposition
- Grafana dashboard queries (PromQL)
- Alerting rules for SLOs
- Golden signals (SRE)
- Structured logging
- Distributed tracing (OpenTelemetry)

### Railway Deployment
**Load: `Read("${CLAUDE_SKILL_DIR}/rules/railway-deployment.md")`**

Key topics covered:
- railway.json configuration, Nixpacks builds
- Environment variable management, database provisioning
- Multi-service setups, Railway CLI workflows
- References: `${CLAUDE_SKILL_DIR}/references/railway-json-config.md`, `${CLAUDE_SKILL_DIR}/references/nixpacks-customization.md`, `${CLAUDE_SKILL_DIR}/references/multi-service-setup.md`

### Deployment Strategies
**Load: `Read("${CLAUDE_SKILL_DIR}/references/deployment-strategies.md")`**

Key topics covered:
- Rolling deployment
- Blue-green deployment
- Canary releases
- Traffic splitting with Istio

---

## Deployment Checklist & Templates

Load: `Read("${CLAUDE_SKILL_DIR}/references/checklists-and-templates.md")` for pre/during/post-deployment checklists, Helm chart structure, template reference table, and extended thinking triggers.

---

## Related Skills

- `zero-downtime-migration` - Database migration patterns for zero-downtime deployments
- `security-scanning` - Security scanning integration for CI/CD pipelines
- `ork:monitoring-observability` - Monitoring and alerting for deployed applications
- `ork:database-patterns` - Python/Alembic migration workflow for backend deployments

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Container user | Non-root (uid 1001) | Security best practice, required by many orchestrators |
| Deployment strategy | Rolling update (default) | Zero downtime, automatic rollback, resource efficient |
| Secrets management | External Secrets Operator | Syncs from cloud providers, GitOps compatible |
| Health checks | Separate startup/liveness/readiness | Prevents premature traffic, enables graceful shutdown |

## Capability Details

Load: `Read("${CLAUDE_SKILL_DIR}/references/capability-details.md")` for full keyword index and problem-solution mapping across all 6 capabilities (ci-cd, docker, kubernetes, infrastructure-as-code, deployment-strategies, observability).
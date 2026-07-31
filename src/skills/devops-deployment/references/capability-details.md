# DevOps Deployment - Capability Details

> Vendor mechanics for these capabilities are not restated in this skill. See the
> "Upstream coverage (do not restate)" table in `SKILL.md` for where to fetch them, and
> `references/ork-delta.md` for the house thresholds, configs and ordering constraints.

### ci-cd
**Keywords:** ci, cd, pipeline, github actions, gitlab ci, jenkins, workflow
**Solves:**
- What is our CI feedback budget and how do we hold it? (`references/ork-delta.md`)
- Cache-key discipline for dependency caching (`rules/devops-ci-caching.md`)
- Which branch protections are required on main and dev (`rules/devops-branch-protection.md`)
- Workflow syntax and matrix mechanics: fetch upstream (see `SKILL.md`)

### docker
**Keywords:** docker, dockerfile, container, image, build, compose, multi-stage
**Solves:**
- How do I containerize my app?
- Multi-stage Dockerfile best practices
- Docker Compose development setup
- Container security hardening

### kubernetes
**Keywords:** kubernetes, k8s, deployment, service, ingress, helm, statefulset, pdb
**Solves:**
- What probe timings, request/limit baseline and PDB floor do we ship? (`references/ork-delta.md`)
- Which manifests a service needs and the chart layout (`references/checklists-and-templates.md`)
- Ready-to-copy manifests (`scripts/k8s-manifests.yaml`, `scripts/helm-values.yaml`)
- Probe, quota, StatefulSet and Helm semantics: fetch upstream (see `SKILL.md`)

### infrastructure-as-code
**Keywords:** terraform, pulumi, iac, infrastructure, provision, gitops, argocd
**Solves:**
- What backend, locking and version floor does our Terraform use? (`references/ork-delta.md`)
- Which ArgoCD sync policy and retry budget we run (`references/ork-delta.md`)
- Ready-to-copy IaC (`scripts/terraform-aws.tf`, `scripts/argocd-application.yaml`, `scripts/external-secrets.yaml`)
- Terraform, ArgoCD and External Secrets reference docs: fetch upstream (see `SKILL.md`)

### deployment-strategies
**Keywords:** blue green, canary, rolling, deployment strategy, rollback, zero downtime
**Solves:**
- Which deployment strategy should I use?
- Zero-downtime database migrations
- Blue-green deployment setup
- Canary release with traffic splitting

### observability
**Keywords:** prometheus, grafana, metrics, alerting, monitoring, health check
**Solves:**
- Which alert thresholds and dwell windows do we page on? (`references/ork-delta.md`)
- How request ids get bound into log context and echoed back (`references/ork-delta.md`)
- Full monitoring and alerting design: `ork:monitoring-observability`
- Prometheus client, PromQL and OpenTelemetry docs: fetch upstream (see `SKILL.md`)

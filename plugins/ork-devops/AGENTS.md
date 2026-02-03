# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-devops Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# DevOps & Infrastructure
|ci-cd-engineer:{ci-cd-engineer.md}|CI/CD,pipeline,GitHub Actions,GitLab CI,workflow,build,deploy,artifact,cache,matrix testing,release automation
|deployment-manager:{deployment-manager.md}|deployment,release,rollback,blue-green,canary,feature flag,zero-downtime,production,rollout,incident
|infrastructure-architect:{infrastructure-architect.md}|infrastructure,Terraform,Kubernetes,AWS,GCP,Azure,VPC,EKS,RDS,cloud architecture,IaC
|monitoring-engineer:{monitoring-engineer.md}|monitoring,prometheus,grafana,alerting,tracing,opentelemetry,metrics,observability,logs,slo,sli
|release-engineer:{release-engineer.md}|release,milestone,changelog,tag,version,semver,sprint,roadmap
```

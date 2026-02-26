# Deployment Strategies

Blue-green, canary, and rolling deployment patterns.

## Rolling Deployment (Default)

Update pods gradually:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

- **Pros**: No downtime, gradual rollout
- **Cons**: Mixed versions running simultaneously

## Blue-Green Deployment

Two identical environments, switch traffic:

```bash
# Deploy to green (inactive)
kubectl apply -f green-deployment.yaml

# Test green
curl https://green.example.com/health

# Switch traffic (update service selector)
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'

# Rollback if needed
kubectl patch service myapp -p '{"spec":{"selector":{"version":"blue"}}}'
```

- **Pros**: Instant rollback, no mixed versions
- **Cons**: 2x resources, database migrations tricky

## Canary Deployment

Gradually shift traffic:

```yaml
# 90% to stable
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-stable
spec:
  replicas: 9

# 10% to canary
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-canary
spec:
  replicas: 1
```

- **Pros**: Limit blast radius, test with real traffic
- **Cons**: Complex traffic management

See `scripts/argocd-application.yaml` for GitOps patterns.

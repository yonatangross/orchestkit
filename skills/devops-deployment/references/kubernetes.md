# Kubernetes Deployment

K8s deployment patterns and best practices.

## Basic Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

## Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Best Practices

1. **Set resource limits** - prevent OOM kills
2. **Use health checks** - liveness & readiness
3. **ConfigMaps for config** - not hardcoded
4. **Secrets for credentials** - not in env vars
5. **HPA for autoscaling** - based on CPU/memory

See `templates/k8s-manifests.yaml` and `templates/helm-values.yaml`.

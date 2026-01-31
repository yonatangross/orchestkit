# Kubernetes Basics

K8s deployments, services, health probes, and production patterns.

## Health Probes

**Three probe types with distinct purposes:**

```yaml
spec:
  containers:
  - name: app
    # Startup probe (gives slow-starting apps time to boot)
    startupProbe:
      httpGet:
        path: /health/startup
        port: 8080
      initialDelaySeconds: 0
      periodSeconds: 5
      failureThreshold: 30  # 30 * 5s = 150s max startup time

    # Liveness probe (restarts pod if failing)
    livenessProbe:
      httpGet:
        path: /health/liveness
        port: 8080
      initialDelaySeconds: 60
      periodSeconds: 10
      failureThreshold: 3  # 3 failures = restart

    # Readiness probe (removes from service if failing)
    readinessProbe:
      httpGet:
        path: /health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 2  # 2 failures = remove from load balancer
```

**Probe implementation (FastAPI):**
```python
@app.get("/health/startup")
async def startup_check():
    # Check DB connection established
    if not db.is_connected():
        raise HTTPException(status_code=503, detail="DB not ready")
    return {"status": "ok"}

@app.get("/health/liveness")
async def liveness_check():
    # Basic "is process running" check
    return {"status": "alive"}

@app.get("/health/readiness")
async def readiness_check():
    # Check all dependencies healthy
    if not redis.ping() or not db.health_check():
        raise HTTPException(status_code=503, detail="Dependencies unhealthy")
    return {"status": "ready"}
```

## Security Context

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
        - ALL
```

## Resource Management

**Always set requests and limits:**
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

- Use `requests` for scheduling
- Use `limits` for throttling

## PodDisruptionBudget

Prevents too many pods from being evicted during node maintenance:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: app-pdb
spec:
  minAvailable: 2  # Always keep at least 2 pods running
  selector:
    matchLabels:
      app: myapp
```

**Use cases:**
- Cluster upgrades (node drains)
- Autoscaler downscaling
- Manual evictions

## Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: production
spec:
  hard:
    requests.cpu: "10"      # Total CPU requests
    requests.memory: 20Gi   # Total memory requests
    limits.cpu: "20"        # Total CPU limits
    limits.memory: 40Gi     # Total memory limits
    pods: "50"              # Max pods
```

## StatefulSets for Databases

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    # Pod spec here
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

**Key differences from Deployment:**
- Stable pod names (`postgres-0`, `postgres-1`, `postgres-2`)
- Ordered deployment and scaling
- Persistent storage per pod

## Helm Chart Structure

```
charts/app/
├── Chart.yaml
├── values.yaml
├── scripts/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── _helpers.tpl
└── values/
    ├── staging.yaml
    └── production.yaml
```

## Essential Manifests

- Deployment with rolling update strategy
- Service for internal routing
- Ingress for external access with TLS
- HorizontalPodAutoscaler for scaling

See `scripts/k8s-manifests.yaml` and `scripts/helm-values.yaml` for complete examples.
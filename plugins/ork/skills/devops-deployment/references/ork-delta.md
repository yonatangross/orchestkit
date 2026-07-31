# OrchestKit DevOps Delta

House rules that survive after the vendor tutorials were routed to their first-party sources.
Everything here is a threshold, a working config, or an ordering constraint we actually rely on.
Vendor mechanics live upstream; see the "Upstream coverage" table in `SKILL.md`.

A "retired `<path>`" in a Why line is a historical citation of a file that was deleted in this
change, not a live pointer. Do not try to open those paths.

## Give every CI workflow a concurrency group keyed on workflow and ref

Why: distilled from the retired `examples/github-actions-cicd.md`; no traced incident. The house shape is `group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`, so a force-push to a PR branch cannot leave two runs racing toward the same deploy target.
Upstream: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Keep CI feedback under 5 minutes by path-filtering per service

Why: distilled from the retired `references/ci-cd-pipelines.md`; the house budget was written as "tests complete in < 5 min" and was met by scoping `on.push.paths` and `on.pull_request.paths` to `backend/**` and `frontend/**`, so a frontend-only PR never pays for the Python matrix.
Upstream: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow

## Gate integration tests behind a service-container health check before the first query

Why: distilled from the retired `examples/github-actions-cicd.md`; the Postgres service carried `--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5` so pytest never opened a connection to a socket that was not listening yet. This is an ordering constraint, not decoration.
Upstream: https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers

## Deploy the exact image SHA that CI tested, never a rebuild

Why: house rule. The retired `examples/github-actions-cicd.md` tagged images `${{ github.sha }}` at build time but then deployed with `aws ecs update-service --force-new-deployment`, which pins nothing and re-pulls whatever the task definition points at. That gap is the reason this rule is written down rather than assumed: tag with the SHA AND reference that tag in the deploy step, so "the artifact we tested" and "the artifact we shipped" are byte-for-byte identical. Production deploys additionally sit behind `environment: production` for the approval gate.
Upstream: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

## Invalidate the CDN after the object sync, never before

Why: distilled from the retired `examples/github-actions-cicd.md`; the static frontend deploy runs `aws s3 sync dist/ --delete` and only then `cloudfront create-invalidation --paths "/*"`. Invalidating first re-caches the old bundle straight back from a not-yet-updated origin.
Upstream: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html

## Run the dependency and image scan weekly at HIGH,CRITICAL

Why: distilled from the retired `examples/github-actions-cicd.md`; the house schedule is `cron: "0 0 * * 0"` plus `workflow_dispatch`, with `npm audit --audit-level=high`, `pip-audit`, and Trivy pinned to `severity: HIGH,CRITICAL`. The severity floor is what keeps the weekly gate actionable rather than advisory.
Upstream: https://trivy.dev/latest/docs/configuration/filtering/

## Size the three Kubernetes probes as one budget, not as copies of each other

Why: distilled from the retired `references/kubernetes-basics.md`; the house numbers are startup `periodSeconds: 5` with `failureThreshold: 30` (a 150s boot ceiling), liveness `initialDelaySeconds: 60`, `periodSeconds: 10`, `failureThreshold: 3`, readiness `initialDelaySeconds: 10`, `periodSeconds: 5`, `failureThreshold: 2`. Readiness must fail fastest because pulling a pod out of the load balancer is cheap, and liveness slowest because a restart is not: liveness polls at half the readiness rate for exactly that reason.
Upstream: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

## Set both requests and limits on every container, limits at twice requests

Why: distilled from the retired `references/kubernetes-basics.md`; the house baseline is requests `128Mi` / `100m` and limits `256Mi` / `200m`. Requests drive scheduling and limits drive throttling, so omitting requests makes the scheduler blind to the pod and omitting limits lets one pod starve the node.
Upstream: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

## Ship a PodDisruptionBudget with minAvailable 2 for anything that takes traffic

Why: distilled from the retired `references/kubernetes-basics.md`; without a PDB a cluster upgrade node drain or an autoscaler downscale can evict every replica at once, which is a self-inflicted outage during planned maintenance. The house floor of 2 keeps a serving quorum through voluntary disruptions.
Upstream: https://kubernetes.io/docs/tasks/run-application/configure-pdb/

## Pull secrets through External Secrets Operator on a 1h refresh, never into Git

Why: `SKILL.md` Key Decisions picks External Secrets Operator so the cloud secret store stays the source of truth and the in-cluster Secret is derived. The house config is `refreshInterval: 1h` with `creationPolicy: Owner`, so a hand-edited Kubernetes Secret is reconciled away instead of silently persisting as undocumented drift.
Upstream: https://external-secrets.io/latest/api/externalsecret/

## Enable ArgoCD prune and selfHeal together, with a bounded retry

Why: distilled from the retired `references/environment-management.md`; `prune: true` without `selfHeal: true` leaves manual cluster edits standing and makes Git only a partial truth. The house retry is `limit: 5` with backoff from `5s` to a `3m` cap, so a transient API-server blip does not park the application in Degraded.
Upstream: https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/

## Keep Terraform state remote with a lock table, and pin the CLI floor

Why: distilled from the retired `references/environment-management.md`; the house backend is S3 with `dynamodb_table = "terraform-locks"` and `required_version = ">= 1.5"`. Two concurrent applies without the lock table corrupt state, and corrupt state is not recoverable the way a failed apply is.
Upstream: https://developer.hashicorp.com/terraform/language/backend/s3

## Rehearse the rollback, do not just document it

Why: distilled from the retired `references/environment-management.md` and `checklists/production-readiness.md`; both carried the same standing instruction, that a rollback path is only real once it has been executed. The three house handles are `helm rollback <release> <revision>`, `kubectl rollout undo deployment/<name>`, and `alembic downgrade -1`, and the same rehearsal rule applies to backup restore, not only to backup creation.
Upstream: https://helm.sh/docs/helm/helm_rollback/

## Alert on the house thresholds, and always require a dwell window

Why: distilled from the retired `references/observability.md`; the numbers are error rate above 5% critical, p95 latency above 2s warning, CPU above 80% sustained, and memory above 85% sustained. Every rule carries `for:` (5m for rate and latency, 10m for crash-loop) so a single bad scrape does not page anyone.

Pod restarts carry TWO numbers in the retired file and they are not interchangeable. The operative alerting rule is `increase(kube_pod_container_status_restarts_total[1h]) > 5` with `for: 10m`, which is what actually pages. The dashboard summary table lists `> 3 in 1 hour` as the review threshold, the point at which a human should look without being woken. Use 5 for the alert and 3 for review; collapsing them into one number either pages on ordinary rollout churn or misses a real crash loop.
Upstream: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/

## Bind the request id into log context before the handler runs, and echo it on the response

Why: distilled from the retired `references/observability.md`; the logging middleware opens `structlog.contextvars.bound_contextvars(request_id=...)` around `await call_next(request)` and sets `X-Request-ID` on the way out. Bind after the handler and every log line emitted inside it is unattributable; drop the header and a user-reported failure cannot be walked back to a log line.
Upstream: https://www.structlog.org/en/stable/contextvars.html

## Hold the house ResourceQuota baseline per namespace

Why: distilled from the retired `references/kubernetes-basics.md`. The numbers are
`requests.cpu: "10"`, `requests.memory: 20Gi`, `limits.cpu: "20"`, `limits.memory: 40Gi`,
`pods: "50"`. Kubernetes documents what a ResourceQuota is and how it is enforced but
cannot supply a house baseline, and a namespace shipped without one lets a single
runaway Deployment starve every neighbour on the node pool. Treat these as the starting
allocation and raise them deliberately, per namespace, rather than omitting the object.
Upstream: https://kubernetes.io/docs/concepts/policy/resource-quotas/

## Pin the CI toolchain to Python 3.12 and Node 20, and matrix-test Node 20, 22 and 24

Why: distilled from the retired `examples/github-actions-cicd.md` and
`references/ci-cd-pipelines.md`. The single-version jobs pin `python-version: "3.12"` and
`node-version: "20"`; the compatibility matrix runs `node-version: [20, 22, 24]` across
`os: [ubuntu-latest, windows-latest]`. These are house choices, not upstream defaults:
an unpinned `setup-node` silently follows the runner image and turns an unrelated image
bump into a red build with no code change behind it.
Upstream: https://github.com/actions/setup-node and https://github.com/actions/setup-python

## Gate release on 80 percent unit coverage, and name the tool for every pre-launch check

Why: distilled from the retired `checklists/production-readiness.md`. The house floor is
`>80%` unit coverage before release. The same checklist named the tool for each remaining
gate, and the names are the useful part: k6 or Locust for the load test, OWASP ZAP for
the security scan. It also carried reliability items that no upstream row can supply:
graceful shutdown handling, circuit breakers and timeouts on every external call,
point-in-time recovery enabled, and multi-AZ deployment. Circuit breakers, retries and
timeouts are owned by the in-repo `distributed-systems` skill; the rest are checks this
skill still expects before a release goes out.
Upstream: the in-repo `ork:testing-perf`, `ork:security-patterns` and
`ork:distributed-systems` skills

# Production Readiness Checklist

## 🔒 Security

- [ ] Secrets in environment variables or vault (not in code/config)
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] CORS restricted to known origins
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding, CSP)
- [ ] Dependencies scanned for vulnerabilities
- [ ] Container images scanned (Trivy/Snyk)

## 🧪 Testing

- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests for critical paths
- [ ] Load testing completed (k6/Locust)
- [ ] Security testing (OWASP ZAP)
- [ ] Smoke tests for deployment verification

## 📊 Observability

- [ ] Structured logging (JSON format)
- [ ] Log aggregation configured (ELK/Loki)
- [ ] Metrics exported (Prometheus format)
- [ ] Dashboards created (Grafana)
- [ ] Distributed tracing enabled (Jaeger/Tempo)
- [ ] Error tracking configured (Sentry)
- [ ] Uptime monitoring (synthetic checks)
- [ ] Alerting rules defined

## 🚀 Deployment

- [ ] CI/CD pipeline configured
- [ ] Automated tests run on every PR
- [ ] Blue-green or canary deployment ready
- [ ] Rollback procedure documented and tested
- [ ] Database migrations tested
- [ ] Feature flags for risky changes
- [ ] Deployment notifications (Slack/Teams)

## 💾 Data

- [ ] Database backups automated (daily)
- [ ] Backup restoration tested
- [ ] Point-in-time recovery enabled
- [ ] Data retention policies defined
- [ ] PII handling documented (GDPR/CCPA)
- [ ] Encryption at rest enabled
- [ ] Encryption in transit (TLS)

## 🏗️ Infrastructure

- [ ] Infrastructure as Code (Terraform/Pulumi)
- [ ] Auto-scaling configured
- [ ] Health checks defined
- [ ] Resource limits set (CPU/memory)
- [ ] Multi-AZ deployment
- [ ] CDN for static assets
- [ ] DDoS protection enabled

## 📝 Documentation

- [ ] API documentation (OpenAPI)
- [ ] Architecture diagram
- [ ] Runbook for common issues
- [ ] Incident response playbook
- [ ] On-call rotation defined
- [ ] SLA/SLO documented

## 🔄 Reliability

- [ ] Graceful shutdown handling
- [ ] Connection pooling configured
- [ ] Circuit breakers for external calls
- [ ] Retry with exponential backoff
- [ ] Timeouts set on all external calls
- [ ] Chaos engineering tests (optional)

## Pre-Launch Final Checks

```bash
# Security scan
npm audit --audit-level=high
pip-audit

# Performance baseline
k6 run load-test.js

# DNS and SSL
curl -I https://api.example.com
openssl s_client -connect api.example.com:443

# Health endpoint
curl https://api.example.com/health

# Logs flowing
docker logs -f backend

# Metrics exposed
curl http://localhost:9090/metrics
```

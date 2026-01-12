# Pre-Deployment Security Checklist

## Before deploying any AI feature, verify all 8 layers:

### Layer 0: Edge Protection
- [ ] WAF rules active for OWASP Top 10
- [ ] Rate limiting configured per user/IP
- [ ] DDoS protection enabled
- [ ] HTTPS enforced (no HTTP)

### Layer 1: Gateway / Authentication
- [ ] JWT validation active
- [ ] Token expiry enforced
- [ ] RequestContext created from JWT (not user input)
- [ ] Permissions extracted from token

### Layer 2: Input Validation
- [ ] Pydantic/Zod models for all request bodies
- [ ] Size limits on all inputs
- [ ] PII detection on user-provided content
- [ ] Injection pattern detection (SQL, XSS, prompt)

### Layer 3: Authorization
- [ ] Every endpoint has authorization check
- [ ] RBAC/ABAC policies defined
- [ ] Cross-tenant access blocked
- [ ] Resource-level access verified

### Layer 4: Data Access
- [ ] All queries use parameterized values (no f-strings)
- [ ] All queries include tenant_id filter
- [ ] Repository pattern enforces tenant scope
- [ ] Vector search includes tenant filter

### Layer 5: LLM Orchestration
- [ ] No user_id in prompts
- [ ] No tenant_id in prompts
- [ ] No analysis_id in prompts
- [ ] No document_id in prompts
- [ ] No UUIDs in prompts
- [ ] Prompt audit check passes

### Layer 6: Output Validation
- [ ] LLM output parsed with schema
- [ ] Content guardrails active (toxicity, PII)
- [ ] Hallucination detection for critical fields
- [ ] Output size limits enforced

### Layer 7: Attribution & Storage
- [ ] Attribution uses RequestContext (not LLM output)
- [ ] Source references from pre-LLM lookup
- [ ] Audit event logged
- [ ] Data encrypted at rest

### Layer 8: Observability
- [ ] Structured logging active
- [ ] Sensitive data redacted from logs
- [ ] Langfuse tracing enabled
- [ ] Metrics exported (latency, errors, tokens)
- [ ] Alerts configured for anomalies

---

## Quick Verification Commands

```bash
# Check for IDs in prompt templates
grep -rn "user_id\|tenant_id\|analysis_id\|document_id" backend/app/**/prompts/

# Check for raw SQL (should use parameterized)
grep -rn "f\"SELECT\|f'SELECT" backend/app/

# Check for missing tenant filter
grep -rn "SELECT.*FROM" backend/app/ | grep -v "tenant_id"

# Run security linter
poetry run bandit -r backend/app/ -f json

# Check for hardcoded secrets
grep -rn "api_key\s*=\s*['\"]" backend/
```

---

**Sign-off required before merge:**
- [ ] Developer self-review
- [ ] Security checklist verified
- [ ] Code reviewer approved
- [ ] CI/CD security scans pass

# MCP Security Audit Checklist

Pre-deployment security checklist for MCP server implementations.

## Tool Description Security

### Sanitization

- [ ] All tool descriptions pass through sanitization pipeline
- [ ] Forbidden patterns are detected and redacted
- [ ] Encoding tricks are normalized (Base64, Unicode, URL, hex)
- [ ] Multi-turn injection patterns are blocked
- [ ] XML/Markdown injection vectors are filtered
- [ ] Maximum description length is enforced

### Injection Detection

- [ ] Instruction override patterns detected (`ignore previous`)
- [ ] Role hijack patterns detected (`you are now`)
- [ ] Context wipe patterns detected (`forget above`)
- [ ] Delimiter attacks detected (`<|...|>`)
- [ ] Privilege escalation language detected (`admin`, `sudo`)

## Tool Poisoning Prevention

### Zero-Trust Allowlist

- [ ] All tools require explicit vetting before use
- [ ] Hash verification enabled for tool descriptions
- [ ] Hash comparison performed on every invocation
- [ ] Rug pull detection alerts are configured
- [ ] Tool changes trigger automatic suspension

### Integrity Monitoring

- [ ] Tool fingerprints computed and stored at registration
- [ ] Description hash comparison enabled
- [ ] Parameter hash comparison enabled
- [ ] Change log maintained for audit
- [ ] Alerts configured for integrity failures

### Behavioral Analysis

- [ ] Sensitive path access monitoring enabled
- [ ] Data exfiltration detection configured
- [ ] Rate anomaly detection enabled
- [ ] Privilege escalation patterns monitored
- [ ] Suspicious host connections flagged

## Permission Management

### Capability Declarations

- [ ] All tools have explicit capability declarations
- [ ] Only required capabilities are granted
- [ ] Optional capabilities require explicit approval
- [ ] Capability declarations are version-controlled

### Path Restrictions

- [ ] Allowed path patterns defined
- [ ] Denied path patterns defined
- [ ] Sensitive paths always blocked:
  - [ ] `/etc/passwd`, `/etc/shadow`
  - [ ] `~/.ssh/**`, `~/.gnupg/**`
  - [ ] `**/*.pem`, `**/id_rsa*`
  - [ ] `**/.env`, `**/credentials*`
- [ ] Maximum path depth enforced

### Network Restrictions

- [ ] Allowed hosts explicitly listed
- [ ] Denied hosts explicitly listed
- [ ] Localhost access denied by default
- [ ] Raw IP access controlled
- [ ] Request size limits configured

### Approval Levels

| Capability | Required Level | Configured |
|------------|----------------|------------|
| File Read | Auto | [ ] |
| File Write | Confirm | [ ] |
| File Delete | Confirm | [ ] |
| Execute Safe | Notify | [ ] |
| Execute Unrestricted | Admin | [ ] |
| Network Outbound | Notify | [ ] |
| Database Read | Auto | [ ] |
| Database Write | Confirm | [ ] |
| Database Admin | Admin | [ ] |
| Sensitive Read | Confirm | [ ] |
| Sensitive Write | Admin | [ ] |
| PII Access | Admin | [ ] |
| Env Read | Notify | [ ] |
| Env Write | Blocked | [ ] |

## Session Security

### Session ID Generation

- [ ] Using `secrets.token_urlsafe(32)` or equivalent
- [ ] At least 256 bits of entropy
- [ ] No sensitive data encoded in session ID
- [ ] Format validation before use
- [ ] Checksums for tampering detection (if applicable)

### Session Lifecycle

- [ ] Maximum idle timeout configured (default: 30 min)
- [ ] Maximum lifetime configured (default: 24 hours)
- [ ] Session revocation mechanism implemented
- [ ] Expired session cleanup scheduled
- [ ] Maximum sessions per client enforced

### Rate Limiting

| Level | Limit | Window | Configured |
|-------|-------|--------|------------|
| Global | 10000 | 60s | [ ] |
| Per Session | 100 | 60s | [ ] |
| Per Tool | 30 | 60s | [ ] |
| Per Operation | 10 | 60s | [ ] |

- [ ] Rate limit headers returned in responses
- [ ] Retry-After header provided when limited
- [ ] Burst allowance configured appropriately

### Context Isolation

- [ ] Sessions have isolated execution contexts
- [ ] Variables are deep-copied to prevent leaks
- [ ] Context cleared on session end
- [ ] Cross-session data access blocked

## Human-in-the-Loop

### Approval Workflow

- [ ] High-risk operations require human approval
- [ ] Approval requests have timeout (default: 30s)
- [ ] Approval requests logged for audit
- [ ] Default to deny on timeout
- [ ] Approval bypass is blocked

### Operations Requiring Approval

- [ ] Unrestricted command execution
- [ ] Database admin operations
- [ ] Sensitive data write
- [ ] PII access
- [ ] Environment variable modification
- [ ] Process termination

## Audit Logging

### Events to Log

- [ ] Session creation and termination
- [ ] Tool invocation (with sanitized parameters)
- [ ] Capability usage
- [ ] Rate limit violations
- [ ] Authorization denials
- [ ] Integrity check failures
- [ ] Approval requests and decisions

### Log Security

- [ ] Logs do not contain sensitive data
- [ ] Session IDs are truncated in logs
- [ ] Tool arguments are sanitized before logging
- [ ] Log retention policy configured
- [ ] Log access is restricted

## Response Filtering

### Output Sanitization

- [ ] API keys redacted from responses
- [ ] Passwords redacted from responses
- [ ] Tokens and secrets redacted
- [ ] Private keys redacted
- [ ] Base64-encoded secrets detected

### Data Loss Prevention

- [ ] Maximum response size enforced
- [ ] Sensitive pattern scanning enabled
- [ ] PII detection configured
- [ ] Exfiltration alerts configured

## Infrastructure Security

### Server Configuration

- [ ] HTTPS/TLS required for all connections
- [ ] Certificate validation enabled
- [ ] Minimum TLS version 1.2
- [ ] Strong cipher suites only

### Deployment

- [ ] Principle of least privilege for server process
- [ ] Resource limits configured (CPU, memory)
- [ ] Network segmentation in place
- [ ] Secrets managed via secure vault

## Testing

### Security Tests

- [ ] Prompt injection test suite passes
- [ ] Rug pull detection tests pass
- [ ] Rate limit enforcement tests pass
- [ ] Session timeout tests pass
- [ ] Capability enforcement tests pass
- [ ] Context isolation tests pass

### Penetration Testing

- [ ] Tool description injection attempted
- [ ] Session hijacking attempted
- [ ] Rate limit bypass attempted
- [ ] Capability escalation attempted
- [ ] Data exfiltration attempted

## Documentation

### Security Documentation

- [ ] Threat model documented
- [ ] Security controls documented
- [ ] Incident response procedure documented
- [ ] Tool vetting process documented
- [ ] Approval workflow documented

### Compliance

- [ ] Security controls mapped to requirements
- [ ] Audit trail requirements met
- [ ] Data handling requirements met
- [ ] Access control requirements met

---

## Pre-Deployment Sign-Off

| Area | Reviewer | Date | Status |
|------|----------|------|--------|
| Tool Security | | | [ ] |
| Session Security | | | [ ] |
| Permission Management | | | [ ] |
| Rate Limiting | | | [ ] |
| Audit Logging | | | [ ] |
| Infrastructure | | | [ ] |
| Testing | | | [ ] |

**Final Approval:**

- [ ] All critical items addressed
- [ ] All high-priority items addressed
- [ ] Security testing completed
- [ ] Documentation updated
- [ ] Approved for deployment

Reviewer: _____________________ Date: _____________

---

## Quick Reference: Critical Items

These items MUST be complete before deployment:

1. **Tool Description Sanitization** - All descriptions sanitized
2. **Zero-Trust Allowlist** - All tools explicitly vetted
3. **Hash Verification** - Rug pull detection enabled
4. **Secure Session IDs** - Cryptographic generation
5. **Rate Limiting** - All levels configured
6. **HITL for Sensitive Ops** - Human approval required
7. **Audit Logging** - All security events logged
8. **Response Filtering** - Secrets redacted from output

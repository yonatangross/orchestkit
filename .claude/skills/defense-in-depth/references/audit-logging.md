# Audit Logging

## Purpose

Audit logs answer: **Who did What, When, Where, and Why?**

They're required for:
- Security incident investigation
- Compliance (SOC2, GDPR, HIPAA)
- Debugging production issues
- Usage analytics

## What to Log

### Always Log (Audit Events)

| Event Type | What to Log | Example |
|------------|-------------|---------|
| Authentication | Success/failure, method | "User login via OAuth" |
| Authorization | Decision, resource, action | "Access granted to analysis_123" |
| Data Access | Read/write, resource type | "Read 10 documents" |
| Data Modification | Before/after (hashed), resource | "Updated analysis status" |
| LLM Calls | Model, tokens, latency (NOT prompt) | "GPT-4, 1500 tokens, 2.3s" |
| Errors | Type, context (sanitized) | "ValidationError on /api/analyze" |

### Never Log (Sensitive Data)

| Data Type | Why Not | Alternative |
|-----------|---------|-------------|
| Passwords | Security | Log "password changed" event |
| API Keys | Security | Log key ID, not value |
| Full Prompts | May contain PII | Log prompt hash, token count |
| LLM Responses | May contain generated PII | Log response hash, length |
| User Content | Privacy | Log content hash, length |
| PII | GDPR/Privacy | Log anonymized or redacted |

## Implementation

### Sanitized Logger

```python
import structlog
import re
import hashlib
from typing import Any

class SanitizedLogger:
    """Logger that automatically redacts sensitive data"""

    REDACT_PATTERNS = {
        r"password": "[PASSWORD_REDACTED]",
        r"api[_-]?key": "[API_KEY_REDACTED]",
        r"secret": "[SECRET_REDACTED]",
        r"token": "[TOKEN_REDACTED]",
        r"authorization": "[AUTH_REDACTED]",
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}": "[EMAIL_REDACTED]",
    }

    HASH_FIELDS = {"prompt", "response", "content"}

    def __init__(self):
        self._logger = structlog.get_logger()

    def _sanitize(self, data: dict[str, Any]) -> dict[str, Any]:
        """Sanitize sensitive fields"""
        result = {}
        for key, value in data.items():
            # Hash content fields instead of logging
            if key.lower() in self.HASH_FIELDS:
                result[f"{key}_hash"] = hashlib.sha256(
                    str(value).encode()
                ).hexdigest()[:16]
                result[f"{key}_length"] = len(str(value))
                continue

            # Redact sensitive patterns
            str_value = str(value)
            for pattern, replacement in self.REDACT_PATTERNS.items():
                if re.search(pattern, key, re.IGNORECASE):
                    result[key] = replacement
                    break
                str_value = re.sub(pattern, replacement, str_value, flags=re.IGNORECASE)
            else:
                result[key] = str_value

        return result

    def audit(self, event: str, **kwargs):
        """Log an audit event with automatic sanitization"""
        sanitized = self._sanitize(kwargs)
        self._logger.info(
            event,
            audit=True,
            **sanitized,
        )

    def info(self, msg: str, **kwargs):
        self._logger.info(msg, **self._sanitize(kwargs))

    def error(self, msg: str, **kwargs):
        self._logger.error(msg, **self._sanitize(kwargs))
```

### Audit Event Structure

```python
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID

class AuditAction(Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    LLM_CALL = "llm_call"
    SEARCH = "search"

@dataclass
class AuditEvent:
    """Structured audit event"""
    # WHO
    user_id: UUID
    tenant_id: UUID
    session_id: str

    # WHAT
    action: AuditAction
    resource_type: str
    resource_id: UUID | None

    # WHEN
    timestamp: datetime

    # WHERE
    request_id: str
    trace_id: str
    ip_address: str
    user_agent: str

    # OUTCOME
    success: bool
    error_code: str | None = None

    # CONTEXT (sanitized)
    metadata: dict | None = None
```

### Usage in SkillForge

```python
# Authentication
logger.audit(
    "user.login",
    user_id=user.id,
    tenant_id=user.tenant_id,
    method="oauth",
    success=True,
)

# Data Access
logger.audit(
    "documents.search",
    user_id=ctx.user_id,
    tenant_id=ctx.tenant_id,
    query_hash=hash(query),  # Not the actual query
    result_count=len(results),
    success=True,
)

# LLM Call
logger.audit(
    "llm.generate",
    user_id=ctx.user_id,
    tenant_id=ctx.tenant_id,
    model="gpt-4",
    input_tokens=1500,
    output_tokens=500,
    latency_ms=2300,
    prompt_hash=hash(prompt),  # Not the actual prompt!
    success=True,
)

# Authorization Failure
logger.audit(
    "authorization.denied",
    user_id=ctx.user_id,
    tenant_id=ctx.tenant_id,
    action="analysis:delete",
    resource_id=analysis_id,
    reason="missing permission",
    success=False,
)
```

## Log Retention

| Environment | Retention | Reason |
|-------------|-----------|--------|
| Development | 7 days | Debugging |
| Staging | 30 days | Testing |
| Production | 1 year | Compliance |
| Security Events | 7 years | Legal requirements |

## Integration with Langfuse

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create trace for observability
trace = langfuse.trace(
    name="analysis",
    user_id=str(ctx.user_id),  # Langfuse supports user tracking
    session_id=ctx.session_id,
    metadata={
        "tenant_id": str(ctx.tenant_id),
        "request_id": ctx.request_id,
    },
)

# Log LLM call
generation = trace.generation(
    name="content_analysis",
    model="gpt-4",
    input=prompt,  # Langfuse handles securely
    output=response,
)
```

## Compliance Considerations

### GDPR
- Log data access but not the data itself
- Provide audit trail for subject access requests
- Log data deletion events

### SOC2
- Log all authentication events
- Log all authorization decisions
- Log all data modifications
- Retain logs for audit period

### HIPAA
- Log all access to PHI
- Log user ID, timestamp, action
- Never log PHI content in logs

# Prompt Audit

## Purpose

Before any prompt is sent to an LLM, audit it for forbidden content:

```
┌────────────────────────────────────────────────────────────┐
│                     PROMPT AUDIT                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Prompt Template + Variables ──► Audit ──► Send to LLM     │
│                                    │                       │
│                                    ▼                       │
│                          ┌──────────────┐                  │
│                          │  FORBIDDEN   │                  │
│                          │  PATTERNS    │                  │
│                          ├──────────────┤                  │
│                          │ • user_id    │                  │
│                          │ • tenant_id  │                  │
│                          │ • UUIDs      │                  │
│                          │ • API keys   │                  │
│                          │ • Tokens     │                  │
│                          │ • Secrets    │                  │
│                          └──────────────┘                  │
│                                    │                       │
│                    ┌───────────────┼───────────────┐       │
│                    ▼               ▼               ▼       │
│              ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│              │  CLEAN   │   │ WARNING  │   │  BLOCK   │   │
│              │          │   │          │   │          │   │
│              │ Proceed  │   │ Log +    │   │ Reject   │   │
│              │          │   │ Proceed  │   │          │   │
│              └──────────┘   └──────────┘   └──────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## SkillForge Forbidden Patterns

### Critical (Block Immediately)

| Pattern | Regex | Why Block |
|---------|-------|-----------|
| UUID | `[0-9a-f]{8}-[0-9a-f]{4}-...` | Hallucination, cross-tenant |
| API Key | `api[_-]?key` | Secret exposure |
| Token | `token\s*[:=]` | Auth exposure |
| Password | `password\s*[:=]` | Credential exposure |
| Secret | `secret\s*[:=]` | Generic secret |

### Warning (Log and Review)

| Pattern | Regex | Why Warn |
|---------|-------|----------|
| user_id | `user[_-]?id` | Likely context leak |
| tenant_id | `tenant[_-]?id` | Likely isolation leak |
| analysis_id | `analysis[_-]?id` | Likely tracking leak |
| document_id | `document[_-]?id` | Likely reference leak |
| session_id | `session[_-]?id` | Likely auth leak |

## Implementation

### 1. Pattern Definitions

```python
import re
from enum import Enum
from dataclasses import dataclass

class AuditSeverity(Enum):
    CLEAN = "clean"
    WARNING = "warning"
    CRITICAL = "critical"

@dataclass
class AuditViolation:
    pattern: str
    severity: AuditSeverity
    match: str
    position: int

# SkillForge-specific patterns
CRITICAL_PATTERNS = [
    # UUIDs
    (r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', "UUID"),
    # Secrets
    (r'api[_-]?key\s*[:=]\s*["\']?\S+', "API_KEY"),
    (r'password\s*[:=]\s*["\']?\S+', "PASSWORD"),
    (r'secret\s*[:=]\s*["\']?\S+', "SECRET"),
    (r'token\s*[:=]\s*["\']?\S+', "TOKEN"),
    (r'bearer\s+\S+', "BEARER_TOKEN"),
]

WARNING_PATTERNS = [
    # SkillForge identifiers
    (r'\buser[_-]?id\b', "USER_ID_FIELD"),
    (r'\btenant[_-]?id\b', "TENANT_ID_FIELD"),
    (r'\banalysis[_-]?id\b', "ANALYSIS_ID_FIELD"),
    (r'\bdocument[_-]?id\b', "DOCUMENT_ID_FIELD"),
    (r'\bartifact[_-]?id\b', "ARTIFACT_ID_FIELD"),
    (r'\bchunk[_-]?id\b', "CHUNK_ID_FIELD"),
    (r'\bsession[_-]?id\b', "SESSION_ID_FIELD"),
    (r'\btrace[_-]?id\b', "TRACE_ID_FIELD"),
    (r'\bworkflow[_-]?run[_-]?id\b', "WORKFLOW_ID_FIELD"),
]
```

### 2. Audit Function

```python
def audit_prompt(prompt: str) -> list[AuditViolation]:
    """
    Audit prompt for forbidden patterns.
    Returns list of violations.
    """
    violations = []

    # Check critical patterns
    for pattern, name in CRITICAL_PATTERNS:
        for match in re.finditer(pattern, prompt, re.IGNORECASE):
            violations.append(AuditViolation(
                pattern=name,
                severity=AuditSeverity.CRITICAL,
                match=match.group()[:50],  # Truncate for logging
                position=match.start(),
            ))

    # Check warning patterns
    for pattern, name in WARNING_PATTERNS:
        for match in re.finditer(pattern, prompt, re.IGNORECASE):
            violations.append(AuditViolation(
                pattern=name,
                severity=AuditSeverity.WARNING,
                match=match.group(),
                position=match.start(),
            ))

    return violations

def has_critical_violations(violations: list[AuditViolation]) -> bool:
    """Check if any violations are critical"""
    return any(v.severity == AuditSeverity.CRITICAL for v in violations)
```

### 3. Audit Decorator

```python
from functools import wraps
import structlog

logger = structlog.get_logger()

def audit_before_llm(func):
    """
    Decorator that audits prompts before LLM call.
    Blocks on critical violations, logs warnings.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract prompt from args/kwargs
        prompt = kwargs.get("prompt") or args[0]

        # Audit
        violations = audit_prompt(prompt)

        # Log warnings
        for v in violations:
            if v.severity == AuditSeverity.WARNING:
                logger.warning(
                    "prompt_audit_warning",
                    pattern=v.pattern,
                    position=v.position,
                )

        # Block on critical
        if has_critical_violations(violations):
            critical = [v for v in violations
                       if v.severity == AuditSeverity.CRITICAL]
            raise PromptSecurityError(
                f"Prompt contains forbidden content: {[v.pattern for v in critical]}"
            )

        # Proceed
        return await func(*args, **kwargs)

    return wrapper

# Usage
@audit_before_llm
async def call_llm(prompt: str) -> str:
    return await llm.generate(prompt)
```

### 4. Safe Prompt Builder

```python
class SafePromptBuilder:
    """
    Builds prompts with built-in audit.
    Prevents accidental ID inclusion.
    """

    def __init__(self):
        self._parts: list[str] = []
        self._context_ids: dict[str, Any] = {}  # Stored but never in prompt

    def add_instruction(self, text: str) -> "SafePromptBuilder":
        """Add instruction text (audited)"""
        violations = audit_prompt(text)
        if has_critical_violations(violations):
            raise PromptSecurityError("Instruction contains forbidden content")
        self._parts.append(text)
        return self

    def add_content(self, content: str) -> "SafePromptBuilder":
        """Add user content (sanitized)"""
        # Strip any IDs from content
        clean_content = self._sanitize(content)
        self._parts.append(clean_content)
        return self

    def add_context_texts(self, texts: list[str]) -> "SafePromptBuilder":
        """Add context texts (sanitized)"""
        for text in texts:
            clean = self._sanitize(text)
            self._parts.append(f"- {clean}")
        return self

    def store_context_id(self, key: str, value: Any) -> "SafePromptBuilder":
        """Store ID for post-LLM attribution (never in prompt)"""
        self._context_ids[key] = value
        return self

    def _sanitize(self, text: str) -> str:
        """Remove any IDs from text"""
        # Remove UUIDs
        text = re.sub(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '[ID]',
            text,
            flags=re.IGNORECASE
        )
        return text

    def build(self) -> tuple[str, dict]:
        """
        Build prompt and return with stored context.
        Returns: (prompt, context_ids)
        """
        prompt = "\n\n".join(self._parts)

        # Final audit
        violations = audit_prompt(prompt)
        if violations:
            logger.warning(
                "prompt_audit_final",
                violation_count=len(violations),
            )

        if has_critical_violations(violations):
            raise PromptSecurityError("Built prompt contains forbidden content")

        return prompt, self._context_ids

# Usage
builder = SafePromptBuilder()
prompt, context = (
    builder
    .add_instruction("Analyze the following content:")
    .add_content(user_query)
    .add_context_texts(retrieved_docs)
    .store_context_id("user_id", ctx.user_id)  # Stored, not in prompt
    .store_context_id("sources", source_refs)   # Stored, not in prompt
    .build()
)
```

## SkillForge Integration

### Workflow Integration

```python
# backend/app/workflows/agents/prompts/content_analysis.py

from llm_safety import SafePromptBuilder

def build_analysis_prompt(
    query: str,
    context_texts: list[str],
    ctx: RequestContext,
) -> tuple[str, dict]:
    """
    Build content analysis prompt safely.
    Context IDs stored separately for attribution.
    """
    return (
        SafePromptBuilder()
        .add_instruction("""
        You are an expert content analyzer. Analyze the following
        content and provide insights about:
        1. Key concepts
        2. Difficulty level
        3. Prerequisites
        4. Summary
        """)
        .add_instruction(f"User query: {query}")
        .add_instruction("Relevant context:")
        .add_context_texts(context_texts)
        .store_context_id("user_id", ctx.user_id)
        .store_context_id("tenant_id", ctx.tenant_id)
        .store_context_id("trace_id", ctx.trace_id)
        .build()
    )
```

### CI/CD Integration

```bash
#!/bin/bash
# scripts/audit_prompts.sh

echo "Auditing prompt templates..."

# Check for IDs in prompt files
grep -rn \
    "user_id\|tenant_id\|analysis_id\|document_id\|[0-9a-f]\{8\}-[0-9a-f]\{4\}" \
    backend/app/**/prompts/ \
    --include="*.py" \
    --include="*.txt" \
    --include="*.jinja2"

if [ $? -eq 0 ]; then
    echo "❌ Found potential ID leaks in prompts!"
    exit 1
fi

echo "✅ Prompt audit passed"
```

## Testing

```python
class TestPromptAudit:

    def test_detects_uuid(self):
        prompt = "Analyze doc 123e4567-e89b-12d3-a456-426614174000"
        violations = audit_prompt(prompt)

        assert len(violations) == 1
        assert violations[0].severity == AuditSeverity.CRITICAL
        assert violations[0].pattern == "UUID"

    def test_detects_api_key(self):
        prompt = "Use api_key: sk-1234567890abcdef"
        violations = audit_prompt(prompt)

        assert any(v.pattern == "API_KEY" for v in violations)

    def test_warns_on_user_id_field(self):
        prompt = "For user_id please provide analysis"
        violations = audit_prompt(prompt)

        assert len(violations) == 1
        assert violations[0].severity == AuditSeverity.WARNING

    def test_safe_builder_blocks_id(self):
        with pytest.raises(PromptSecurityError):
            (
                SafePromptBuilder()
                .add_instruction("Analyze for user 123e4567-e89b-12d3-a456-426614174000")
                .build()
            )

    def test_safe_builder_sanitizes_content(self):
        prompt, _ = (
            SafePromptBuilder()
            .add_content("Doc ID: 123e4567-e89b-12d3-a456-426614174000")
            .build()
        )

        assert "123e4567" not in prompt
        assert "[ID]" in prompt

    def test_context_ids_not_in_prompt(self):
        from uuid import uuid4

        user_id = uuid4()
        prompt, context = (
            SafePromptBuilder()
            .add_instruction("Analyze this")
            .store_context_id("user_id", user_id)
            .build()
        )

        assert str(user_id) not in prompt
        assert context["user_id"] == user_id
```

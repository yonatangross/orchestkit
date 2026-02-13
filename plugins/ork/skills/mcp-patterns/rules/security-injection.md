---
title: Security Injection Defense
impact: HIGH
impactDescription: "Unsanitized tool descriptions allow prompt injection attacks that can hijack LLM behavior, exfiltrate data, or override system instructions"
tags: security, prompt-injection, sanitization, encoding, tool-descriptions
---

## Security Injection Defense

Treat ALL tool descriptions as untrusted input. Normalize encodings, detect injection patterns, and sanitize before LLM exposure.

**Incorrect -- raw tool description passed to LLM:**
```python
# INJECTION RISK: description may contain "ignore previous instructions..."
prompt = f"Use this tool: {tool.description}"
tools = await mcp.list_tools()  # No validation!
```

**Correct -- sanitize tool descriptions before use:**
```python
import re

FORBIDDEN_PATTERNS = {
    "critical": [
        (r"ignore\s+(all\s+)?previous", "instruction_override"),
        (r"you\s+are\s+now", "role_hijack"),
        (r"forget\s+(everything|all|above)", "context_wipe"),
        (r"system\s*prompt", "system_access"),
    ],
    "high": [
        (r"IMPORTANT\s*:", "attention_hijack"),
        (r"override\s+(all\s+)?settings", "config_override"),
        (r"<\|.*?\|>", "delimiter_attack"),
        (r"reveal\s+(your|the)\s+(prompt|instructions)", "prompt_extraction"),
    ],
}

def sanitize_description(description: str) -> tuple[str, list[str]]:
    """Sanitize tool description. Returns (sanitized, detected_threats)."""
    if not description:
        return "", []

    threats = []
    sanitized = normalize_encodings(description)

    for level in ["critical", "high"]:
        for pattern, name in FORBIDDEN_PATTERNS[level]:
            if re.search(pattern, sanitized, re.I):
                threats.append(f"{level}:{name}")
                sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.I)

    return sanitized.strip(), threats
```

**Correct -- normalize encodings to reveal hidden attacks:**
```python
import html
import urllib.parse
import unicodedata

HOMOGLYPHS = {
    '\u0430': 'a', '\u0435': 'e', '\u043e': 'o',
    '\u0440': 'p', '\u0441': 'c', '\u0443': 'y',
}

def normalize_encodings(text: str) -> str:
    """Decode HTML entities, URL encoding, hex escapes, homoglyphs."""
    result = html.unescape(text)                          # &#73; -> I
    result = urllib.parse.unquote(result)                  # %69 -> i
    result = re.sub(                                       # \x69 -> i
        r'\\x([0-9a-fA-F]{2})',
        lambda m: chr(int(m.group(1), 16)),
        result,
    )
    result = unicodedata.normalize('NFKC', result)        # Unicode normalization
    for glyph, latin in HOMOGLYPHS.items():               # Cyrillic -> Latin
        result = result.replace(glyph, latin)
    return result
```

**Correct -- filter sensitive data from tool responses:**
```python
RESPONSE_FILTERS = [
    (r"api[_-]?key\s*[:=]\s*\S+", "[API_KEY_REDACTED]"),
    (r"password\s*[:=]\s*\S+", "[PASSWORD_REDACTED]"),
    (r"bearer\s+\S+", "[TOKEN_REDACTED]"),
    (r"-----BEGIN.*KEY-----[\s\S]*-----END.*KEY-----", "[PRIVATE_KEY_REDACTED]"),
]

def filter_tool_response(response: str) -> str:
    for pattern, replacement in RESPONSE_FILTERS:
        response = re.sub(pattern, replacement, response, flags=re.I)
    return response
```

**Key rules:**
- Always normalize encodings BEFORE pattern matching
- Block on critical threats (instruction override, role hijack)
- Redact high-severity patterns but allow the tool through
- Filter tool responses for secrets before they reach the LLM
- Test with known attack payloads: base64, homoglyphs, HTML entities

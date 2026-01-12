# Ty Type Checker Patterns (Rust-Based Python Type Checking)

## Overview

**Ty** is a Rust-based static type checker for Python that enforces stricter type safety than mypy. It requires explicit type annotations and runtime checks for type narrowing.

**Key Difference from mypy**: Ty cannot narrow types through simple conditionals - it requires explicit `isinstance()` checks and type annotations.

## Pattern: Safe Optional Extraction from Dicts

### Problem

When extracting values from dictionaries (e.g., agent results, API responses) for database storage, ty's type checker needs explicit help to understand type narrowing.

```python
# ❌ FAILS with ty - type checker can't narrow
result = {"findings": {...}, "confidence_score": 0.85}
findings_raw = result.get("findings", {})
confidence_raw = result.get("confidence_score")

# ty sees: object | None (can't narrow)
findings_to_save = findings_raw if isinstance(findings_raw, dict) else None
confidence_to_save = float(confidence_raw) if confidence_raw is not None else None
# Error: confidence_raw could be non-numeric!
```

### Solution: Explicit Type Annotations + isinstance Checks

```python
from typing import cast

# Extract from result dict
findings_raw = result.get("findings", {})
confidence_raw = result.get("confidence_score")

# Type-safe extraction with explicit annotations
findings_to_save: dict[str, object] | None = (
    cast("dict[str, object]", findings_raw) if isinstance(findings_raw, dict) else None
)
confidence_to_save: float | None = (
    float(confidence_raw) if isinstance(confidence_raw, (int, float)) else None
)
```

### Why This Works

1. **Explicit type annotation** (`findings_to_save: dict[str, object] | None`) tells ty the expected type
2. **isinstance() runtime check** proves to ty that the value is the expected type
3. **cast()** bridges the gap between runtime check and compile-time type
4. **Numeric type check** (`isinstance(x, (int, float))`) ensures `float()` won't fail

### Real-World Example: Agent Result Processing

```python
from typing import Any, cast

async def save_agent_result_to_db(
    agent_result: dict[str, Any],
    db_repo: AgentResultRepository
) -> None:
    """
    Save agent result to database with ty-compliant type safety.

    Args:
        agent_result: Raw dict from agent execution (untyped)
        db_repo: Database repository for persistence
    """
    # Extract raw values (ty sees these as object | None)
    findings_raw = agent_result.get("findings", {})
    confidence_raw = agent_result.get("confidence_score")
    metadata_raw = agent_result.get("metadata", {})
    tags_raw = agent_result.get("tags", [])

    # Type-safe extraction with explicit annotations
    findings: dict[str, object] | None = (
        cast("dict[str, object]", findings_raw)
        if isinstance(findings_raw, dict)
        else None
    )

    confidence: float | None = (
        float(confidence_raw)
        if isinstance(confidence_raw, (int, float))
        else None
    )

    metadata: dict[str, object] | None = (
        cast("dict[str, object]", metadata_raw)
        if isinstance(metadata_raw, dict)
        else None
    )

    tags: list[str] | None = (
        cast("list[str]", tags_raw)
        if isinstance(tags_raw, list) and all(isinstance(t, str) for t in tags_raw)
        else None
    )

    # Now db_repo methods receive properly typed values
    await db_repo.create(
        findings=findings,
        confidence_score=confidence,
        metadata=metadata,
        tags=tags
    )
```

## Pattern: Handling Mixed Numeric Types

### Problem

LLM responses or API results may return numeric values as strings, ints, or floats.

```python
# ❌ FAILS - ty can't guarantee str is numeric
score_raw = result.get("score")  # Could be "8.5", 8.5, or 8
score: float = float(score_raw)  # Error: score_raw could be None or non-numeric
```

### Solution: Defensive Type Checking

```python
score_raw = result.get("score")

# Option 1: Safe conversion with fallback
score: float | None = None
if isinstance(score_raw, (int, float)):
    score = float(score_raw)
elif isinstance(score_raw, str):
    try:
        score = float(score_raw)
    except ValueError:
        score = None

# Option 2: Inline with explicit annotation
score: float | None = (
    float(score_raw)
    if isinstance(score_raw, (int, float, str)) and (
        isinstance(score_raw, (int, float)) or score_raw.replace(".", "", 1).isdigit()
    )
    else None
)
```

## Pattern: List Type Narrowing

### Problem

Lists from untyped sources need element-level validation.

```python
# ❌ FAILS - ty can't guarantee list elements are strings
tags_raw = result.get("tags", [])
tags: list[str] = tags_raw  # Error: could be list[Any]
```

### Solution: Element-Level isinstance Check

```python
from typing import cast

tags_raw = result.get("tags", [])

# Validate all elements are strings
tags: list[str] | None = (
    cast("list[str]", tags_raw)
    if isinstance(tags_raw, list) and all(isinstance(t, str) for t in tags_raw)
    else None
)

# Alternative: Filter out non-strings
tags_filtered: list[str] = [
    t for t in tags_raw if isinstance(t, str)
] if isinstance(tags_raw, list) else []
```

## Pattern: Nested Dict Extraction

### Problem

Nested dictionaries require multiple levels of type checking.

```python
# ❌ FAILS - ty can't narrow nested access
config_raw = data.get("config", {})
timeout = config_raw.get("timeout", 30)  # Error: config_raw could be None
```

### Solution: Cascading isinstance Checks

```python
from typing import cast

config_raw = data.get("config", {})

# Safe nested access
timeout: int = 30  # Default
if isinstance(config_raw, dict):
    timeout_raw = config_raw.get("timeout")
    if isinstance(timeout_raw, int):
        timeout = timeout_raw
    elif isinstance(timeout_raw, str) and timeout_raw.isdigit():
        timeout = int(timeout_raw)

# Alternative: One-liner with explicit annotation
timeout: int = (
    int(cast("dict[str, Any]", config_raw).get("timeout", 30))
    if isinstance(config_raw, dict) and isinstance(config_raw.get("timeout"), int)
    else 30
)
```

## When to Use These Patterns

**Use explicit type annotations + isinstance checks when**:
- Extracting values from `dict[str, Any]` or `dict[str, object]`
- Processing LLM/API responses with unknown structure
- Converting between JSON and database models
- Handling optional numeric types from external sources
- Working with untyped third-party libraries

**Key Principle**: Ty requires proof of type safety. Provide that proof through:
1. Explicit type annotations (`: type | None`)
2. Runtime type checks (`isinstance(x, type)`)
3. cast() for bridging runtime → compile-time
4. Defensive conversions with try/except for strings

## Comparison: mypy vs ty

```python
# mypy (lenient) - both pass
x = data.get("value")
y = float(x) if x is not None else None

# ty (strict) - first fails, second passes
x = data.get("value")
y = float(x) if x is not None else None  # ❌ x could be non-numeric

x = data.get("value")
y: float | None = (
    float(x) if isinstance(x, (int, float)) else None  # ✅ Explicit check
)
```

## Resources

- **Ty documentation**: Coming soon (Rust-based type checker for Python)
- **Related skill**: `references/typescript-5-features.md` (similar strict patterns)
- **SkillForge usage**: Backend agent result processing (`backend/app/workflows/nodes/`)

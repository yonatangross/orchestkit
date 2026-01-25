---
name: compression-probes-template
description: Probe templates for validating compression quality
user-invocable: false
---

# Compression Probes Template

Use these probe templates to validate that compression preserved task-critical information.

---

## What Are Probes?

Probes are **targeted questions** that test whether compressed summaries contain critical information. Unlike ROUGE/BLEU scores, probes measure **functional preservation**—can the agent still complete the task?

---

## Probe Categories

### 1. File Path Probes

Test if file modifications are preserved:

```python
FILE_PROBES = [
    {
        "type": "file_path",
        "question": "What files were modified in this session?",
        "expected_keywords": ["src/auth.ts", "src/api/users.ts"],
        "critical": True
    },
    {
        "type": "file_changes",
        "question": "What changes were made to {file_path}?",
        "expected_keywords": ["OAuth flow", "token refresh"],
        "critical": True
    }
]
```

### 2. Decision Probes

Test if key decisions and rationale are preserved:

```python
DECISION_PROBES = [
    {
        "type": "decision",
        "question": "What technology choices were made?",
        "expected_keywords": ["JWT", "stateless"],
        "critical": True
    },
    {
        "type": "rationale",
        "question": "Why was {decision} chosen?",
        "expected_keywords": ["scaling", "horizontal"],
        "critical": False
    }
]
```

### 3. Error/Blocker Probes

Test if problems and resolutions are preserved:

```python
ERROR_PROBES = [
    {
        "type": "error",
        "question": "What errors were encountered?",
        "expected_keywords": ["CORS", "401"],
        "critical": True
    },
    {
        "type": "resolution",
        "question": "How was the {error} resolved?",
        "expected_keywords": ["allowlist", "origin"],
        "critical": False
    }
]
```

### 4. State Probes

Test if current progress is preserved:

```python
STATE_PROBES = [
    {
        "type": "progress",
        "question": "What is the current state of the task?",
        "expected_keywords": ["OAuth complete", "refresh in progress"],
        "critical": True
    },
    {
        "type": "next_steps",
        "question": "What are the next steps?",
        "expected_keywords": ["tests", "frontend"],
        "critical": True
    }
]
```

### 5. Intent Probes

Test if session goal is preserved:

```python
INTENT_PROBES = [
    {
        "type": "intent",
        "question": "What is the user trying to accomplish?",
        "expected_keywords": ["OAuth", "authentication", "Google"],
        "critical": True
    }
]
```

---

## Probe Generation Template

### From Original Messages

```python
def generate_probes(messages: list[dict]) -> list[dict]:
    probes = []

    for msg in messages:
        content = msg.get("content", "").lower()

        # File path detection
        file_paths = extract_file_paths(content)
        for path in file_paths:
            probes.append({
                "type": "file_path",
                "question": f"What changes were made to {path}?",
                "expected_keywords": extract_nearby_verbs(content, path),
                "critical": True,
                "source_message": msg["id"]
            })

        # Decision detection
        decision_markers = ["decided", "chose", "will use", "going with", "selected"]
        if any(marker in content for marker in decision_markers):
            probes.append({
                "type": "decision",
                "question": "What decisions were made in this session?",
                "expected_keywords": extract_decision_keywords(content),
                "critical": True
            })

        # Error detection
        error_markers = ["error", "failed", "exception", "bug", "issue", "problem"]
        if any(marker in content for marker in error_markers):
            probes.append({
                "type": "error",
                "question": "What errors or issues were encountered?",
                "expected_keywords": extract_error_keywords(content),
                "critical": True
            })

        # Blocker detection
        blocker_markers = ["blocked", "waiting", "need", "question", "unclear"]
        if any(marker in content for marker in blocker_markers):
            probes.append({
                "type": "blocker",
                "question": "What blockers or open questions exist?",
                "expected_keywords": extract_blocker_keywords(content),
                "critical": False
            })

    return dedupe_probes(probes)
```

---

## Probe Evaluation Template

### Evaluation Function

```python
def evaluate_compression(
    probes: list[dict],
    compressed_summary: str,
    llm: Any
) -> dict:
    """
    Evaluate if compressed summary passes probes.

    Returns:
        {
            "passed": int,
            "failed": int,
            "critical_failed": int,
            "score": float,
            "failed_probes": list[dict],
            "pass": bool
        }
    """
    results = {
        "passed": 0,
        "failed": 0,
        "critical_failed": 0,
        "failed_probes": []
    }

    for probe in probes:
        # Ask LLM to answer probe from summary only
        answer = llm.generate(f"""
Based ONLY on the following context, answer the question.
If the information is not present, say "Information not found."

CONTEXT:
{compressed_summary}

QUESTION: {probe['question']}

ANSWER:
""")

        # Check if expected keywords are present
        passed = any(
            keyword.lower() in answer.lower()
            for keyword in probe["expected_keywords"]
        )

        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["failed_probes"].append({
                **probe,
                "actual_answer": answer
            })
            if probe.get("critical", False):
                results["critical_failed"] += 1

    # Calculate score
    total = results["passed"] + results["failed"]
    results["score"] = results["passed"] / total if total > 0 else 0

    # Pass if score >= 90% AND no critical failures
    results["pass"] = (
        results["score"] >= 0.90 and
        results["critical_failed"] == 0
    )

    return results
```

---

## Example Probe Set

For a session about implementing OAuth:

```python
OAUTH_SESSION_PROBES = [
    # Intent
    {
        "type": "intent",
        "question": "What is being implemented?",
        "expected_keywords": ["OAuth", "authentication"],
        "critical": True
    },

    # Files
    {
        "type": "file_path",
        "question": "What file contains the OAuth implementation?",
        "expected_keywords": ["oauth.ts", "auth"],
        "critical": True
    },

    # Decisions
    {
        "type": "decision",
        "question": "How are tokens being stored?",
        "expected_keywords": ["cookie", "httpOnly"],
        "critical": True
    },
    {
        "type": "decision",
        "question": "What token format was chosen?",
        "expected_keywords": ["JWT"],
        "critical": False
    },

    # Errors
    {
        "type": "error",
        "question": "What authentication errors occurred?",
        "expected_keywords": ["CORS", "401"],
        "critical": False
    },

    # State
    {
        "type": "progress",
        "question": "Is the OAuth flow complete?",
        "expected_keywords": ["complete", "working", "done"],
        "critical": True
    },

    # Next steps
    {
        "type": "next_steps",
        "question": "What needs to be done next?",
        "expected_keywords": ["test", "frontend"],
        "critical": True
    }
]
```

---

## Passing Criteria

| Metric | Target | Action if Failed |
|--------|--------|------------------|
| Overall score | ≥90% | Recompress with more detail |
| Critical probes | 100% pass | Do not accept compression |
| Non-critical probes | ≥80% pass | Warning, review manually |

---

## Integration with Compression Flow

```python
def compress_with_validation(messages, existing_summary, llm):
    # Step 1: Generate compression
    new_summary = anchored_summarize(messages, existing_summary, llm)

    # Step 2: Generate probes from original
    probes = generate_probes(messages)

    # Step 3: Evaluate compression
    eval_result = evaluate_compression(probes, new_summary.to_markdown(), llm)

    # Step 4: Accept or retry
    if eval_result["pass"]:
        new_summary.probe_score = eval_result["score"]
        return new_summary
    else:
        # Retry with more detail
        detailed_summary = anchored_summarize(
            messages,
            existing_summary,
            llm,
            detail_level="high"  # Request more detail
        )
        return detailed_summary  # Or raise if still failing
```

---

## Probe Report Template

```markdown
# Compression Validation Report

**Timestamp:** 2026-01-05T10:30:00Z
**Messages Compressed:** 1-45
**Compression Ratio:** 90.4%

## Probe Results

| Category | Passed | Failed | Critical Failed |
|----------|--------|--------|-----------------|
| Intent | 1/1 | 0 | 0 |
| Files | 3/3 | 0 | 0 |
| Decisions | 2/2 | 0 | 0 |
| Errors | 1/2 | 1 | 0 |
| State | 2/2 | 0 | 0 |
| **Total** | **9/10** | **1** | **0** |

## Score: 90% ✅ PASS

## Failed Probes

### Error Probe (Non-Critical)
- **Question:** What authentication errors occurred?
- **Expected:** ["CORS", "401"]
- **Actual Answer:** "The summary mentions a configuration issue but doesn't specify the error type."
- **Action:** Consider preserving error details in future compressions

## Recommendation
Compression accepted. Minor detail loss on non-critical error information.
```

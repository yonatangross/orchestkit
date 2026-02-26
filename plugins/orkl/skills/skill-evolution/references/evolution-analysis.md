# Evolution Analysis Methodology

Reference guide for understanding how the skill evolution system analyzes patterns and generates suggestions.

## Pattern Detection Algorithm

### 1. Data Collection (PostTool Hook)

When a Write or Edit tool is used after a skill was recently loaded:

```
IF skill_loaded_within(5_minutes) AND tool IN (Write, Edit):
    content = get_edit_content()
    patterns = detect_patterns(content)
    IF patterns.length > 0:
        log_to_edit_patterns_jsonl(skill_id, patterns)
```

### 2. Pattern Matching

The system uses regex patterns to categorize edits:

```bash
PATTERN_DETECTORS=(
    ["add_pagination"]="limit.*offset|page.*size|cursor.*pagination|Paginated"
    ["add_rate_limiting"]="rate.?limit|throttl|RateLimiter|requests.?per"
    ["add_caching"]="@cache|cache_key|TTL|redis|memcache|@cached"
    ["add_retry_logic"]="retry|backoff|max_attempts|tenacity|Retry"
    ["add_error_handling"]="try.*catch|except|raise.*Exception|throw.*Error"
    ["add_validation"]="validate|Validator|@validate|Pydantic|Zod|yup"
    ["add_logging"]="logger\.|logging\.|console\.log|winston|pino"
    ["add_types"]=": *(str|int|bool|List|Dict|Optional)|interface\s|type\s.*="
    ["add_auth_check"]="@auth|@require_auth|isAuthenticated|requiresAuth"
    ["add_test_case"]="def test_|it\(|describe\(|expect\(|@pytest"
)
```

### 3. Frequency Calculation

For each skill with sufficient usage:

```
frequency = pattern_count / total_skill_uses
```

### 4. Confidence Scoring

Confidence combines frequency with sample size:

```
confidence = frequency × min(samples / 20, 1.0)
```

This means:
- 100% frequency with 5 samples = 0.25 confidence (needs more data)
- 100% frequency with 20+ samples = 1.0 confidence (high certainty)
- 70% frequency with 15 samples = 0.53 confidence (moderate)

## Suggestion Thresholds

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| MIN_SAMPLES | 5 | Prevent premature suggestions |
| ADD_THRESHOLD | 0.70 | 70%+ users add = suggest adding |
| REMOVE_THRESHOLD | 0.70 | 70%+ users remove = suggest removing |
| AUTO_APPLY_CONFIDENCE | 0.85 | Auto-apply if very high confidence |

## Suggestion Types

### Add Suggestions

Generated when users frequently add similar content:

```json
{
  "type": "add",
  "target": "template",
  "pattern": "add_pagination",
  "reason": "85% of users add pagination after using this skill"
}
```

### Remove Suggestions

Generated when users frequently remove generated content:

```json
{
  "type": "remove",
  "target": "template",
  "pattern": "remove_comments",
  "reason": "72% of users remove docstrings from generated code"
}
```

## Analysis Best Practices

1. **Wait for sufficient data**: Don't act on suggestions until MIN_SAMPLES reached
2. **Review high-confidence first**: Focus on suggestions with confidence > 0.80
3. **Consider context**: A pattern may be added for specific use cases only
4. **Monitor after changes**: Track success rate changes after evolution

## Interpreting Results

### High-Value Improvements

- Frequency > 80%, Confidence > 0.70
- Pattern is universally applicable
- Easy to add to skill template

### Conditional Improvements

- Frequency 50-80%
- May be context-dependent
- Consider adding as optional reference

### Skip/Investigate

- Frequency < 50%
- Might be edge case or user preference
- Review individual edit patterns for context
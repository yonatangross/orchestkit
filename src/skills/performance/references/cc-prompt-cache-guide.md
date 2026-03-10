# CC Prompt Cache Optimization Guide

## Why This Matters
CC 2.1.72 includes a prompt cache fix in SDK query() that reduces input token costs up to 12x. The cache works by recognizing repeated prefixes in prompts — if the first N tokens of a prompt match a cached entry, only the remaining tokens are billed at full rate.

## The Golden Rule
**Stable content FIRST, variable content LAST.**

## Prompt Structure Template
```
[1. SYSTEM ROLE & MODE]        ← stable, cached across invocations
[2. EVALUATION DIMENSIONS]     ← stable
[3. SCORING FORMULA]           ← stable
[4. TOOL BUDGET / CONSTRAINTS] ← stable
[5. OUTPUT FORMAT]             ← stable
[6. VARIABLE CONTENT]          ← unique per invocation (feature, topic, files)
```

## Before / After Examples

### Bad (cache-hostile):
```python
Agent(prompt=f"""BACKEND ARCH: {feature}
  Standards: FastAPI, Pydantic v2...
  Deliverables: API, schemas, models...""")
```
Cache reuse: ~10% (variable content invalidates prefix)

### Good (cache-friendly):
```python
Agent(prompt=f"""BACKEND ARCHITECTURE DESIGN

STANDARDS: FastAPI, Pydantic v2, SQLAlchemy 2.0 async
DELIVERABLES:
1. API endpoint design
2. Pydantic schemas
3. SQLAlchemy models
...
FEATURE: {feature}""")
```
Cache reuse: ~70% (stable prefix cached, only variable suffix is new)

## once:true Hook Pattern
Skills that spawn multiple agents with similar instructions should use `once: true` hooks to inject stable content once:

```yaml
hooks:
  PreToolUse:
    - matcher: "Agent"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/standards-loader"
      once: true  # Inject standards ONCE, all Agent spawns benefit
```

## Measuring Cache Efficiency
- Longer stable prefixes = higher cache hit rate
- Same role + same dimensions across agents = cache hits
- Variable content (feature names, file lists) should be < 30% of prompt

## Skills with Highest Cache Benefit
| Skill | Agents | Est. Savings |
|-------|--------|-------------|
| implement | 10 | ~400-500 tokens |
| review-pr | 6 | ~270-330 tokens |
| verify | 6 | ~210-270 tokens |
| fix-issue | 5 | ~150-175 tokens |
| brainstorm | 4 | ~100-120 tokens |

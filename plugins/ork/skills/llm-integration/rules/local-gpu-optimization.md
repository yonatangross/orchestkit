---
title: Tune GPU settings and provider factory patterns for maximum local inference performance
impact: HIGH
impactDescription: "Proper GPU tuning and provider factory patterns maximize local inference performance"
tags: [gpu, apple-silicon, ci, provider-factory, keep-alive, pre-warm]
---

# GPU Optimization & Provider Factory

## Provider Factory Pattern

```python
import os
from langchain_ollama import ChatOllama

def get_llm_provider(task_type: str = "general"):
    """Auto-switch between Ollama and cloud APIs."""
    if os.getenv("OLLAMA_ENABLED") == "true":
        models = {
            "reasoning": "deepseek-r1:70b",
            "coding": "qwen2.5-coder:32b",
            "general": "llama3.3:70b",
        }
        return ChatOllama(
            model=models.get(task_type, "llama3.3:70b"),
            keep_alive="5m"
        )
    else:
        # Fall back to cloud API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-5.2")

# Usage
llm = get_llm_provider(task_type="coding")
```

## Structured Output with Ollama

```python
from pydantic import BaseModel, Field

class CodeAnalysis(BaseModel):
    language: str = Field(description="Programming language")
    complexity: int = Field(ge=1, le=10)
    issues: list[str] = Field(description="Found issues")

structured_llm = llm.with_structured_output(CodeAnalysis)
result = await structured_llm.ainvoke("Analyze this code: ...")
# result is typed CodeAnalysis object
```

## CI Integration

```yaml
# GitHub Actions (self-hosted runner)
jobs:
  test:
    runs-on: self-hosted  # M4 Max runner
    env:
      OLLAMA_ENABLED: "true"
    steps:
      - name: Pre-warm models
        run: |
          curl -s http://localhost:11434/api/embeddings \
            -d '{"model":"nomic-embed-text","prompt":"warmup"}' > /dev/null

      - name: Run tests
        run: pytest tests/
```

## Pre-warming Models

```python
import httpx

async def prewarm_models() -> None:
    """Pre-warm Ollama models for faster first request."""
    async with httpx.AsyncClient() as client:
        # Warm embedding model
        await client.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": "warmup"},
            timeout=60.0,
        )

        # Warm reasoning model (minimal generation)
        await client.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "deepseek-r1:70b",
                "messages": [{"role": "user", "content": "Hi"}],
                "options": {"num_predict": 1},
            },
            timeout=120.0,
        )
```

## Apple Silicon Best Practices

- **DO** use `keep_alive="5m"` in CI (avoid cold starts)
- **DO** pre-warm models before first call
- **DO** set `num_ctx=32768` on Apple Silicon
- **DO** use provider factory for cloud/local switching
- **DON'T** use `keep_alive=-1` (wastes memory)
- **DON'T** skip pre-warming in CI (30-60s cold start)
- **DON'T** load more than 3 models simultaneously

**Incorrect — hardcoding cloud API with no local fallback:**
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-5.2")  # Always uses cloud, ignores local setup
response = await llm.ainvoke("Generate code...")
```

**Correct — provider factory switches between local and cloud:**
```python
import os
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

def get_llm_provider(task_type: str = "general"):
    if os.getenv("OLLAMA_ENABLED") == "true":
        return ChatOllama(model="qwen2.5-coder:32b", keep_alive="5m")
    return ChatOpenAI(model="gpt-5.2")

llm = get_llm_provider(task_type="coding")
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| keep_alive | 5m for CI, -1 for dev only |
| num_ctx | 32768 on Apple Silicon |
| max_loaded_models | 2-3 depending on RAM |
| Pre-warming | Always before CI tests |
| Cloud fallback | Provider factory pattern |

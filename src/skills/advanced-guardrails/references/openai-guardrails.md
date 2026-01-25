# OpenAI Guardrails

## Overview

OpenAI provides built-in moderation capabilities and a dedicated Moderation API for content safety. This reference covers using OpenAI's tools as a drop-in guardrails wrapper.

## Moderation API

### Basic Usage

```python
from openai import OpenAI

client = OpenAI()

def check_moderation(text: str) -> dict:
    """Check text against OpenAI moderation categories."""
    response = client.moderations.create(
        model="omni-moderation-latest",  # or "text-moderation-latest"
        input=text
    )

    result = response.results[0]
    return {
        "flagged": result.flagged,
        "categories": {
            cat: flagged
            for cat, flagged in result.categories.model_dump().items()
            if flagged
        },
        "scores": {
            cat: score
            for cat, score in result.category_scores.model_dump().items()
            if score > 0.1  # Only significant scores
        }
    }
```

### Moderation Categories (2026)

| Category | Description | Threshold |
|----------|-------------|-----------|
| `hate` | Hate speech targeting protected groups | 0.5 |
| `hate/threatening` | Hate with violence/harm intent | 0.3 |
| `harassment` | Harassing or bullying content | 0.5 |
| `harassment/threatening` | Harassment with threats | 0.3 |
| `self-harm` | Self-harm promotion/instructions | 0.3 |
| `self-harm/intent` | Expressing self-harm intent | 0.3 |
| `self-harm/instructions` | Instructions for self-harm | 0.2 |
| `sexual` | Sexual content | 0.5 |
| `sexual/minors` | Sexual content involving minors | 0.1 |
| `violence` | Violent content | 0.5 |
| `violence/graphic` | Graphic violence | 0.3 |
| `illicit` | Illegal activities | 0.5 |
| `illicit/violent` | Violent illegal activities | 0.3 |

### Drop-in Wrapper

```python
from openai import OpenAI
from functools import wraps
from typing import Callable, Any

client = OpenAI()

class ModerationError(Exception):
    """Raised when content fails moderation."""
    def __init__(self, categories: dict, scores: dict):
        self.categories = categories
        self.scores = scores
        super().__init__(f"Content flagged: {list(categories.keys())}")

def with_moderation(
    check_input: bool = True,
    check_output: bool = True,
    thresholds: dict[str, float] = None
):
    """Decorator to add moderation to any LLM function."""
    default_thresholds = {
        "hate": 0.5,
        "harassment": 0.5,
        "self-harm": 0.3,
        "sexual": 0.5,
        "violence": 0.5,
    }
    thresholds = {**default_thresholds, **(thresholds or {})}

    def check_content(text: str, label: str) -> None:
        """Check content against moderation API."""
        response = client.moderations.create(
            model="omni-moderation-latest",
            input=text
        )
        result = response.results[0]

        if result.flagged:
            flagged_categories = {}
            flagged_scores = {}

            for cat, flagged in result.categories.model_dump().items():
                if flagged:
                    score = getattr(result.category_scores, cat)
                    threshold = thresholds.get(cat.replace("/", "_"), 0.5)
                    if score >= threshold:
                        flagged_categories[cat] = True
                        flagged_scores[cat] = score

            if flagged_categories:
                raise ModerationError(flagged_categories, flagged_scores)

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            # Check input
            if check_input:
                input_text = kwargs.get("prompt") or kwargs.get("messages", [{}])[-1].get("content", "")
                if input_text:
                    check_content(input_text, "input")

            # Call function
            result = await func(*args, **kwargs)

            # Check output
            if check_output and isinstance(result, str):
                check_content(result, "output")

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            # Check input
            if check_input:
                input_text = kwargs.get("prompt") or kwargs.get("messages", [{}])[-1].get("content", "")
                if input_text:
                    check_content(input_text, "input")

            # Call function
            result = func(*args, **kwargs)

            # Check output
            if check_output and isinstance(result, str):
                check_content(result, "output")

            return result

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator

# Usage
@with_moderation(check_input=True, check_output=True)
async def generate_response(prompt: str) -> str:
    """Generate response with automatic moderation."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content
```

## Guardrails Service Class

```python
from openai import OpenAI, AsyncOpenAI
from dataclasses import dataclass
from enum import Enum
import asyncio

class ModerationAction(Enum):
    ALLOW = "allow"
    BLOCK = "block"
    WARN = "warn"
    FILTER = "filter"

@dataclass
class ModerationResult:
    action: ModerationAction
    flagged_categories: list[str]
    scores: dict[str, float]
    filtered_content: str | None = None
    message: str | None = None

class OpenAIGuardrails:
    """Drop-in OpenAI guardrails service."""

    def __init__(
        self,
        client: OpenAI | AsyncOpenAI = None,
        thresholds: dict[str, float] = None,
        default_action: ModerationAction = ModerationAction.BLOCK
    ):
        self.client = client or OpenAI()
        self.async_client = AsyncOpenAI() if not isinstance(client, AsyncOpenAI) else client
        self.thresholds = thresholds or {
            "hate": 0.5,
            "hate/threatening": 0.3,
            "harassment": 0.5,
            "harassment/threatening": 0.3,
            "self-harm": 0.3,
            "self-harm/intent": 0.3,
            "self-harm/instructions": 0.2,
            "sexual": 0.5,
            "sexual/minors": 0.1,
            "violence": 0.5,
            "violence/graphic": 0.3,
        }
        self.default_action = default_action

    def check(self, text: str) -> ModerationResult:
        """Synchronously check content."""
        response = self.client.moderations.create(
            model="omni-moderation-latest",
            input=text
        )
        return self._process_result(response.results[0], text)

    async def check_async(self, text: str) -> ModerationResult:
        """Asynchronously check content."""
        response = await self.async_client.moderations.create(
            model="omni-moderation-latest",
            input=text
        )
        return self._process_result(response.results[0], text)

    def _process_result(self, result, original_text: str) -> ModerationResult:
        """Process moderation result into actionable output."""
        if not result.flagged:
            return ModerationResult(
                action=ModerationAction.ALLOW,
                flagged_categories=[],
                scores={},
                filtered_content=original_text
            )

        flagged_categories = []
        scores = {}

        for cat, flagged in result.categories.model_dump().items():
            score = getattr(result.category_scores, cat)
            if flagged and score >= self.thresholds.get(cat, 0.5):
                flagged_categories.append(cat)
                scores[cat] = score

        if not flagged_categories:
            return ModerationResult(
                action=ModerationAction.ALLOW,
                flagged_categories=[],
                scores={},
                filtered_content=original_text
            )

        return ModerationResult(
            action=self.default_action,
            flagged_categories=flagged_categories,
            scores=scores,
            message=f"Content flagged for: {', '.join(flagged_categories)}"
        )

    async def validate_conversation(
        self,
        messages: list[dict]
    ) -> tuple[bool, list[ModerationResult]]:
        """Validate entire conversation history."""
        tasks = [
            self.check_async(msg["content"])
            for msg in messages
            if msg.get("content")
        ]
        results = await asyncio.gather(*tasks)

        all_passed = all(r.action == ModerationAction.ALLOW for r in results)
        return all_passed, results

# Usage
guardrails = OpenAIGuardrails(
    thresholds={"hate": 0.3},  # Stricter hate threshold
    default_action=ModerationAction.BLOCK
)

result = guardrails.check(user_input)
if result.action == ModerationAction.ALLOW:
    # Proceed with LLM call
    response = await generate_response(user_input)
else:
    # Handle blocked content
    return {"error": result.message}
```

## FastAPI Integration

```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel

app = FastAPI()
guardrails = OpenAIGuardrails()

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

class ChatResponse(BaseModel):
    response: str
    moderation_passed: bool

async def validate_input(request: ChatRequest) -> ChatRequest:
    """Dependency that validates input before processing."""
    result = await guardrails.check_async(request.message)

    if result.action == ModerationAction.BLOCK:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "content_policy_violation",
                "categories": result.flagged_categories,
            }
        )

    return request

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest = Depends(validate_input)):
    """Chat endpoint with automatic input moderation."""
    # Generate response
    response = await generate_llm_response(request.message)

    # Validate output
    output_result = await guardrails.check_async(response)
    if output_result.action != ModerationAction.ALLOW:
        response = "I apologize, but I cannot provide that response."

    return ChatResponse(
        response=response,
        moderation_passed=output_result.action == ModerationAction.ALLOW
    )
```

## Batch Moderation

```python
async def batch_moderate(texts: list[str]) -> list[ModerationResult]:
    """Efficiently moderate multiple texts."""
    # OpenAI supports batching up to 32 inputs
    batch_size = 32
    results = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = await guardrails.async_client.moderations.create(
            model="omni-moderation-latest",
            input=batch
        )
        for j, result in enumerate(response.results):
            results.append(guardrails._process_result(result, batch[j]))

    return results
```

## Streaming with Moderation

```python
async def stream_with_moderation(prompt: str):
    """Stream response with periodic moderation checks."""
    # Check input first
    input_result = await guardrails.check_async(prompt)
    if input_result.action != ModerationAction.ALLOW:
        yield {"error": "Input blocked by moderation"}
        return

    buffer = ""
    check_interval = 100  # Check every 100 chars

    async with client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    ) as stream:
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                buffer += content
                yield {"content": content}

                # Periodic moderation check
                if len(buffer) >= check_interval:
                    result = await guardrails.check_async(buffer)
                    if result.action != ModerationAction.ALLOW:
                        yield {"error": "Response blocked by moderation"}
                        return
                    buffer = ""

    # Final check on remaining buffer
    if buffer:
        result = await guardrails.check_async(buffer)
        if result.action != ModerationAction.ALLOW:
            yield {"error": "Response blocked by moderation"}
```

## Best Practices

1. **Always check both input and output**: Users can manipulate prompts, and models can generate unsafe content
2. **Use appropriate thresholds**: Lower for children's apps, higher for professional tools
3. **Log moderation failures**: Track violations for abuse detection
4. **Handle rate limits**: Moderation API has separate rate limits
5. **Consider latency**: Add moderation check time to response time budgets
6. **Use async for high throughput**: Batch and parallelize moderation checks

## Limitations

- **Not 100% accurate**: Some content may slip through or be falsely flagged
- **English-centric**: Works best with English text
- **No custom categories**: Cannot add domain-specific categories
- **No PII detection**: Must use separate service for PII
- **No fact-checking**: Only checks for harmful content, not accuracy

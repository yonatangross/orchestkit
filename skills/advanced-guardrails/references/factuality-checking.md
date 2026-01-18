# Factuality Checking

## Overview

Factuality checking validates that LLM outputs are grounded in provided context, preventing hallucinations and ensuring accuracy. This is critical for RAG systems, factual Q&A, and any application where accuracy matters.

## Approaches

| Approach | Speed | Accuracy | Cost |
|----------|-------|----------|------|
| **Keyword Overlap** | Fast | Low | Free |
| **NLI Models** | Medium | Medium | Low |
| **AlignScore** | Medium | High | Medium |
| **LLM-as-Judge** | Slow | High | High |
| **Hybrid** | Medium | Very High | Medium |

## Keyword Overlap (Fast Check)

```python
import re
from collections import Counter

def check_grounding_keywords(
    response: str,
    context: list[str],
    threshold: float = 0.3
) -> dict:
    """
    Fast grounding check using keyword overlap.
    Best for quick filtering before expensive checks.
    """
    # Extract meaningful words (4+ chars, not stopwords)
    stopwords = {
        "this", "that", "with", "from", "have", "been",
        "will", "would", "could", "should", "their", "there",
        "which", "about", "these", "those"
    }

    def extract_words(text: str) -> set:
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        return {w for w in words if w not in stopwords}

    response_words = extract_words(response)
    context_text = " ".join(context)
    context_words = extract_words(context_text)

    if not response_words:
        return {"grounded": False, "reason": "No content words in response"}

    overlap = response_words & context_words
    score = len(overlap) / len(response_words)

    return {
        "grounded": score >= threshold,
        "score": score,
        "matched_words": list(overlap)[:10],
        "unmatched_words": list(response_words - context_words)[:10],
    }
```

## NLI-Based Checking

```python
from transformers import pipeline

# Load NLI model (runs locally)
nli_pipeline = pipeline(
    "text-classification",
    model="facebook/bart-large-mnli",
    device=0  # GPU, or -1 for CPU
)

def check_grounding_nli(
    response: str,
    context: list[str],
    threshold: float = 0.7
) -> dict:
    """
    Check if response is entailed by context using NLI.
    Labels: entailment, neutral, contradiction
    """
    # Combine context
    premise = " ".join(context)[:1024]  # Truncate for model limits

    # Check each sentence in response
    sentences = response.split(".")
    results = []

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Format for NLI: premise entails hypothesis?
        result = nli_pipeline(
            f"{premise} [SEP] {sentence}",
            candidate_labels=["entailment", "neutral", "contradiction"]
        )

        results.append({
            "sentence": sentence,
            "label": result["labels"][0],
            "score": result["scores"][0],
            "grounded": result["labels"][0] == "entailment" and result["scores"][0] >= threshold
        })

    # Overall grounding
    grounded_count = sum(1 for r in results if r["grounded"])
    total = len(results)

    return {
        "grounded": grounded_count / total >= 0.7 if total > 0 else False,
        "score": grounded_count / total if total > 0 else 0,
        "sentence_results": results,
    }
```

## AlignScore (High Accuracy)

```python
from alignscore import AlignScore

# Initialize AlignScore (downloads model on first use)
scorer = AlignScore(
    model="roberta-large",
    device="cuda:0",  # or "cpu"
    ckpt_path="path/to/checkpoint"  # Download from AlignScore repo
)

def check_grounding_alignscore(
    response: str,
    context: list[str],
    threshold: float = 0.7
) -> dict:
    """
    High-accuracy grounding check using AlignScore.
    Best for critical applications (health, finance, legal).
    """
    context_text = " ".join(context)

    # AlignScore expects (context, claim) pairs
    score = scorer.score(
        contexts=[context_text],
        claims=[response]
    )[0]

    return {
        "grounded": score >= threshold,
        "score": score,
        "threshold": threshold,
    }
```

## LLM-as-Judge

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

FACTUALITY_PROMPT = """You are a factuality checker. Given a context and a response, determine if the response is fully supported by the context.

CONTEXT:
{context}

RESPONSE TO CHECK:
{response}

Evaluate the response for factual accuracy:
1. Is every claim in the response supported by the context?
2. Does the response add any information not in the context?
3. Are there any contradictions with the context?

Respond with JSON:
{{
    "grounded": true/false,
    "score": 0.0-1.0,
    "unsupported_claims": ["list of claims not in context"],
    "contradictions": ["list of contradictions"],
    "reasoning": "brief explanation"
}}"""

async def check_grounding_llm(
    response: str,
    context: list[str],
    threshold: float = 0.7
) -> dict:
    """
    LLM-based grounding check (most accurate, highest cost).
    Use for high-stakes outputs or when other methods are uncertain.
    """
    context_text = "\n".join(context)

    llm_response = await client.chat.completions.create(
        model="gpt-4o-mini",  # Cheaper model for evaluation
        messages=[{
            "role": "user",
            "content": FACTUALITY_PROMPT.format(
                context=context_text,
                response=response
            )
        }],
        response_format={"type": "json_object"},
        temperature=0,  # Deterministic for consistency
    )

    result = json.loads(llm_response.choices[0].message.content)

    return {
        "grounded": result.get("grounded", False) and result.get("score", 0) >= threshold,
        **result
    }
```

## Hybrid Approach (Recommended)

```python
from dataclasses import dataclass
from enum import Enum

class GroundingLevel(Enum):
    HIGH = "high"      # AlignScore/LLM check passed
    MEDIUM = "medium"  # NLI check passed
    LOW = "low"        # Only keyword check passed
    NONE = "none"      # All checks failed

@dataclass
class GroundingResult:
    level: GroundingLevel
    score: float
    details: dict
    is_grounded: bool

async def check_grounding_hybrid(
    response: str,
    context: list[str],
    require_level: GroundingLevel = GroundingLevel.MEDIUM
) -> GroundingResult:
    """
    Multi-stage grounding check with early exit.
    More expensive checks only run if cheaper ones pass.
    """
    # Stage 1: Fast keyword check (gate)
    keyword_result = check_grounding_keywords(response, context, threshold=0.2)

    if not keyword_result["grounded"]:
        return GroundingResult(
            level=GroundingLevel.NONE,
            score=keyword_result["score"],
            details={"keyword": keyword_result},
            is_grounded=False
        )

    # Stage 2: NLI check
    nli_result = check_grounding_nli(response, context, threshold=0.6)

    if not nli_result["grounded"]:
        return GroundingResult(
            level=GroundingLevel.LOW,
            score=nli_result["score"],
            details={"keyword": keyword_result, "nli": nli_result},
            is_grounded=require_level == GroundingLevel.LOW
        )

    # Stage 3: LLM check (only for high requirements)
    if require_level == GroundingLevel.HIGH:
        llm_result = await check_grounding_llm(response, context, threshold=0.8)

        if not llm_result["grounded"]:
            return GroundingResult(
                level=GroundingLevel.MEDIUM,
                score=llm_result["score"],
                details={"keyword": keyword_result, "nli": nli_result, "llm": llm_result},
                is_grounded=False
            )

        return GroundingResult(
            level=GroundingLevel.HIGH,
            score=llm_result["score"],
            details={"keyword": keyword_result, "nli": nli_result, "llm": llm_result},
            is_grounded=True
        )

    return GroundingResult(
        level=GroundingLevel.MEDIUM,
        score=nli_result["score"],
        details={"keyword": keyword_result, "nli": nli_result},
        is_grounded=True
    )
```

## NeMo Integration

```colang
# In config/rails/factcheck.co

define flow check facts
  """Verify response is grounded in retrieved context."""
  bot $response
  $grounding_result = execute check_grounding(
    response=$response,
    context=$retrieved_context
  )

  if not $grounding_result.grounded
    if $grounding_result.score < 0.3
      $response = "I don't have enough information to answer that accurately."
    else
      $response = $response + "\n\nNote: Some details could not be verified."

define flow answer with citations
  """Provide answers with source citations."""
  user ask factual question
  $context = execute retrieve_documents(query=$user_message)
  $response = execute generate_with_citations(
    query=$user_message,
    context=$context
  )
  $check_facts = True  # Enable fact-checking rail
  bot $response
```

## Domain-Specific Thresholds

| Domain | Threshold | Rationale |
|--------|-----------|-----------|
| Healthcare | 0.9+ | Patient safety critical |
| Finance | 0.85+ | Financial decisions impact |
| Legal | 0.9+ | Legal accuracy required |
| Customer Support | 0.7 | Helpful but not critical |
| Creative Writing | 0.3 | Factuality less important |
| General Q&A | 0.6 | Balance accuracy and helpfulness |

## Handling Failures

```python
async def generate_with_factuality(
    query: str,
    context: list[str],
    max_retries: int = 2
) -> dict:
    """Generate response with factuality enforcement."""
    for attempt in range(max_retries + 1):
        # Generate response
        response = await generate_llm_response(query, context)

        # Check grounding
        result = await check_grounding_hybrid(
            response, context,
            require_level=GroundingLevel.MEDIUM
        )

        if result.is_grounded:
            return {
                "response": response,
                "grounding": result,
                "attempts": attempt + 1
            }

        # Retry with stronger grounding instruction
        if attempt < max_retries:
            query = f"""Based ONLY on the provided context, answer: {query}

IMPORTANT: Only include information that is explicitly stated in the context.
If the context doesn't contain the answer, say "I don't have that information."
"""

    # All retries failed
    return {
        "response": "I cannot provide a verified answer to that question based on the available information.",
        "grounding": result,
        "attempts": max_retries + 1,
        "fallback": True
    }
```

## Metrics and Monitoring

```python
from prometheus_client import Counter, Histogram

grounding_checks = Counter(
    "grounding_checks_total",
    "Total grounding checks",
    ["level", "result"]
)

grounding_score = Histogram(
    "grounding_score",
    "Grounding score distribution",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

async def check_with_metrics(response: str, context: list[str]) -> GroundingResult:
    """Grounding check with Prometheus metrics."""
    result = await check_grounding_hybrid(response, context)

    grounding_checks.labels(
        level=result.level.value,
        result="grounded" if result.is_grounded else "ungrounded"
    ).inc()

    grounding_score.observe(result.score)

    return result
```

## Best Practices

1. **Use hybrid approach**: Fast checks gate expensive ones
2. **Set domain-appropriate thresholds**: Stricter for critical domains
3. **Log ungrounded responses**: Track hallucination patterns
4. **Provide fallbacks**: Never return unverified content silently
5. **Include citations**: Help users verify information
6. **Monitor over time**: Track grounding scores for model drift

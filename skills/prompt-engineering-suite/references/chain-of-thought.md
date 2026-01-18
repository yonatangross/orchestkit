# Chain-of-Thought Patterns

Improve LLM accuracy on complex reasoning tasks by eliciting step-by-step thinking.

## Zero-Shot CoT

The simplest approach: append "Let's think step by step" to any prompt.

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def zero_shot_cot(question: str) -> str:
    """Apply zero-shot Chain-of-Thought."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": f"{question}\n\nLet's think step by step."
        }]
    )
    return response.choices[0].message.content
```

**When to use:** Quick reasoning boost, math problems, logic puzzles.

## Structured CoT Template

For complex problems, use an explicit format:

```python
COT_SYSTEM_PROMPT = """You are an expert problem solver.

When solving problems, follow this process:

1. UNDERSTAND: Restate the problem in your own words
2. PLAN: Outline your approach before solving
3. EXECUTE: Work through each step showing calculations
4. VERIFY: Check your answer makes sense
5. ANSWER: State your final answer clearly

Format:
## Understanding
[Your restatement]

## Plan
[Your approach]

## Execution
Step 1: [work]
Step 2: [work]
...

## Verification
[Sanity check]

## Final Answer
[Your answer]"""
```

## Self-Consistency

Generate multiple reasoning paths and vote on the answer:

```python
import asyncio
from collections import Counter

async def self_consistent_cot(
    question: str,
    n_paths: int = 5,
    temperature: float = 0.7
) -> dict:
    """Generate multiple CoT paths and vote on answer."""

    async def generate_path() -> str:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"{question}\n\nThink step by step, then give your final answer on the last line starting with 'Answer:'"
            }],
            temperature=temperature
        )
        return response.choices[0].message.content

    # Generate multiple paths in parallel
    paths = await asyncio.gather(*[generate_path() for _ in range(n_paths)])

    # Extract answers
    answers = []
    for path in paths:
        if "Answer:" in path:
            answer = path.split("Answer:")[-1].strip()
            answers.append(answer)

    # Vote
    if not answers:
        return {"answer": None, "confidence": 0, "paths": paths}

    counter = Counter(answers)
    most_common, count = counter.most_common(1)[0]

    return {
        "answer": most_common,
        "confidence": count / len(answers),
        "paths": paths,
        "vote_distribution": dict(counter)
    }
```

## CoT with Verification

Add a verification step to catch errors:

```python
async def cot_with_verification(question: str) -> dict:
    """CoT with explicit verification step."""

    # Step 1: Generate initial answer with CoT
    initial = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": f"{question}\n\nThink step by step."
        }]
    )
    reasoning = initial.choices[0].message.content

    # Step 2: Verify the reasoning
    verification = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": f"""Review this reasoning for errors:

Question: {question}

Reasoning:
{reasoning}

Check each step for errors. If you find any, provide the correct answer.
If the reasoning is correct, confirm it.

Format:
Verification: [CORRECT or ERROR]
Explanation: [why]
Final Answer: [answer]"""
        }]
    )

    return {
        "reasoning": reasoning,
        "verification": verification.choices[0].message.content
    }
```

## Best Practices

1. **Use explicit format** - Structure helps LLM organize thoughts
2. **Request verification** - Ask LLM to check its own work
3. **Temperature > 0** for self-consistency - Need diversity in paths
4. **5-10 paths** for self-consistency - Balance accuracy vs cost
5. **Parse answers carefully** - Use consistent answer format

## When NOT to Use CoT

- Simple factual lookups ("What is the capital of France?")
- Classification with clear labels
- Very short responses
- High-throughput low-stakes tasks (adds latency + cost)

## Performance Impact

| Task Type | Zero-shot | Zero-shot CoT | Few-shot CoT |
|-----------|-----------|---------------|--------------|
| Math word problems | 17% | 78% | 93% |
| Symbolic reasoning | 20% | 65% | 89% |
| Commonsense | 62% | 74% | 85% |
| Simple QA | 89% | 87% | 88% |

*Based on Wei et al. (2022) Chain-of-Thought paper benchmarks*

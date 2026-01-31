"""
Chain-of-Thought Prompt Template

Production-ready CoT implementation with:
- Structured reasoning format
- Self-consistency (multiple paths)
- Verification step
- Langfuse observability integration

Usage:
    from templates.cot_template import cot_solve, self_consistent_solve

    # Single CoT
    result = await cot_solve("What is 15% of 240?", client)

    # Self-consistent (multiple paths)
    result = await self_consistent_solve("Complex problem...", client, n_paths=5)
"""

import asyncio
import re
from collections import Counter
from typing import Any

from langfuse.decorators import langfuse_context, observe
from openai import AsyncOpenAI


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_MODEL = "gpt-4o"
SELF_CONSISTENCY_TEMPERATURE = 0.7
DEFAULT_PATHS = 5


# =============================================================================
# System Prompts
# =============================================================================

COT_SYSTEM_PROMPT = """You are an expert problem solver that thinks step-by-step.

When solving problems, follow this structured approach:

## Understanding
First, restate the problem in your own words to ensure you understand it.

## Plan
Outline your approach before executing. List the steps you will take.

## Execution
Work through each step, showing your reasoning:
- Step 1: [action and result]
- Step 2: [action and result]
- Continue as needed...

## Verification
Check your answer:
- Does it make sense?
- Did you address all parts of the problem?
- Are there any edge cases?

## Final Answer
State your final answer clearly, starting with "FINAL ANSWER:"

IMPORTANT: Always show your work. Never skip steps."""


COT_USER_TEMPLATE = """Problem: {problem}

Please solve this step-by-step using the structured format."""


VERIFICATION_PROMPT = """Review this reasoning for errors:

Problem: {problem}

Reasoning:
{reasoning}

Tasks:
1. Check each step for mathematical or logical errors
2. Verify the final answer is correct
3. If you find errors, provide the corrected answer

Response format:
Status: [CORRECT or ERROR]
Issues: [List any issues found, or "None"]
Corrected Answer: [Only if Status is ERROR]"""


# =============================================================================
# Core Functions
# =============================================================================

@observe(name="cot_solve")
async def cot_solve(
    problem: str,
    client: AsyncOpenAI,
    model: str = DEFAULT_MODEL,
    verify: bool = True
) -> dict[str, Any]:
    """
    Solve a problem using Chain-of-Thought reasoning.

    Args:
        problem: The problem to solve
        client: AsyncOpenAI client
        model: Model to use
        verify: Whether to add verification step

    Returns:
        dict with reasoning, answer, and verification (if enabled)
    """
    # Generate reasoning
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": COT_SYSTEM_PROMPT},
            {"role": "user", "content": COT_USER_TEMPLATE.format(problem=problem)}
        ],
        temperature=0.2  # Lower temp for more focused reasoning
    )

    reasoning = response.choices[0].message.content

    # Extract final answer
    answer = extract_final_answer(reasoning)

    # Track in Langfuse
    langfuse_context.update_current_observation(
        metadata={
            "problem_length": len(problem),
            "reasoning_length": len(reasoning),
            "has_answer": answer is not None
        }
    )

    result = {
        "reasoning": reasoning,
        "answer": answer,
        "model": model
    }

    # Optional verification
    if verify:
        verification = await verify_reasoning(problem, reasoning, client, model)
        result["verification"] = verification
        result["verified_answer"] = verification.get("corrected_answer", answer)

    return result


@observe(name="self_consistent_solve")
async def self_consistent_solve(
    problem: str,
    client: AsyncOpenAI,
    n_paths: int = DEFAULT_PATHS,
    model: str = DEFAULT_MODEL,
    temperature: float = SELF_CONSISTENCY_TEMPERATURE
) -> dict[str, Any]:
    """
    Solve using self-consistency: generate multiple reasoning paths and vote.

    Args:
        problem: The problem to solve
        client: AsyncOpenAI client
        n_paths: Number of reasoning paths to generate
        model: Model to use
        temperature: Temperature for diversity (should be > 0)

    Returns:
        dict with answer, confidence, and all paths
    """
    async def generate_path() -> tuple[str, str | None]:
        """Generate one reasoning path."""
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": COT_SYSTEM_PROMPT},
                {"role": "user", "content": COT_USER_TEMPLATE.format(problem=problem)}
            ],
            temperature=temperature
        )
        reasoning = response.choices[0].message.content
        answer = extract_final_answer(reasoning)
        return reasoning, answer

    # Generate paths in parallel
    tasks = [generate_path() for _ in range(n_paths)]
    results = await asyncio.gather(*tasks)

    # Collect paths and answers
    paths = []
    answers = []
    for reasoning, answer in results:
        paths.append(reasoning)
        if answer:
            answers.append(answer)

    # Vote on most common answer
    if not answers:
        langfuse_context.update_current_observation(
            metadata={"error": "no_answers_extracted", "n_paths": n_paths}
        )
        return {
            "answer": None,
            "confidence": 0.0,
            "paths": paths,
            "error": "Could not extract answers from any path"
        }

    counter = Counter(answers)
    most_common, count = counter.most_common(1)[0]
    confidence = count / len(answers)

    # Track in Langfuse
    langfuse_context.update_current_observation(
        metadata={
            "n_paths": n_paths,
            "n_valid_answers": len(answers),
            "confidence": confidence,
            "vote_distribution": dict(counter)
        }
    )

    return {
        "answer": most_common,
        "confidence": confidence,
        "paths": paths,
        "vote_distribution": dict(counter),
        "n_paths": n_paths,
        "model": model
    }


@observe(name="verify_reasoning")
async def verify_reasoning(
    problem: str,
    reasoning: str,
    client: AsyncOpenAI,
    model: str = DEFAULT_MODEL
) -> dict[str, Any]:
    """
    Verify reasoning for errors.

    Returns:
        dict with status, issues, and corrected_answer if needed
    """
    response = await client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": VERIFICATION_PROMPT.format(problem=problem, reasoning=reasoning)
        }],
        temperature=0.1  # Low temp for careful verification
    )

    content = response.choices[0].message.content

    # Parse verification result
    status = "CORRECT" if "Status: CORRECT" in content else "ERROR"
    issues = extract_section(content, "Issues:")
    corrected = extract_section(content, "Corrected Answer:")

    return {
        "status": status,
        "issues": issues if issues and issues != "None" else None,
        "corrected_answer": corrected if status == "ERROR" else None,
        "raw_verification": content
    }


# =============================================================================
# Helper Functions
# =============================================================================

def extract_final_answer(reasoning: str) -> str | None:
    """Extract the final answer from reasoning text."""
    # Try "FINAL ANSWER:" format
    match = re.search(r"FINAL ANSWER:\s*(.+?)(?:\n\n|\Z)", reasoning, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try "The answer is:" format
    match = re.search(r"(?:the answer is|answer:)\s*(.+?)(?:\n|\Z)", reasoning, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    return None


def extract_section(text: str, header: str) -> str | None:
    """Extract a section from structured text."""
    pattern = rf"{re.escape(header)}\s*(.+?)(?:\n[A-Z]|\Z)"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None


# =============================================================================
# Usage Example
# =============================================================================

if __name__ == "__main__":
    async def main():
        client = AsyncOpenAI()

        # Simple CoT
        print("=== Single Chain-of-Thought ===")
        result = await cot_solve(
            "A store sells apples for $2 each. If you buy 5 or more, you get 20% off. "
            "How much would it cost to buy 7 apples?",
            client
        )
        print(f"Answer: {result['answer']}")
        print(f"Verified: {result.get('verification', {}).get('status')}")

        # Self-consistency
        print("\n=== Self-Consistent (5 paths) ===")
        result = await self_consistent_solve(
            "If a train travels at 60 mph for 2.5 hours, then at 80 mph for 1.5 hours, "
            "what is the total distance traveled?",
            client,
            n_paths=5
        )
        print(f"Answer: {result['answer']}")
        print(f"Confidence: {result['confidence']:.0%}")
        print(f"Votes: {result['vote_distribution']}")

    asyncio.run(main())

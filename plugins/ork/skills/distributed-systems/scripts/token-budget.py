"""
Token Budget Guard Template

Manages LLM context window limits with:
- Token counting (tiktoken)
- Budget allocation by category
- Automatic truncation/summarization
- Cost tracking

Usage:
    guard = TokenBudgetGuard(
        model="claude-sonnet-4-5-20251101",
        context_limit=200000,
    )

    fitted = guard.fit_to_budget(
        system_prompt=system,
        messages=conversation,
        retrieved_docs=rag_context,
    )
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class TruncationStrategy(Enum):
    """Strategy for truncating content that exceeds budget."""
    TRUNCATE_END = "truncate_end"      # Cut from the end
    TRUNCATE_START = "truncate_start"  # Cut from the start
    SUMMARIZE = "summarize"            # Summarize content
    SLIDING_WINDOW = "sliding_window"  # Keep most recent


@dataclass
class BudgetAllocation:
    """Token budget allocation by category."""
    system_prompt: int = 2000
    conversation: int = 20000
    retrieved_docs: int = 8000
    output_reserve: int = 2000
    safety_margin: int = 5000

    @property
    def total_budget(self) -> int:
        return (
            self.system_prompt +
            self.conversation +
            self.retrieved_docs +
            self.output_reserve +
            self.safety_margin
        )


@dataclass
class TokenUsage:
    """Track token usage by category."""
    system_prompt: int = 0
    conversation: int = 0
    retrieved_docs: int = 0
    total: int = 0
    budget_remaining: int = 0


@dataclass
class BudgetStats:
    """Statistics for token budget usage."""
    total_requests: int = 0
    truncations: int = 0
    summarizations: int = 0
    budget_exceeded_count: int = 0
    total_tokens_used: int = 0
    total_tokens_saved: int = 0


class TokenBudgetError(Exception):
    """Raised when content cannot fit in budget."""

    def __init__(self, category: str, required: int, available: int):
        self.category = category
        self.required = required
        self.available = available
        super().__init__(
            f"Token budget exceeded for {category}: "
            f"required {required}, available {available}"
        )


class TokenCounter:
    """
    Token counter with model-specific encoding.

    Supports tiktoken for OpenAI models and approximation for others.
    """

    # Model to encoding mapping
    MODEL_ENCODINGS = {
        "gpt-4": "cl100k_base",
        "gpt-5.2": "o200k_base",
        "gpt-5.2-mini": "o200k_base",
        "gpt-3.5-turbo": "cl100k_base",
        "text-embedding-3-small": "cl100k_base",
        "text-embedding-3-large": "cl100k_base",
    }

    def __init__(self, model: str):
        self.model = model
        self._encoding = None
        self._load_encoding()

    def _load_encoding(self) -> None:
        """Load tiktoken encoding if available."""
        try:
            import tiktoken

            # Try model-specific encoding
            if self.model in self.MODEL_ENCODINGS:
                self._encoding = tiktoken.get_encoding(
                    self.MODEL_ENCODINGS[self.model]
                )
            else:
                # Try to get encoding for model directly
                try:
                    self._encoding = tiktoken.encoding_for_model(self.model)
                except KeyError:
                    # Fall back to cl100k_base for unknown models
                    self._encoding = tiktoken.get_encoding("cl100k_base")
                    logger.warning(
                        f"Unknown model '{self.model}', using cl100k_base encoding"
                    )

        except ImportError:
            logger.warning("tiktoken not available, using approximation")
            self._encoding = None

    def count(self, text: str) -> int:
        """Count tokens in text."""
        if self._encoding:
            return len(self._encoding.encode(text))

        # Approximation: ~4 characters per token
        return len(text) // 4

    def count_messages(self, messages: list[dict[str, str]]) -> int:
        """Count tokens in message list (includes message overhead)."""
        total = 0
        for msg in messages:
            # Add per-message overhead (~4 tokens)
            total += 4
            total += self.count(msg.get("role", ""))
            total += self.count(msg.get("content", ""))

        # Add conversation overhead
        total += 2

        return total

    def truncate_to_tokens(
        self,
        text: str,
        max_tokens: int,
        strategy: TruncationStrategy = TruncationStrategy.TRUNCATE_END,
    ) -> str:
        """Truncate text to fit within token limit."""
        current_tokens = self.count(text)

        if current_tokens <= max_tokens:
            return text

        if self._encoding:
            tokens = self._encoding.encode(text)
            if strategy == TruncationStrategy.TRUNCATE_END:
                truncated_tokens = tokens[:max_tokens]
            else:  # TRUNCATE_START
                truncated_tokens = tokens[-max_tokens:]
            return self._encoding.decode(truncated_tokens)

        # Approximation
        char_limit = max_tokens * 4
        if strategy == TruncationStrategy.TRUNCATE_END:
            return text[:char_limit]
        return text[-char_limit:]


class TokenBudgetGuard:
    """
    Guards against context window overflow.

    Manages token budgets by category and automatically
    truncates/summarizes content to fit within limits.

    Example:
        guard = TokenBudgetGuard(
            model="claude-sonnet-4-5-20251101",
            context_limit=200000,
        )

        system, messages, docs = guard.fit_to_budget(
            system_prompt="You are a helpful assistant...",
            messages=[{"role": "user", "content": "Hello"}],
            retrieved_docs=["Doc 1...", "Doc 2..."],
        )
    """

    def __init__(
        self,
        model: str,
        context_limit: int,
        allocation: BudgetAllocation | None = None,
        summarizer: Callable[[str], str] | None = None,
    ):
        self.model = model
        self.context_limit = context_limit
        self.allocation = allocation or BudgetAllocation()
        self.summarizer = summarizer
        self.counter = TokenCounter(model)
        self.stats = BudgetStats()

        # Validate allocation
        if self.allocation.total_budget > context_limit:
            logger.warning(
                f"Budget allocation ({self.allocation.total_budget}) "
                f"exceeds context limit ({context_limit})"
            )

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return self.counter.count(text)

    def get_usage(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        retrieved_docs: list[str],
    ) -> TokenUsage:
        """Get current token usage by category."""
        system_tokens = self.counter.count(system_prompt)
        conversation_tokens = self.counter.count_messages(messages)
        docs_tokens = sum(self.counter.count(doc) for doc in retrieved_docs)
        total = system_tokens + conversation_tokens + docs_tokens

        return TokenUsage(
            system_prompt=system_tokens,
            conversation=conversation_tokens,
            retrieved_docs=docs_tokens,
            total=total,
            budget_remaining=self.context_limit - total - self.allocation.output_reserve,
        )

    def fit_to_budget(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        retrieved_docs: list[str],
    ) -> tuple[str, list[dict[str, str]], list[str]]:
        """
        Fit all content to token budget.

        Args:
            system_prompt: System prompt text
            messages: Conversation messages
            retrieved_docs: Retrieved documents for RAG

        Returns:
            Tuple of (system_prompt, messages, docs) fitted to budget

        Raises:
            TokenBudgetError: If system prompt exceeds its budget
        """
        self.stats.total_requests += 1

        # Check system prompt (cannot be truncated)
        system_tokens = self.counter.count(system_prompt)
        if system_tokens > self.allocation.system_prompt:
            self.stats.budget_exceeded_count += 1
            raise TokenBudgetError(
                "system_prompt",
                system_tokens,
                self.allocation.system_prompt,
            )

        # Fit messages
        fitted_messages = self._fit_messages(
            messages,
            self.allocation.conversation,
        )

        # Fit documents
        fitted_docs = self._fit_docs(
            retrieved_docs,
            self.allocation.retrieved_docs,
        )

        # Track usage
        usage = self.get_usage(system_prompt, fitted_messages, fitted_docs)
        self.stats.total_tokens_used += usage.total

        return system_prompt, fitted_messages, fitted_docs

    def _fit_messages(
        self,
        messages: list[dict[str, str]],
        budget: int,
    ) -> list[dict[str, str]]:
        """Fit messages to budget using sliding window."""
        if not messages:
            return []

        current_tokens = self.counter.count_messages(messages)

        # Already fits
        if current_tokens <= budget:
            return messages

        self.stats.truncations += 1

        # Use sliding window - keep most recent
        fitted = []
        used = 0

        # Always try to keep system message
        system_msgs = [m for m in messages if m.get("role") == "system"]
        other_msgs = [m for m in messages if m.get("role") != "system"]

        # Add system messages first
        for msg in system_msgs:
            tokens = self.counter.count(msg.get("content", "")) + 4
            if used + tokens <= budget:
                fitted.append(msg)
                used += tokens

        # Add recent messages (newest first)
        for msg in reversed(other_msgs):
            tokens = self.counter.count(msg.get("content", "")) + 4
            if used + tokens <= budget:
                fitted.insert(len([m for m in fitted if m.get("role") == "system"]), msg)
                used += tokens
            else:
                break

        # Sort by original order
        original_order = {id(m): i for i, m in enumerate(messages)}
        fitted.sort(key=lambda m: original_order.get(id(m), float("inf")))

        tokens_saved = current_tokens - used
        self.stats.total_tokens_saved += tokens_saved

        logger.info(
            f"Truncated messages from {current_tokens} to {used} tokens "
            f"(saved {tokens_saved})"
        )

        return fitted

    def _fit_docs(
        self,
        docs: list[str],
        budget: int,
    ) -> list[str]:
        """Fit documents to budget, keeping highest priority."""
        if not docs:
            return []

        current_tokens = sum(self.counter.count(doc) for doc in docs)

        # Already fits
        if current_tokens <= budget:
            return docs

        self.stats.truncations += 1

        # Keep docs that fit (assume already sorted by relevance)
        fitted = []
        used = 0

        for doc in docs:
            tokens = self.counter.count(doc)
            if used + tokens <= budget:
                fitted.append(doc)
                used += tokens
            else:
                # Try truncating this doc
                remaining = budget - used
                if remaining > 100:  # Only if meaningful space left
                    truncated = self.counter.truncate_to_tokens(doc, remaining)
                    fitted.append(truncated)
                    used += self.counter.count(truncated)
                break

        tokens_saved = current_tokens - used
        self.stats.total_tokens_saved += tokens_saved

        logger.info(
            f"Truncated docs from {len(docs)} ({current_tokens} tokens) to "
            f"{len(fitted)} ({used} tokens)"
        )

        return fitted

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Estimate cost based on model pricing."""
        # Pricing per 1M tokens (Dec 2025)
        PRICING = {
            "claude-sonnet-4-5-20251101": {"input": 3.0, "output": 15.0},
            "claude-haiku-4-5-20251101": {"input": 0.80, "output": 4.0},
            "gpt-5.2": {"input": 2.5, "output": 10.0},
            "gpt-5.2-mini": {"input": 0.15, "output": 0.60},
        }

        prices = PRICING.get(self.model, {"input": 1.0, "output": 3.0})

        return (
            (input_tokens / 1_000_000) * prices["input"] +
            (output_tokens / 1_000_000) * prices["output"]
        )

    def get_stats(self) -> dict:
        """Get budget guard statistics."""
        return {
            "total_requests": self.stats.total_requests,
            "truncations": self.stats.truncations,
            "summarizations": self.stats.summarizations,
            "budget_exceeded_count": self.stats.budget_exceeded_count,
            "total_tokens_used": self.stats.total_tokens_used,
            "total_tokens_saved": self.stats.total_tokens_saved,
            "avg_tokens_per_request": (
                self.stats.total_tokens_used / self.stats.total_requests
                if self.stats.total_requests > 0
                else 0
            ),
        }


# Utility function for quick budget check
def check_budget(
    content: str,
    model: str = "claude-sonnet-4-5-20251101",
    context_limit: int = 200000,
) -> dict:
    """Quick check if content fits in context."""
    counter = TokenCounter(model)
    tokens = counter.count(content)

    return {
        "tokens": tokens,
        "context_limit": context_limit,
        "fits": tokens < context_limit,
        "utilization": tokens / context_limit,
        "remaining": context_limit - tokens,
    }


# Example usage
if __name__ == "__main__":
    # Create budget guard
    guard = TokenBudgetGuard(
        model="claude-sonnet-4-5-20251101",
        context_limit=200000,
        allocation=BudgetAllocation(
            system_prompt=2000,
            conversation=10000,
            retrieved_docs=5000,
            output_reserve=2000,
            safety_margin=1000,
        ),
    )

    # Test content
    system = "You are a helpful assistant."
    messages = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you!"},
        {"role": "user", "content": "Can you help me with something?"},
    ]
    docs = [
        "Document 1: " + "x" * 5000,
        "Document 2: " + "y" * 5000,
        "Document 3: " + "z" * 5000,
    ]

    # Check usage before
    usage_before = guard.get_usage(system, messages, docs)
    print(f"Before fitting: {usage_before}")

    # Fit to budget
    system_fit, messages_fit, docs_fit = guard.fit_to_budget(system, messages, docs)

    # Check usage after
    usage_after = guard.get_usage(system_fit, messages_fit, docs_fit)
    print(f"After fitting: {usage_after}")

    # Stats
    print(f"Stats: {guard.get_stats()}")

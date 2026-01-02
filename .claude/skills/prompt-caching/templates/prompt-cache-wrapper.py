"""
Claude prompt caching wrapper with automatic cache breakpoint management.

Features:
- Automatic cache_control placement
- Cost tracking
- Cache hit rate monitoring
- Support for multiple cache breakpoints
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import time
import structlog
from anthropic import Anthropic, AsyncAnthropic
from prometheus_client import Counter, Histogram

logger = structlog.get_logger()

# Metrics
prompt_cache_creates = Counter(
    "prompt_cache_creates_total",
    "Prompt cache creations",
    ["agent_type"]
)
prompt_cache_reads = Counter(
    "prompt_cache_reads_total",
    "Prompt cache reads",
    ["agent_type"]
)
prompt_cache_tokens_saved = Counter(
    "prompt_cache_tokens_saved_total",
    "Tokens saved via prompt caching"
)


@dataclass
class CachedMessage:
    """Message content with optional cache breakpoint."""
    text: str
    cache_control: Optional[Dict[str, str]] = None

    def to_dict(self) -> dict:
        """Convert to Anthropic API format."""
        content = {"type": "text", "text": self.text}
        if self.cache_control:
            content["cache_control"] = self.cache_control
        return content


class PromptCacheWrapper:
    """Wrapper for Claude API with automatic prompt caching."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096
    ):
        """Initialize prompt cache wrapper.

        Args:
            api_key: Anthropic API key (or from env)
            model: Claude model to use
            max_tokens: Max tokens to generate
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    def build_cached_messages(
        self,
        system_prompt: str,
        user_content: str,
        few_shot_examples: Optional[str] = None,
        schema_docs: Optional[str] = None,
        additional_context: Optional[str] = None
    ) -> List[dict]:
        """Build messages with cache breakpoints.

        Cache structure (up to 4 breakpoints):
        1. System prompt (always cached)
        2. Few-shot examples (cached per content type)
        3. Schema documentation (cached)
        4. Additional context (cached)
        ──────── CACHE BREAKPOINT ────────
        5. User content (NEVER cached)

        Args:
            system_prompt: Agent system prompt
            user_content: User's input (NOT cached)
            few_shot_examples: Optional examples
            schema_docs: Optional schema documentation
            additional_context: Optional additional context

        Returns:
            Messages list formatted for Anthropic API
        """
        content_parts = []

        # Breakpoint 1: System prompt
        content_parts.append(
            CachedMessage(
                text=system_prompt,
                cache_control={"type": "ephemeral"}
            ).to_dict()
        )

        # Breakpoint 2: Few-shot examples (if provided)
        if few_shot_examples:
            content_parts.append(
                CachedMessage(
                    text=few_shot_examples,
                    cache_control={"type": "ephemeral"}
                ).to_dict()
            )

        # Breakpoint 3: Schema docs (if provided)
        if schema_docs:
            content_parts.append(
                CachedMessage(
                    text=schema_docs,
                    cache_control={"type": "ephemeral"}
                ).to_dict()
            )

        # Breakpoint 4: Additional context (if provided)
        if additional_context:
            content_parts.append(
                CachedMessage(
                    text=additional_context,
                    cache_control={"type": "ephemeral"}
                ).to_dict()
            )

        # User content (NOT cached)
        content_parts.append(
            CachedMessage(text=user_content).to_dict()
        )

        return [{"role": "user", "content": content_parts}]

    async def generate(
        self,
        user_content: str,
        agent_type: str,
        system_prompt: str,
        few_shot_examples: Optional[str] = None,
        schema_docs: Optional[str] = None,
        additional_context: Optional[str] = None,
        temperature: float = 1.0
    ) -> dict:
        """Generate LLM response with prompt caching.

        Args:
            user_content: User input
            agent_type: Agent type (for metrics)
            system_prompt: System prompt to cache
            few_shot_examples: Optional examples to cache
            schema_docs: Optional schema to cache
            additional_context: Optional additional context to cache
            temperature: Sampling temperature

        Returns:
            {
                "content": str,
                "usage": {
                    "input_tokens": int,
                    "output_tokens": int,
                    "cache_creation_input_tokens": int,
                    "cache_read_input_tokens": int
                },
                "cost_usd": float,
                "cache_hit": bool
            }
        """
        start = time.time()

        messages = self.build_cached_messages(
            system_prompt=system_prompt,
            user_content=user_content,
            few_shot_examples=few_shot_examples,
            schema_docs=schema_docs,
            additional_context=additional_context
        )

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=temperature,
            messages=messages
        )

        # Extract usage
        usage = response.usage
        cache_creation_tokens = getattr(usage, "cache_creation_input_tokens", 0)
        cache_read_tokens = getattr(usage, "cache_read_input_tokens", 0)
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens

        # Calculate cost
        cost = self._calculate_cost(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens
        )

        # Metrics
        cache_hit = cache_read_tokens > 0
        if cache_creation_tokens > 0:
            prompt_cache_creates.labels(agent_type=agent_type).inc()
        if cache_read_tokens > 0:
            prompt_cache_reads.labels(agent_type=agent_type).inc()
            prompt_cache_tokens_saved.inc(cache_read_tokens)

        # Logging
        logger.info(
            "prompt_cache_generate",
            agent_type=agent_type,
            model=self.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_hit=cache_hit,
            cost_usd=cost,
            latency_seconds=time.time() - start
        )

        return {
            "content": response.content[0].text,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_creation_input_tokens": cache_creation_tokens,
                "cache_read_input_tokens": cache_read_tokens
            },
            "cost_usd": cost,
            "cache_hit": cache_hit
        }

    def _calculate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int,
        cache_read_tokens: int
    ) -> float:
        """Calculate cost in USD.

        Pricing (Claude Sonnet 4 - Dec 2025):
        - Input: $3/MTok
        - Output: $15/MTok
        - Cache write: $3.75/MTok (1.25x input)
        - Cache read: $0.30/MTok (0.1x input)
        """
        INPUT_PRICE = 3.0 / 1_000_000
        OUTPUT_PRICE = 15.0 / 1_000_000
        CACHE_WRITE_PRICE = 3.75 / 1_000_000
        CACHE_READ_PRICE = 0.30 / 1_000_000

        cost = (
            (input_tokens * INPUT_PRICE) +
            (output_tokens * OUTPUT_PRICE) +
            (cache_creation_tokens * CACHE_WRITE_PRICE) +
            (cache_read_tokens * CACHE_READ_PRICE)
        )

        return cost

    async def stream_generate(
        self,
        user_content: str,
        agent_type: str,
        system_prompt: str,
        few_shot_examples: Optional[str] = None,
        schema_docs: Optional[str] = None
    ):
        """Stream LLM response with prompt caching.

        Yields:
            Text chunks as they arrive
        """
        messages = self.build_cached_messages(
            system_prompt=system_prompt,
            user_content=user_content,
            few_shot_examples=few_shot_examples,
            schema_docs=schema_docs
        )

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=messages
        ) as stream:
            async for text in stream.text_stream:
                yield text

            # Log usage after stream completes
            final_message = await stream.get_final_message()
            usage = final_message.usage

            logger.info(
                "prompt_cache_stream_complete",
                agent_type=agent_type,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0)
            )


# Example usage
async def example():
    """Example usage of prompt cache wrapper."""
    wrapper = PromptCacheWrapper()

    SECURITY_PROMPT = """You are a security auditor. Analyze code for vulnerabilities..."""
    SECURITY_EXAMPLES = """Example 1: SQL Injection\n...\nExample 2: XSS\n..."""

    # First request: Creates cache
    result1 = await wrapper.generate(
        user_content="Analyze this login function for security issues:\ndef login(username, password):...",
        agent_type="security_auditor",
        system_prompt=SECURITY_PROMPT,
        few_shot_examples=SECURITY_EXAMPLES
    )
    print(f"First call cost: ${result1['cost_usd']:.4f}")
    print(f"Cache hit: {result1['cache_hit']}")  # False

    # Second request: Uses cache (within 5 minutes)
    result2 = await wrapper.generate(
        user_content="Check this password reset function:\ndef reset_password(email):...",
        agent_type="security_auditor",
        system_prompt=SECURITY_PROMPT,
        few_shot_examples=SECURITY_EXAMPLES
    )
    print(f"Second call cost: ${result2['cost_usd']:.4f}")  # 90% cheaper!
    print(f"Cache hit: {result2['cache_hit']}")  # True

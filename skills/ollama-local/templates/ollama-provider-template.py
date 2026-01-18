"""Ollama Provider Template for Local LLM Inference.

This template provides a production-ready pattern for integrating Ollama
with your application. Copy and customize for your specific needs.

Requirements:
    pip install langchain-ollama>=1.0.1 httpx

Environment:
    OLLAMA_ENABLED=true
    OLLAMA_HOST=http://localhost:11434
    OLLAMA_MODEL_REASONING=deepseek-r1:70b
    OLLAMA_MODEL_CODING=qwen2.5-coder:32b
    OLLAMA_MODEL_EMBED=nomic-embed-text

Issue #606: CI Cost Reduction via Local Models
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from http import HTTPStatus
from typing import TYPE_CHECKING, Any

import httpx
from langchain_ollama import ChatOllama, OllamaEmbeddings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


# =============================================================================
# Configuration
# =============================================================================


class TaskType(str, Enum):
    """Task types for model selection."""

    REASONING = "reasoning"
    CODING = "coding"
    GENERAL = "general"


@dataclass
class OllamaConfig:
    """Ollama configuration from environment."""

    enabled: bool = False
    host: str = "http://localhost:11434"
    model_reasoning: str = "deepseek-r1:70b"
    model_coding: str = "qwen2.5-coder:32b"
    model_embed: str = "nomic-embed-text"
    num_ctx: int = 32768
    timeout: float = 300.0
    keep_alive: str = "5m"

    @classmethod
    def from_env(cls) -> OllamaConfig:
        """Load configuration from environment variables."""
        return cls(
            enabled=os.getenv("OLLAMA_ENABLED", "false").lower() == "true",
            host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            model_reasoning=os.getenv("OLLAMA_MODEL_REASONING", "deepseek-r1:70b"),
            model_coding=os.getenv("OLLAMA_MODEL_CODING", "qwen2.5-coder:32b"),
            model_embed=os.getenv("OLLAMA_MODEL_EMBED", "nomic-embed-text"),
            num_ctx=int(os.getenv("OLLAMA_NUM_CTX", "32768")),
            timeout=float(os.getenv("OLLAMA_TIMEOUT", "300.0")),
            keep_alive=os.getenv("OLLAMA_KEEP_ALIVE", "5m"),
        )


# Global config instance
config = OllamaConfig.from_env()


# =============================================================================
# Ollama Provider
# =============================================================================


class OllamaProvider:
    """Provider for local LLM inference via Ollama.

    Example:
        >>> provider = OllamaProvider.for_reasoning()
        >>> result = await provider.ainvoke("Explain quantum computing")
        >>> print(result.content)

    """

    def __init__(
        self,
        model: str | None = None,
        *,
        temperature: float = 0.0,
        num_ctx: int | None = None,
        timeout: float | None = None,
        keep_alive: str | None = None,
    ) -> None:
        """Initialize Ollama provider.

        Args:
            model: Ollama model identifier
            temperature: Sampling temperature (0.0 = deterministic)
            num_ctx: Context window size
            timeout: Request timeout in seconds
            keep_alive: How long to keep model loaded (e.g., "5m", "1h")

        """
        self.model = model or config.model_reasoning
        self._temperature = temperature
        self._num_ctx = num_ctx or config.num_ctx
        self._timeout = timeout or config.timeout
        self._keep_alive = keep_alive or config.keep_alive

        self.llm = ChatOllama(
            model=self.model,
            base_url=config.host,
            temperature=temperature,
            num_ctx=self._num_ctx,
            timeout=self._timeout,
            keep_alive=self._keep_alive,
        )

    async def ainvoke(self, prompt: str | list[dict], **kwargs: Any) -> Any:
        """Invoke the model asynchronously.

        Args:
            prompt: Text prompt or list of messages
            **kwargs: Additional arguments passed to ChatOllama

        Returns:
            Model response (AIMessage)

        """
        return await self.llm.ainvoke(prompt, **kwargs)

    async def astream(self, prompt: str | list[dict], **kwargs: Any) -> AsyncIterator[Any]:
        """Stream responses from the model.

        Args:
            prompt: Text prompt or list of messages
            **kwargs: Additional arguments

        Yields:
            Streaming chunks (AIMessageChunk)

        """
        async for chunk in self.llm.astream(prompt, **kwargs):
            yield chunk

    def bind_tools(self, tools: list[Any]) -> ChatOllama:
        """Bind tools for function calling.

        Args:
            tools: List of tools (Pydantic models, functions, or schemas)

        Returns:
            ChatOllama with tools bound

        """
        return self.llm.bind_tools(tools)

    def with_structured_output(self, schema: type) -> ChatOllama:
        """Configure model to output structured data.

        Args:
            schema: Pydantic model or JSON schema

        Returns:
            ChatOllama configured for structured output

        """
        return self.llm.with_structured_output(schema)

    @classmethod
    def for_reasoning(cls) -> OllamaProvider:
        """Create provider for reasoning tasks (G-Eval, synthesis)."""
        return cls(
            model=config.model_reasoning,
            temperature=0.0,
            keep_alive="10m",  # Longer for reasoning models
        )

    @classmethod
    def for_coding(cls) -> OllamaProvider:
        """Create provider for coding tasks (agents, tool calling)."""
        return cls(
            model=config.model_coding,
            temperature=0.0,
            keep_alive="5m",
        )

    @property
    def is_available(self) -> bool:
        """Check if Ollama server is available."""
        try:
            response = httpx.get(f"{config.host}/api/tags", timeout=5.0)
            return response.status_code == HTTPStatus.OK
        except httpx.HTTPError:
            return False


# =============================================================================
# Embedding Service
# =============================================================================


class OllamaEmbeddingService:
    """Service for generating embeddings using Ollama.

    Example:
        >>> service = OllamaEmbeddingService()
        >>> embedding = await service.generate_embedding("Hello world")
        >>> print(len(embedding))  # 768

    """

    def __init__(
        self,
        model: str | None = None,
        dimensions: int = 768,
    ) -> None:
        """Initialize embedding service.

        Args:
            model: Ollama embedding model
            dimensions: Expected embedding dimensions

        """
        self.model = model or config.model_embed
        self.expected_dimensions = dimensions

        self._embeddings = OllamaEmbeddings(
            model=self.model,
            base_url=config.host,
        )

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector

        Raises:
            ValueError: If text is empty

        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        return await self._embeddings.aembed_query(text)

    async def generate_embeddings_batch(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors

        """
        if not texts:
            return []

        valid_texts = [t for t in texts if t and t.strip()]
        if not valid_texts:
            return []

        return await self._embeddings.aembed_documents(valid_texts)

    @property
    def is_available(self) -> bool:
        """Check if Ollama is available for embeddings."""
        try:
            response = httpx.get(f"{config.host}/api/tags", timeout=5.0)
            return response.status_code == HTTPStatus.OK
        except httpx.HTTPError:
            return False


# =============================================================================
# Provider Factory
# =============================================================================


def get_llm_provider(task_type: TaskType = TaskType.REASONING) -> OllamaProvider | Any:
    """Get the appropriate LLM provider.

    Automatically uses Ollama if OLLAMA_ENABLED=true, else falls back to cloud.

    Args:
        task_type: Type of task (reasoning, coding, general)

    Returns:
        LLM provider instance

    Example:
        >>> llm = get_llm_provider(TaskType.CODING)
        >>> response = await llm.ainvoke("Write a Python function")

    """
    if config.enabled:
        if task_type == TaskType.CODING:
            return OllamaProvider.for_coding()
        return OllamaProvider.for_reasoning()

    # Cloud fallback (customize for your cloud provider)
    from langchain.chat_models import init_chat_model

    model = {
        TaskType.REASONING: "gemini-3-flash-preview",
        TaskType.CODING: "claude-sonnet-4-20250514",
        TaskType.GENERAL: "gpt-4o-mini",
    }.get(task_type, "gpt-4o-mini")

    return init_chat_model(model, temperature=0.0)


def get_embedding_provider() -> OllamaEmbeddingService | Any:
    """Get the appropriate embedding service.

    Automatically uses Ollama if OLLAMA_ENABLED=true, else falls back to cloud.

    Returns:
        Embedding service instance

    """
    if config.enabled:
        return OllamaEmbeddingService()

    # Cloud fallback (customize for your embedding provider)
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model="text-embedding-3-small")


def is_ollama_available() -> bool:
    """Check if Ollama server is running and accessible."""
    if not config.enabled:
        return False

    try:
        response = httpx.get(f"{config.host}/api/tags", timeout=5.0)
        return response.status_code == HTTPStatus.OK
    except httpx.HTTPError:
        return False


# =============================================================================
# Utility Functions
# =============================================================================


async def prewarm_models() -> None:
    """Pre-warm Ollama models for faster first request.

    Call this at application startup or before CI tests.

    """
    if not config.enabled:
        return

    async with httpx.AsyncClient() as client:
        # Warm embedding model
        try:
            await client.post(
                f"{config.host}/api/embeddings",
                json={"model": config.model_embed, "prompt": "warmup"},
                timeout=60.0,
            )
        except httpx.HTTPError:
            pass

        # Warm reasoning model (minimal generation)
        try:
            await client.post(
                f"{config.host}/api/chat",
                json={
                    "model": config.model_reasoning,
                    "messages": [{"role": "user", "content": "Hi"}],
                    "options": {"num_predict": 1},
                },
                timeout=120.0,
            )
        except httpx.HTTPError:
            pass


def get_available_models() -> list[str]:
    """Get list of models available on Ollama server."""
    if not config.enabled:
        return []

    try:
        response = httpx.get(f"{config.host}/api/tags", timeout=5.0)
        if response.status_code != HTTPStatus.OK:
            return []
        data = response.json()
        return [m.get("name", "") for m in data.get("models", [])]
    except httpx.HTTPError:
        return []


# =============================================================================
# Example Usage
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        # Check availability
        if not is_ollama_available():
            print("Ollama not available, using cloud providers")

        # Get provider (auto-selects based on OLLAMA_ENABLED)
        llm = get_llm_provider(TaskType.REASONING)

        # Simple invocation
        response = await llm.ainvoke("What is 2+2?")
        print(f"Response: {response.content}")

        # Embeddings
        embedder = get_embedding_provider()
        embedding = await embedder.generate_embedding("Hello world")
        print(f"Embedding dimensions: {len(embedding)}")

        # Structured output
        from pydantic import BaseModel, Field

        class Summary(BaseModel):
            title: str = Field(description="Brief title")
            points: list[str] = Field(description="Key points")

        structured = llm.with_structured_output(Summary)
        result = await structured.ainvoke("Summarize: Python is a programming language")
        print(f"Title: {result.title}")
        print(f"Points: {result.points}")

    asyncio.run(main())

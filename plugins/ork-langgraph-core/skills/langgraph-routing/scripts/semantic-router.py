"""
Semantic Router for LangGraph Multi-Agent Workflows

Routes content to relevant agents using embedding similarity instead of
keyword matching. Integrates with supervisor-worker pattern.

Usage:
    router = SemanticRouter(embedding_service)
    await router.initialize()

    selected_agents = await router.route(content, context="API tutorial")
    # Returns: ["implementation_planner", "security_auditor"]
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService(Protocol):
    """Protocol for embedding service."""

    async def embed(self, text: str) -> list[float]:
        """Embed text and return vector."""
        ...


@dataclass
class AgentCapability:
    """Agent capability description for semantic matching."""

    agent_type: str
    name: str
    description: str
    keywords: list[str] = field(default_factory=list)
    examples: list[str] = field(default_factory=list)
    tier: int = 2  # 1=critical, 2=standard, 3=optional
    embedding: np.ndarray | None = None

    def get_embedding_text(self) -> str:
        """Combine all text for embedding."""
        parts = [
            self.name,
            self.description,
            " ".join(self.keywords),
            " ".join(self.examples),
        ]
        return " ".join(parts)


# Default agent capabilities (customize for your agents)
DEFAULT_CAPABILITIES: dict[str, AgentCapability] = {
    "security_auditor": AgentCapability(
        agent_type="security_auditor",
        name="Security Auditor",
        description="""
        Analyzes security implications including authentication patterns,
        authorization frameworks, vulnerability assessment, and secure coding.
        """,
        keywords=[
            "security", "authentication", "authorization", "OAuth", "JWT",
            "SAML", "vulnerability", "CVE", "OWASP", "encryption", "secrets",
            "access control", "session", "XSS", "CSRF", "SQL injection",
        ],
        examples=[
            "How to implement OAuth 2.0 authentication",
            "Best practices for API security",
            "Preventing SQL injection attacks",
        ],
        tier=2,
    ),
    "implementation_planner": AgentCapability(
        agent_type="implementation_planner",
        name="Implementation Planner",
        description="""
        Provides step-by-step implementation guidance, code architecture,
        design patterns, and practical coding examples.
        """,
        keywords=[
            "implementation", "code", "architecture", "design pattern",
            "step-by-step", "tutorial", "example", "how to", "setup",
            "configuration", "integration", "API", "library",
        ],
        examples=[
            "How to build a REST API with FastAPI",
            "Implementing the repository pattern",
            "Setting up a React project",
        ],
        tier=2,
    ),
    "tech_comparator": AgentCapability(
        agent_type="tech_comparator",
        name="Technology Comparator",
        description="""
        Compares technologies, frameworks, and tools. Analyzes trade-offs,
        performance benchmarks, and feature comparisons.
        """,
        keywords=[
            "comparison", "vs", "versus", "compare", "difference",
            "trade-off", "benchmark", "performance", "pros", "cons",
            "alternative", "migration", "choose", "which",
        ],
        examples=[
            "React vs Vue vs Angular comparison",
            "PostgreSQL vs MongoDB for this use case",
            "Which testing framework should I use",
        ],
        tier=2,
    ),
    "learning_synthesizer": AgentCapability(
        agent_type="learning_synthesizer",
        name="Learning Synthesizer",
        description="""
        Synthesizes learning materials, creates summaries, identifies
        key concepts, and structures educational content.
        """,
        keywords=[
            "learn", "understand", "concept", "summary", "overview",
            "introduction", "beginner", "fundamentals", "basics",
            "explain", "teaching", "course", "tutorial",
        ],
        examples=[
            "Understanding React hooks",
            "Introduction to microservices",
            "What is event-driven architecture",
        ],
        tier=2,
    ),
    "prerequisite_mapper": AgentCapability(
        agent_type="prerequisite_mapper",
        name="Prerequisite Mapper",
        description="""
        Maps prerequisites and dependencies. Identifies what knowledge
        or tools are needed before tackling a topic.
        """,
        keywords=[
            "prerequisite", "requirement", "dependency", "before",
            "need to know", "background", "foundation", "required",
        ],
        examples=[
            "What do I need to know before learning Kubernetes",
            "Prerequisites for machine learning",
        ],
        tier=3,
    ),
    "codebase_analyzer": AgentCapability(
        agent_type="codebase_analyzer",
        name="Codebase Analyzer",
        description="""
        Analyzes code structure, identifies patterns, reviews architecture,
        and provides insights about code organization.
        """,
        keywords=[
            "code", "codebase", "repository", "structure", "architecture",
            "pattern", "review", "analysis", "organization", "module",
        ],
        examples=[
            "Analyze this repository structure",
            "Code review of authentication module",
        ],
        tier=2,
    ),
    "practical_applicator": AgentCapability(
        agent_type="practical_applicator",
        name="Practical Applicator",
        description="""
        Identifies practical applications and use cases. Connects theory
        to real-world scenarios and projects.
        """,
        keywords=[
            "practical", "application", "use case", "real world",
            "project", "example", "scenario", "apply", "production",
        ],
        examples=[
            "Real-world applications of graph databases",
            "When to use WebSockets in production",
        ],
        tier=3,
    ),
    "complexity_assessor": AgentCapability(
        agent_type="complexity_assessor",
        name="Complexity Assessor",
        description="""
        Assesses complexity and difficulty. Provides time estimates
        and identifies challenging aspects.
        """,
        keywords=[
            "complexity", "difficulty", "time", "estimate", "effort",
            "challenge", "hard", "easy", "level", "advanced", "beginner",
        ],
        examples=[
            "How complex is implementing OAuth from scratch",
            "Time estimate for building a chat application",
        ],
        tier=3,
    ),
}


class SemanticRouter:
    """
    Semantic router for multi-agent workflows.

    Routes content to relevant agents using embedding similarity.
    Replaces keyword-based signal filtering with semantic understanding.
    """

    def __init__(
        self,
        embedding_service: EmbeddingService,
        capabilities: dict[str, AgentCapability] | None = None,
        similarity_threshold: float = 0.65,
        max_agents: int = 4,
        min_agents: int = 1,
    ):
        """
        Initialize semantic router.

        Args:
            embedding_service: Service for generating embeddings
            capabilities: Agent capability definitions (defaults provided)
            similarity_threshold: Minimum similarity for selection
            max_agents: Maximum agents to select
            min_agents: Minimum agents to select (even if below threshold)
        """
        self.embedding_service = embedding_service
        self.capabilities = capabilities or DEFAULT_CAPABILITIES
        self.similarity_threshold = similarity_threshold
        self.max_agents = max_agents
        self.min_agents = min_agents

        self._initialized = False
        self._agent_embeddings: dict[str, np.ndarray] = {}

    async def initialize(self) -> None:
        """Pre-compute agent capability embeddings."""
        if self._initialized:
            return

        logger.info(f"Initializing semantic router with {len(self.capabilities)} agents")

        for agent_type, capability in self.capabilities.items():
            text = capability.get_embedding_text()
            embedding = await self.embedding_service.embed(text)
            self._agent_embeddings[agent_type] = np.array(embedding)
            capability.embedding = self._agent_embeddings[agent_type]

        self._initialized = True
        logger.info("Semantic router initialized")

    async def route(
        self,
        content: str,
        context: str | None = None,
        excluded_agents: list[str] | None = None,
    ) -> list[str]:
        """
        Route content to relevant agents.

        Args:
            content: Content to analyze
            context: Optional context (title, URL, etc.)
            excluded_agents: Agents to exclude from selection

        Returns:
            List of selected agent types, sorted by relevance
        """
        if not self._initialized:
            await self.initialize()

        excluded = set(excluded_agents or [])

        # Prepare routing text (context + content sample)
        routing_text = self._prepare_routing_text(content, context)

        # Get content embedding
        content_embedding = await self.embedding_service.embed(routing_text)
        content_vec = np.array(content_embedding)

        # Calculate similarities
        scores: list[tuple[str, float]] = []
        for agent_type, agent_vec in self._agent_embeddings.items():
            if agent_type in excluded:
                continue

            similarity = self._cosine_similarity(content_vec, agent_vec)
            scores.append((agent_type, similarity))

        # Sort by similarity
        scores.sort(key=lambda x: x[1], reverse=True)

        # Select agents
        selected = []
        for agent_type, similarity in scores:
            if len(selected) >= self.max_agents:
                break

            if similarity >= self.similarity_threshold:
                selected.append(agent_type)
            elif len(selected) < self.min_agents:
                # Include at least min_agents even if below threshold
                selected.append(agent_type)

        logger.info(
            f"Semantic routing selected {len(selected)} agents: {selected}",
            extra={"scores": {a: round(s, 3) for a, s in scores[:5]}},
        )

        return selected

    async def get_scores(
        self,
        content: str,
        context: str | None = None,
    ) -> dict[str, float]:
        """
        Get similarity scores for all agents.

        Useful for debugging and analysis.
        """
        if not self._initialized:
            await self.initialize()

        routing_text = self._prepare_routing_text(content, context)
        content_embedding = await self.embedding_service.embed(routing_text)
        content_vec = np.array(content_embedding)

        scores = {}
        for agent_type, agent_vec in self._agent_embeddings.items():
            scores[agent_type] = round(
                self._cosine_similarity(content_vec, agent_vec), 4
            )

        return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))

    def _prepare_routing_text(
        self,
        content: str,
        context: str | None = None,
        max_content_length: int = 2000,
    ) -> str:
        """Prepare text for routing embedding."""
        parts = []

        if context:
            parts.append(f"Context: {context}")

        # Truncate content but include beginning and end
        if len(content) > max_content_length:
            half = max_content_length // 2
            truncated = content[:half] + "\n...\n" + content[-half:]
            parts.append(truncated)
        else:
            parts.append(content)

        return "\n\n".join(parts)

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(np.dot(a, b) / (norm_a * norm_b))

    def add_agent(self, capability: AgentCapability) -> None:
        """Add a new agent capability (requires re-initialization)."""
        self.capabilities[capability.agent_type] = capability
        self._initialized = False

    def remove_agent(self, agent_type: str) -> None:
        """Remove an agent capability."""
        if agent_type in self.capabilities:
            del self.capabilities[agent_type]
            if agent_type in self._agent_embeddings:
                del self._agent_embeddings[agent_type]


class HybridRouter:
    """
    Hybrid router combining semantic and LLM-based routing.

    Uses semantic similarity as pre-filter, then LLM for refinement.
    """

    def __init__(
        self,
        semantic_router: SemanticRouter,
        llm_client: Any,  # Your LLM client
        use_llm_refinement: bool = True,
    ):
        self.semantic_router = semantic_router
        self.llm_client = llm_client
        self.use_llm_refinement = use_llm_refinement

    async def route(
        self,
        content: str,
        context: str | None = None,
    ) -> list[str]:
        """Route with semantic pre-filter and optional LLM refinement."""

        # Step 1: Semantic pre-filter (fast, cheap)
        candidates = await self.semantic_router.route(
            content,
            context,
        )

        # Step 2: LLM refinement (optional)
        if self.use_llm_refinement and len(candidates) > 2:
            refined = await self._llm_refine(content, candidates)
            return refined

        return candidates

    async def _llm_refine(
        self,
        content: str,
        candidates: list[str],
    ) -> list[str]:
        """Use LLM to refine candidate selection."""

        prompt = f"""Given this content and candidate agents, select the 2-4 most relevant.

Content (first 500 chars):
{content[:500]}

Candidate agents and their purposes:
{self._format_candidates(candidates)}

Return a JSON array of the most relevant agent types.
Example: ["security_auditor", "implementation_planner"]
"""

        try:
            response = await self.llm_client.complete(
                prompt,
                response_format={"type": "json_object"},
            )
            selected = response.get("agents", candidates[:2])
            return [a for a in selected if a in candidates]

        except Exception as e:
            logger.warning(f"LLM refinement failed: {e}, using semantic selection")
            return candidates[:3]

    def _format_candidates(self, candidates: list[str]) -> str:
        """Format candidates for LLM prompt."""
        lines = []
        for agent_type in candidates:
            cap = self.semantic_router.capabilities.get(agent_type)
            if cap:
                lines.append(f"- {agent_type}: {cap.description.strip()[:100]}")
        return "\n".join(lines)


# Example usage
if __name__ == "__main__":
    import asyncio

    class MockEmbeddingService:
        """Mock embedding service for testing."""

        async def embed(self, text: str) -> list[float]:
            # Simple mock: hash-based pseudo-embedding
            import hashlib

            h = hashlib.sha256(text.encode()).digest()
            return [float(b) / 255.0 for b in h[:128]]

    async def main():
        # Create router
        embedding_service = MockEmbeddingService()
        router = SemanticRouter(
            embedding_service,
            similarity_threshold=0.6,
            max_agents=3,
        )

        # Initialize
        await router.initialize()

        # Test routing
        test_content = """
        This tutorial explains how to implement OAuth 2.0 authentication
        in a Node.js application. We'll cover the authorization code flow,
        token refresh, and best practices for secure token storage.
        """

        selected = await router.route(test_content, context="OAuth Tutorial")
        print(f"Selected agents: {selected}")

        scores = await router.get_scores(test_content)
        print(f"All scores: {scores}")

    asyncio.run(main())

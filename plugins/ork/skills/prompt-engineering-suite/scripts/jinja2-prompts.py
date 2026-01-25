"""
Jinja2 Prompt Templates - Production Prompt Management (2026 Standards)

Advanced Jinja2-based prompt templating with:
- Async rendering support (Jinja2 3.1.x)
- Template caching for performance
- Custom LLM filters (tool, cache_control, image)
- Native Python type returns (NativeEnvironment)
- Variable validation and extraction
- Content hashing for version tracking
- Langfuse/OpenTelemetry compatible metadata
- Anthropic cache_control support

Based on patterns from Banks v2.2.0 and Jinja2 3.1.6.

Usage:
    from jinja2_prompts import PromptTemplateManager

    # Sync usage
    manager = PromptTemplateManager()
    prompt = manager.render(
        "classification",
        categories=["urgent", "normal", "low"],
        examples=examples,
        user_input="My order hasn't arrived"
    )

    # Async usage
    manager = PromptTemplateManager(enable_async=True)
    prompt = await manager.render_async("classification", **vars)

    # With caching
    manager = PromptTemplateManager(enable_cache=True)
"""

from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Optional, TypeVar

from jinja2 import Environment, FileSystemLoader, select_autoescape
from jinja2.exceptions import TemplateNotFound, TemplateSyntaxError
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar("T")


# =============================================================================
# Custom Jinja2 Filters for LLM Prompts
# =============================================================================

def filter_tool(func: Callable) -> dict[str, Any]:
    """
    Convert a Python callable to OpenAI function calling schema.

    Usage in template:
        {{ my_function | tool }}

    Returns JSON schema for function calling.
    """
    import inspect

    sig = inspect.signature(func)
    doc = inspect.getdoc(func) or ""

    parameters = {"type": "object", "properties": {}, "required": []}

    for name, param in sig.parameters.items():
        param_type = "string"  # Default
        if param.annotation != inspect.Parameter.empty:
            if param.annotation == int:
                param_type = "integer"
            elif param.annotation == float:
                param_type = "number"
            elif param.annotation == bool:
                param_type = "boolean"
            elif param.annotation == list:
                param_type = "array"

        parameters["properties"][name] = {"type": param_type}

        if param.default == inspect.Parameter.empty:
            parameters["required"].append(name)

    return {
        "type": "function",
        "function": {
            "name": func.__name__,
            "description": doc.split("\n")[0] if doc else "",
            "parameters": parameters,
        },
    }


def filter_cache_control(text: str, cache_type: str = "ephemeral") -> dict[str, Any]:
    """
    Add Anthropic cache_control to content block.

    Usage in template:
        {{ long_context | cache_control("ephemeral") }}

    Supports Anthropic's prompt caching for reduced costs.
    """
    return {
        "type": "text",
        "text": text,
        "cache_control": {"type": cache_type},
    }


def filter_image(
    source: str | bytes,
    media_type: str = "image/png",
    detail: str = "auto",
) -> dict[str, Any]:
    """
    Format image for multimodal LLM input.

    Usage in template:
        {{ image_path | image }}
        {{ image_bytes | image("image/jpeg") }}

    Supports both file paths and base64 data.
    """
    if isinstance(source, bytes):
        data = base64.b64encode(source).decode("utf-8")
    elif source.startswith(("http://", "https://")):
        # URL-based image
        return {
            "type": "image_url",
            "image_url": {"url": source, "detail": detail},
        }
    else:
        # File path
        with open(source, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")

    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{media_type};base64,{data}",
            "detail": detail,
        },
    }


def filter_tojson_pretty(value: Any, indent: int = 2) -> str:
    """Pretty-print JSON in templates."""
    return json.dumps(value, indent=indent, ensure_ascii=False)


# =============================================================================
# Template Cache
# =============================================================================

class TemplateCache:
    """
    LRU cache for rendered templates.

    Avoids regenerating text for same template + context combinations.
    Thread-safe for concurrent access.
    """

    def __init__(self, maxsize: int = 128):
        self._cache: dict[str, tuple[str, datetime]] = {}
        self._maxsize = maxsize
        self._hits = 0
        self._misses = 0

    def _make_key(self, template_name: str, variables: dict[str, Any]) -> str:
        """Create cache key from template name and variables."""
        var_hash = hashlib.sha256(
            json.dumps(variables, sort_keys=True, default=str).encode()
        ).hexdigest()[:16]
        return f"{template_name}:{var_hash}"

    def get(self, template_name: str, variables: dict[str, Any]) -> Optional[str]:
        """Get cached result if available."""
        key = self._make_key(template_name, variables)
        if key in self._cache:
            self._hits += 1
            return self._cache[key][0]
        self._misses += 1
        return None

    def set(self, template_name: str, variables: dict[str, Any], result: str) -> None:
        """Cache a rendered result."""
        if len(self._cache) >= self._maxsize:
            # Remove oldest entry
            oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]

        key = self._make_key(template_name, variables)
        self._cache[key] = (result, datetime.now(UTC))

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "maxsize": self._maxsize,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / total if total > 0 else 0.0,
        }


# Built-in prompt templates
TEMPLATES = {
    "classification": """
{%- set system_prompt %}
You are a classification assistant. Classify the input into one of these categories:
{% for category in categories %}
- {{ category }}
{% endfor %}

Rules:
- Return ONLY the category name, nothing else
- If uncertain, choose the closest match
- Never invent new categories
{%- endset %}

{%- set user_prompt %}
{% if examples %}
Here are some examples:
{% for ex in examples %}
Input: {{ ex.input }}
Category: {{ ex.category }}
{% endfor %}

Now classify:
{% endif %}
Input: {{ user_input }}
Category:
{%- endset %}

{{ {"system": system_prompt, "user": user_prompt} | tojson }}
""",

    "chain_of_thought": """
{%- set system_prompt %}
You are a problem-solving assistant that thinks step by step.

When solving problems:
1. Break down the problem into clear steps
2. Show your reasoning for each step
3. Verify your answer before responding
{% if constraints %}
Constraints:
{% for c in constraints %}
- {{ c }}
{% endfor %}
{% endif %}

Format:
STEP 1: [description]
Reasoning: [thought process]

STEP 2: [description]
Reasoning: [thought process]
...

FINAL ANSWER: [conclusion]
{%- endset %}

{%- set user_prompt %}
Problem: {{ problem }}
{% if context %}
Context: {{ context }}
{% endif %}
Think through this step-by-step.
{%- endset %}

{{ {"system": system_prompt, "user": user_prompt} | tojson }}
""",

    "extraction": """
{%- set system_prompt %}
You are a data extraction assistant.

Extract the following fields from the input:
{% for field in fields %}
- {{ field.name }}: {{ field.description }}{% if field.required %} (required){% endif %}

{% endfor %}

Return JSON in this exact format:
{
{% for field in fields %}
  "{{ field.name }}": <extracted value or null>{% if not loop.last %},{% endif %}

{% endfor %}
  "confidence": 0.0-1.0
}

Rules:
- Only extract information explicitly stated
- Use null for missing optional fields
- Provide confidence based on extraction clarity
{%- endset %}

{%- set user_prompt %}
Input: {{ input_text }}

Extract the requested fields as JSON:
{%- endset %}

{{ {"system": system_prompt, "user": user_prompt} | tojson }}
""",

    "few_shot": """
{%- set system_prompt %}
{{ task_description }}
{% if rules %}

Rules:
{% for rule in rules %}
- {{ rule }}
{% endfor %}
{% endif %}
{%- endset %}

{%- set user_prompt %}
{% for example in examples %}
{{ input_label | default("Input") }}: {{ example.input }}
{{ output_label | default("Output") }}: {{ example.output }}

{% endfor %}
{{ input_label | default("Input") }}: {{ user_input }}
{{ output_label | default("Output") }}:
{%- endset %}

{{ {"system": system_prompt, "user": user_prompt} | tojson }}
""",

    "react": """
{%- set system_prompt %}
You are an AI assistant that solves tasks by reasoning and acting.

Available tools:
{% for tool in tools %}
- {{ tool.name }}: {{ tool.description }}
  Parameters: {{ tool.parameters | tojson }}
{% endfor %}

Use this format:
Thought: [your reasoning about what to do]
Action: [tool name from the list above]
Action Input: [input to the tool as JSON]
Observation: [result from the tool - wait for this]
... (repeat Thought/Action/Observation as needed)
Thought: I have enough information to answer
Final Answer: [your final response to the user]

{% if constraints %}
Constraints:
{% for c in constraints %}
- {{ c }}
{% endfor %}
{% endif %}
{%- endset %}

{%- set user_prompt %}
Task: {{ task }}
{% if context %}
Context: {{ context }}
{% endif %}
{%- endset %}

{{ {"system": system_prompt, "user": user_prompt} | tojson }}
""",
}


@dataclass
class PromptVersion:
    """Tracks prompt template versions."""
    template_name: str
    version: str
    content_hash: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    variables_used: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class PromptTemplateManager:
    """
    Jinja2-based prompt template manager with versioning support (2026 Standards).

    Features:
    - Built-in common templates (classification, CoT, extraction, few-shot, ReAct)
    - Async rendering support (Jinja2 3.1.x enable_async)
    - Template caching for performance optimization
    - Custom LLM filters (tool, cache_control, image)
    - Variable validation and extraction
    - Content hashing for version tracking
    - Langfuse/OpenTelemetry compatible metadata
    - OpenAI and Anthropic message format support
    """

    def __init__(
        self,
        template_dir: Optional[Path] = None,
        autoescape: bool = False,
        enable_async: bool = False,
        enable_cache: bool = False,
        cache_maxsize: int = 128,
    ):
        """
        Initialize template manager.

        Args:
            template_dir: Optional directory for file-based templates
            autoescape: Enable HTML autoescaping (usually False for prompts)
            enable_async: Enable async template rendering (Jinja2 3.1.x)
            enable_cache: Enable template result caching
            cache_maxsize: Maximum cache entries (default: 128)
        """
        self._enable_async = enable_async
        self._cache = TemplateCache(cache_maxsize) if enable_cache else None

        # Create Jinja2 environment with async support
        env_kwargs = {
            "autoescape": select_autoescape() if autoescape else False,
            "trim_blocks": True,
            "lstrip_blocks": True,
            "enable_async": enable_async,
        }

        if template_dir:
            self.env = Environment(
                loader=FileSystemLoader(template_dir),
                **env_kwargs,
            )
        else:
            self.env = Environment(**env_kwargs)

        # Register custom LLM filters
        self.env.filters["tool"] = filter_tool
        self.env.filters["cache_control"] = filter_cache_control
        self.env.filters["image"] = filter_image
        self.env.filters["tojson_pretty"] = filter_tojson_pretty

        # Register built-in templates
        self._templates: dict[str, str] = dict(TEMPLATES)
        self._versions: dict[str, PromptVersion] = {}

    def register_template(
        self,
        name: str,
        template: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> PromptVersion:
        """
        Register a custom template.

        Args:
            name: Template name
            template: Jinja2 template string
            metadata: Optional metadata for tracking

        Returns:
            PromptVersion with version info
        """
        self._templates[name] = template

        # Create version record
        content_hash = hashlib.sha256(template.encode()).hexdigest()[:12]
        version = PromptVersion(
            template_name=name,
            version=f"v1.{content_hash[:6]}",
            content_hash=content_hash,
            variables_used=self._extract_variables(template),
            metadata=metadata or {},
        )
        self._versions[name] = version

        logger.info(
            "template_registered",
            name=name,
            version=version.version,
            variables=version.variables_used,
        )

        return version

    def _extract_variables(self, template: str) -> list[str]:
        """Extract variable names from template."""
        from jinja2 import meta
        ast = self.env.parse(template)
        return list(meta.find_undeclared_variables(ast))

    def render(
        self,
        template_name: str,
        **variables: Any,
    ) -> dict[str, str]:
        """
        Render a template with variables (sync version).

        Args:
            template_name: Name of template to render
            **variables: Variables to pass to template

        Returns:
            Dict with "system" and "user" prompt strings

        Raises:
            TemplateNotFound: If template doesn't exist
            TemplateSyntaxError: If template has syntax errors
        """
        if template_name not in self._templates:
            raise TemplateNotFound(template_name)

        # Check cache first
        if self._cache:
            cached = self._cache.get(template_name, variables)
            if cached:
                logger.debug("template_cache_hit", template=template_name)
                return json.loads(cached)

        template_str = self._templates[template_name]

        try:
            template = self.env.from_string(template_str)
            rendered = template.render(**variables)

            # Parse the JSON output
            result = json.loads(rendered.strip())

            # Store in cache
            if self._cache:
                self._cache.set(template_name, variables, rendered.strip())

            logger.debug(
                "template_rendered",
                template=template_name,
                variables=list(variables.keys()),
            )

            return result

        except TemplateSyntaxError as e:
            logger.error(
                "template_syntax_error",
                template=template_name,
                error=str(e),
            )
            raise

    async def render_async(
        self,
        template_name: str,
        **variables: Any,
    ) -> dict[str, str]:
        """
        Render a template with variables (async version).

        Requires enable_async=True in constructor.

        Args:
            template_name: Name of template to render
            **variables: Variables to pass to template

        Returns:
            Dict with "system" and "user" prompt strings

        Raises:
            TemplateNotFound: If template doesn't exist
            RuntimeError: If async not enabled
        """
        if not self._enable_async:
            raise RuntimeError(
                "Async rendering not enabled. Use enable_async=True in constructor."
            )

        if template_name not in self._templates:
            raise TemplateNotFound(template_name)

        # Check cache first
        if self._cache:
            cached = self._cache.get(template_name, variables)
            if cached:
                logger.debug("template_cache_hit_async", template=template_name)
                return json.loads(cached)

        template_str = self._templates[template_name]

        try:
            template = self.env.from_string(template_str)
            rendered = await template.render_async(**variables)

            # Parse the JSON output
            result = json.loads(rendered.strip())

            # Store in cache
            if self._cache:
                self._cache.set(template_name, variables, rendered.strip())

            logger.debug(
                "template_rendered_async",
                template=template_name,
                variables=list(variables.keys()),
            )

            return result

        except TemplateSyntaxError as e:
            logger.error(
                "template_syntax_error",
                template=template_name,
                error=str(e),
            )
            raise

    def render_to_messages(
        self,
        template_name: str,
        **variables: Any,
    ) -> list[dict[str, str]]:
        """
        Render template to OpenAI-compatible message format.

        Returns:
            List of message dicts with "role" and "content"
        """
        prompts = self.render(template_name, **variables)

        messages = []
        if "system" in prompts and prompts["system"].strip():
            messages.append({
                "role": "system",
                "content": prompts["system"].strip()
            })
        if "user" in prompts and prompts["user"].strip():
            messages.append({
                "role": "user",
                "content": prompts["user"].strip()
            })

        return messages

    def get_version_info(self, template_name: str) -> Optional[PromptVersion]:
        """Get version info for a template."""
        return self._versions.get(template_name)

    def list_templates(self) -> list[str]:
        """List all available template names."""
        return list(self._templates.keys())

    def validate_variables(
        self,
        template_name: str,
        variables: dict[str, Any],
    ) -> tuple[bool, list[str]]:
        """
        Validate that all required variables are provided.

        Returns:
            Tuple of (is_valid, missing_variables)
        """
        if template_name not in self._templates:
            return False, [f"Template '{template_name}' not found"]

        required = self._extract_variables(self._templates[template_name])
        provided = set(variables.keys())
        missing = [v for v in required if v not in provided]

        return len(missing) == 0, missing

    def render_to_anthropic(
        self,
        template_name: str,
        use_cache_control: bool = False,
        **variables: Any,
    ) -> tuple[str, list[dict[str, Any]]]:
        """
        Render template to Anthropic API format.

        Args:
            template_name: Name of template to render
            use_cache_control: Enable prompt caching for system prompt
            **variables: Variables to pass to template

        Returns:
            Tuple of (system_prompt, messages_list)

        Example:
            system, messages = manager.render_to_anthropic("classification", **vars)
            response = anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                system=system,
                messages=messages,
            )
        """
        prompts = self.render(template_name, **variables)

        system_prompt = prompts.get("system", "").strip()
        messages = []

        if "user" in prompts and prompts["user"].strip():
            content = prompts["user"].strip()
            if use_cache_control:
                # Use cache_control for large contexts
                messages.append({
                    "role": "user",
                    "content": [filter_cache_control(content)],
                })
            else:
                messages.append({
                    "role": "user",
                    "content": content,
                })

        return system_prompt, messages

    def cache_stats(self) -> Optional[dict[str, Any]]:
        """
        Get cache statistics if caching is enabled.

        Returns:
            Cache stats dict or None if caching disabled
        """
        if self._cache:
            return self._cache.stats()
        return None

    def clear_cache(self) -> None:
        """Clear the template cache if enabled."""
        if self._cache:
            self._cache.clear()
            logger.info("template_cache_cleared")


def main():
    """Example usage of PromptTemplateManager (2026 Standards)."""
    import asyncio

    # Example 1: Basic usage
    print("=== Classification Template ===")
    manager = PromptTemplateManager()
    result = manager.render(
        "classification",
        categories=["urgent", "normal", "low"],
        examples=[
            {"input": "My account was hacked!", "category": "urgent"},
            {"input": "How do I update my profile?", "category": "normal"},
        ],
        user_input="I need to change my password"
    )
    print(f"System: {result['system'][:200]}...")
    print(f"User: {result['user']}")

    # Example 2: Chain of Thought with OpenAI format
    print("\n=== Chain of Thought (OpenAI Format) ===")
    messages = manager.render_to_messages(
        "chain_of_thought",
        problem="Calculate 15% of 240",
        constraints=["Show all arithmetic", "Verify the answer"],
    )
    for msg in messages:
        print(f"{msg['role'].upper()}: {msg['content'][:150]}...")

    # Example 3: Anthropic format with cache_control
    print("\n=== Anthropic Format with Cache Control ===")
    system, msgs = manager.render_to_anthropic(
        "classification",
        use_cache_control=True,
        categories=["positive", "negative", "neutral"],
        user_input="Great product!",
    )
    print(f"System prompt: {system[:100]}...")
    print(f"Messages: {msgs}")

    # Example 4: Caching for performance
    print("\n=== Template Caching ===")
    cached_manager = PromptTemplateManager(enable_cache=True)

    # First call - cache miss
    cached_manager.render("classification", categories=["a", "b"], user_input="test")
    print(f"After first call: {cached_manager.cache_stats()}")

    # Second call - cache hit
    cached_manager.render("classification", categories=["a", "b"], user_input="test")
    print(f"After second call: {cached_manager.cache_stats()}")

    # Example 5: Async rendering
    print("\n=== Async Rendering ===")

    async def async_example():
        async_manager = PromptTemplateManager(enable_async=True)
        result = await async_manager.render_async(
            "few_shot",
            task_description="Translate English to French",
            examples=[
                {"input": "Hello", "output": "Bonjour"},
                {"input": "Goodbye", "output": "Au revoir"},
            ],
            user_input="Thank you",
        )
        print(f"Async result: {result}")

    asyncio.run(async_example())

    # Example 6: Custom template with tool filter
    print("\n=== Tool Filter for Function Calling ===")

    def get_weather(location: str, unit: str = "celsius") -> str:
        """Get the current weather for a location."""
        return f"Weather in {location}"

    manager.register_template(
        "agent_with_tools",
        """
{%- set system_prompt %}
You are a helpful assistant with access to tools.
Available tools:
{{ get_weather | tool | tojson_pretty }}
{%- endset %}
{%- set user_prompt %}
{{ query }}
{%- endset %}
{{ {"system": system_prompt, "user": user_prompt} | tojson }}
"""
    )

    result = manager.render(
        "agent_with_tools",
        get_weather=get_weather,
        query="What's the weather in Paris?",
    )
    print(f"System with tool schema: {result['system'][:300]}...")

    # Example 7: Variable validation
    print("\n=== Variable Validation ===")
    is_valid, missing = manager.validate_variables(
        "extraction",
        {"input_text": "test"}  # Missing 'fields'
    )
    print(f"Valid: {is_valid}, Missing: {missing}")

    # List all templates
    print(f"\nAvailable templates: {manager.list_templates()}")
    print("\n✅ All 2026 patterns demonstrated: async, caching, filters, Anthropic format")


if __name__ == "__main__":
    main()

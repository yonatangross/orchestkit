"""
Safe Prompt Builder Template

Use this builder to construct prompts that are guaranteed
to be free of forbidden identifiers.
"""

import re
from dataclasses import dataclass, field
from typing import Any


# ============================================================
# PATTERNS
# ============================================================

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

CRITICAL_PATTERNS = [
    (UUID_PATTERN, "UUID"),
    (r'api[_-]?key\s*[:=]\s*\S+', "API_KEY"),
    (r'password\s*[:=]\s*\S+', "PASSWORD"),
    (r'secret\s*[:=]\s*\S+', "SECRET"),
    (r'token\s*[:=]\s*\S+', "TOKEN"),
]

WARNING_PATTERNS = [
    (r'\buser[_-]?id\b', "USER_ID"),
    (r'\btenant[_-]?id\b', "TENANT_ID"),
    (r'\banalysis[_-]?id\b', "ANALYSIS_ID"),
    (r'\bdocument[_-]?id\b', "DOCUMENT_ID"),
    (r'\bsession[_-]?id\b', "SESSION_ID"),
]


# ============================================================
# EXCEPTIONS
# ============================================================

class PromptSecurityError(Exception):
    """Raised when prompt contains forbidden content"""

    def __init__(self, message: str, violations: list[str]):
        super().__init__(message)
        self.violations = violations


# ============================================================
# AUDIT
# ============================================================

@dataclass
class AuditResult:
    """Result of prompt audit"""
    is_clean: bool
    critical_violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def audit_text(text: str) -> AuditResult:
    """Audit text for forbidden patterns"""
    critical = []
    warnings = []

    for pattern, name in CRITICAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            critical.append(name)

    for pattern, name in WARNING_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            warnings.append(name)

    return AuditResult(
        is_clean=len(critical) == 0,
        critical_violations=critical,
        warnings=warnings,
    )


# ============================================================
# BUILDER
# ============================================================

class SafePromptBuilder:
    """
    Builds prompts with automatic safety checks.

    Features:
    - Audits all text added to prompt
    - Sanitizes content to remove IDs
    - Stores context IDs separately for attribution
    - Final audit before returning prompt

    Usage:
        prompt, context = (
            SafePromptBuilder()
            .add_system("You are an expert analyzer.")
            .add_user_query(user_input)
            .add_context_documents(documents)
            .store_context("user_id", ctx.user_id)
            .store_context("sources", source_refs)
            .build()
        )
    """

    def __init__(self, strict: bool = True):
        """
        Args:
            strict: If True, raise on any warning. If False, only raise on critical.
        """
        self._parts: list[str] = []
        self._context: dict[str, Any] = {}
        self._strict = strict

    def add_system(self, instruction: str) -> "SafePromptBuilder":
        """Add system instruction (audited)"""
        audit = audit_text(instruction)
        if not audit.is_clean:
            raise PromptSecurityError(
                "System instruction contains forbidden content",
                audit.critical_violations,
            )
        if self._strict and audit.warnings:
            raise PromptSecurityError(
                "System instruction contains warning patterns",
                audit.warnings,
            )

        self._parts.append(f"SYSTEM:\n{instruction}")
        return self

    def add_user_query(self, query: str) -> "SafePromptBuilder":
        """Add user query (sanitized)"""
        clean = self._sanitize(query)
        self._parts.append(f"USER QUERY:\n{clean}")
        return self

    def add_context_documents(
        self,
        documents: list[str],
        header: str = "CONTEXT:",
    ) -> "SafePromptBuilder":
        """Add context documents (sanitized)"""
        clean_docs = [self._sanitize(doc) for doc in documents]
        formatted = "\n".join(f"- {doc}" for doc in clean_docs)
        self._parts.append(f"{header}\n{formatted}")
        return self

    def add_instruction(self, instruction: str) -> "SafePromptBuilder":
        """Add instruction (audited)"""
        audit = audit_text(instruction)
        if not audit.is_clean:
            raise PromptSecurityError(
                "Instruction contains forbidden content",
                audit.critical_violations,
            )

        self._parts.append(instruction)
        return self

    def add_raw(self, text: str) -> "SafePromptBuilder":
        """Add raw text (sanitized, no audit failure)"""
        clean = self._sanitize(text)
        self._parts.append(clean)
        return self

    def store_context(self, key: str, value: Any) -> "SafePromptBuilder":
        """
        Store context for post-LLM attribution.
        These values are NEVER included in the prompt.
        """
        self._context[key] = value
        return self

    def _sanitize(self, text: str) -> str:
        """Remove IDs from text"""
        # Remove UUIDs
        text = re.sub(UUID_PATTERN, '[REDACTED]', text, flags=re.IGNORECASE)

        # Remove ID field patterns with values
        patterns = [
            r'user_id:\s*\S+',
            r'tenant_id:\s*\S+',
            r'doc_id:\s*\S+',
        ]
        for pattern in patterns:
            text = re.sub(pattern, '[REDACTED]', text, flags=re.IGNORECASE)

        return text

    def build(self) -> tuple[str, dict[str, Any]]:
        """
        Build the prompt and return with stored context.

        Returns:
            (prompt, context) tuple

        Raises:
            PromptSecurityError: If final audit fails
        """
        prompt = "\n\n".join(self._parts)

        # Final audit
        audit = audit_text(prompt)
        if not audit.is_clean:
            raise PromptSecurityError(
                f"Final prompt contains forbidden content: {audit.critical_violations}",
                audit.critical_violations,
            )

        return prompt, self._context.copy()


# ============================================================
# CONVENIENCE FUNCTIONS
# ============================================================

def build_analysis_prompt(
    query: str,
    context_texts: list[str],
    system_instruction: str = "You are an expert content analyzer.",
) -> tuple[str, dict]:
    """Build a standard analysis prompt"""
    return (
        SafePromptBuilder()
        .add_system(system_instruction)
        .add_user_query(query)
        .add_context_documents(context_texts, "RELEVANT CONTEXT:")
        .add_instruction("""
Analyze the content and provide:
1. Summary (2-3 sentences)
2. Key concepts (list of 3-5)
3. Difficulty level (beginner/intermediate/advanced)
""")
        .build()
    )


def build_qa_prompt(
    question: str,
    context_texts: list[str],
) -> tuple[str, dict]:
    """Build a Q&A prompt"""
    return (
        SafePromptBuilder()
        .add_system(
            "You are a helpful assistant. Answer questions based only on "
            "the provided context. If the answer is not in the context, say so."
        )
        .add_context_documents(context_texts, "CONTEXT:")
        .add_user_query(question)
        .add_instruction("Provide a clear, accurate answer:")
        .build()
    )


# ============================================================
# EXAMPLE USAGE
# ============================================================

if __name__ == "__main__":
    # Example: Safe prompt building
    from uuid import uuid4

    user_id = uuid4()
    doc_ids = [uuid4(), uuid4()]

    prompt, context = (
        SafePromptBuilder()
        .add_system("You are an expert content analyzer.")
        .add_user_query("What are the key concepts in machine learning?")
        .add_context_documents([
            "Machine learning is a subset of AI...",
            "Supervised learning uses labeled data...",
        ])
        .store_context("user_id", user_id)  # Stored, not in prompt
        .store_context("source_ids", doc_ids)  # Stored, not in prompt
        .build()
    )

    print("Prompt:")
    print(prompt)
    print("\nContext (for attribution):")
    print(context)

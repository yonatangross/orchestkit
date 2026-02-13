# Context Positioning Reference

Attention-aware template structures, priority positioning rules, and practical prompt optimization patterns.

---

## Attention-Aware Template Structure

Position content based on attention strength:

```markdown
[START - HIGH ATTENTION]
## System Identity
You are a {role} specialized in {domain}.

## Critical Constraints
- NEVER {dangerous_action}
- ALWAYS {required_behavior}

[MIDDLE - LOWER ATTENTION]
## Background Context
{retrieved_documents}
{older_conversation_history}

[END - HIGH ATTENTION]
## Current Task
{recent_messages}
{user_query}

## Response Guidelines
{output_format_instructions}
```

---

## Priority Positioning Rules

### Ordered by Priority

| Priority | Content Type | Position | Reason |
|----------|-------------|----------|--------|
| 1 | Identity & Constraints | START | Immutable, high attention |
| 2 | Critical instructions | START or END | Must not be lost |
| 3 | Tool definitions | After identity | Capability discovery |
| 4 | Retrieved documents | MIDDLE | Expandable, lower priority |
| 5 | Conversation history | MIDDLE | Compressible |
| 6 | Current query | END | Always visible, high attention |
| 7 | Output format | END | Guides generation |

### Key Rules

1. **Identity & Constraints** -> START (immutable)
2. **Critical instructions** -> START or END (repeat if crucial)
3. **Retrieved documents** -> MIDDLE (expandable)
4. **Conversation history** -> MIDDLE (compressible)
5. **Current query** -> END (always visible)
6. **Output format** -> END (guides generation)

---

## Repeating Critical Constraints

For truly critical constraints, state at START and reinforce at END:

```markdown
[START]
## Rules
Never output code without tests.
Never expose API keys or credentials in code examples.

...middle content (documents, history)...

[END]
REMINDER: Include tests with any code. Never include real credentials.

User query: Write a function to call the payment API...
```

This dual placement counters the "lost in the middle" effect for safety-critical instructions.

---

## Agent System Prompt Design

### OrchestKit Agent Pattern

Apply attention-aware positioning to agent definitions:

```markdown
# Agent: backend-system-architect

[HIGH ATTENTION - START]
## Identity
Senior backend architect with 15+ years experience.

## Constraints
- NEVER suggest unvalidated security patterns
- ALWAYS consider multi-tenant isolation

[LOWER ATTENTION - MIDDLE]
## Domain Knowledge
{dynamically_loaded_patterns}

[HIGH ATTENTION - END]
## Current Task
{user_request}
```

### System Prompt Altitude

| Level | Example | Problem |
|-------|---------|---------|
| Too High | "Be helpful" | No clear guidance, inconsistent |
| Too Low | "Always respond in 3 bullet points of 15 words" | Brittle, breaks on edge cases |
| Optimal | "Senior engineer who values clarity, tests assumptions, explains trade-offs" | Principled, flexible |

---

## Markers for Middle Content

Help the model navigate middle-positioned content with relevance signals:

```markdown
## Retrieved Document 1 of 3: Authentication Patterns
[RELEVANCE: HIGH for auth questions]
...content...

## Retrieved Document 2 of 3: Database Schema
[RELEVANCE: MEDIUM - background context]
...content...

## Retrieved Document 3 of 3: Deployment Guide
[RELEVANCE: LOW - reference only]
...content...
```

### Benefits of Markers
- Model can prioritize attention on high-relevance documents
- Reduces "attention dilution" in the middle section
- Provides explicit cues for which content to focus on
- Enables selective retrieval in follow-up turns

---

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Token stuffing | "More context = better" | Quality over quantity |
| Flat structure | No priority signaling | Use headers, positioning |
| Static context | Same context for all queries | Dynamic, query-relevant retrieval |
| Ignoring middle | Important info gets lost | Position critically, use markers |
| No compression | Context grows unbounded | Sliding window + summarization |
| Identity in middle | Agent "forgets" who it is | Always position identity at START |

---

## Skill Loading Optimization

Progressive skill disclosure for OrchestKit:

```python
# Stage 1: Load skill metadata only (~100 tokens)
skill_index = load_skill_summaries()

# Stage 2: Load relevant skill on demand (~500 tokens)
if task_matches("database"):
    full_skill = load_skill("pgvector-search")
```

This prevents pre-loading all 151 skills (which would consume the entire context budget) and instead loads skills just-in-time based on task relevance.

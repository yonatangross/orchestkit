---
title: "Engineering: Attention-Aware Positioning"
category: engineering
impact: HIGH
impactDescription: Strategic positioning leverages the lost-in-the-middle effect for maximum attention
tags: [attention, positioning, lost-in-middle, template, priority]
---

# Attention-Aware Positioning

## The "Lost in the Middle" Phenomenon

```
Attention
Strength   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
           START              MIDDLE (weakest)           END
```

| Position | Attention | Best For |
|----------|-----------|----------|
| START | High (85-95%) | System identity, critical instructions, constraints |
| MIDDLE | Low (10-40%) | Background context, optional details |
| END | High (80-95%) | Current task, recent messages, output format |

## Template Structure

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

## Priority Positioning Rules

1. Identity & Constraints -> START (immutable)
2. Critical instructions -> START or END
3. Retrieved documents -> MIDDLE (expandable)
4. Conversation history -> MIDDLE (compressible)
5. Current query -> END (always visible)
6. Output format -> END (guides generation)

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Token stuffing | "More = better" | Quality over quantity |
| Flat structure | No priority signaling | Use headers, positioning |
| Static context | Same for all queries | Dynamic, query-relevant |
| No compression | Unbounded growth | Sliding window + summarization |

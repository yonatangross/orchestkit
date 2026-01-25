# Context Optimization Checklist

Use this checklist when designing agent systems, prompts, or optimizing existing context usage.

---

## Pre-Design Questions

- [ ] What is the expected context length for typical tasks?
- [ ] What percentage of budget should go to each layer?
- [ ] Are there hard constraints (cost, latency, model limits)?
- [ ] What information is truly critical vs nice-to-have?

---

## System Prompt Optimization

### Identity & Role
- [ ] Role is specific enough to guide behavior
- [ ] Role is not so rigid it breaks on edge cases
- [ ] Expertise level is defined (junior, senior, expert)
- [ ] Domain boundaries are clear

### Principles vs Rules
- [ ] Uses principles (flexible) over rules (brittle)
- [ ] Principles are actionable, not vague
- [ ] Edge cases are handled by principles, not exhaustive rules

### Constraints & Boundaries
- [ ] Critical constraints are explicitly stated
- [ ] "Never do X" boundaries are defined
- [ ] Security constraints are non-negotiable
- [ ] Constraints are positioned at START of context

### Positioning
- [ ] System prompt is at START (high attention)
- [ ] Critical constraints are reinforced at END if needed
- [ ] Not buried in middle of context

---

## Tool Definition Optimization

### Clarity
- [ ] Each tool has clear trigger conditions (when to use)
- [ ] Each tool has explicit exclusions (when NOT to use)
- [ ] Tool descriptions include 2-3 examples
- [ ] A human could unambiguously choose between tools

### Parameters
- [ ] Required vs optional parameters are clear
- [ ] Parameter types and constraints are documented
- [ ] Default values are sensible
- [ ] Examples show realistic parameter values

### Output
- [ ] Output format is documented
- [ ] Output size is bounded or documented
- [ ] Error cases are described

---

## Retrieved Documents Optimization

### Retrieval Strategy
- [ ] Just-in-time loading, not pre-loading
- [ ] Progressive disclosure (summaries → full docs)
- [ ] Relevance scoring filters low-quality matches
- [ ] Diversity in retrieval (not just top-N similar)

### Document Formatting
- [ ] Documents have clear headers/markers
- [ ] Source attribution is included
- [ ] Relevance hints are provided
- [ ] Long documents are chunked appropriately

### Budget Control
- [ ] Maximum document count is enforced
- [ ] Maximum tokens per document is enforced
- [ ] Total retrieval budget is defined

---

## Message History Optimization

### Retention Strategy
- [ ] Sliding window is implemented
- [ ] Window size is appropriate for task type
- [ ] Compression triggers are defined (70% threshold)
- [ ] Recent messages are always preserved

### Compression Quality
- [ ] Compression preserves task-critical information
- [ ] Structured format (intent, decisions, state)
- [ ] Incremental compression (merge, don't regenerate)
- [ ] Probe-based evaluation validates quality

### Special Handling
- [ ] System messages are never compressed
- [ ] User preferences are preserved
- [ ] Key decisions are explicitly tracked

---

## Tool Output Optimization

### Output Bounding
- [ ] Maximum output size is enforced at source
- [ ] Large outputs are truncated with indication
- [ ] Structured extraction over raw dumps
- [ ] Pagination for large result sets

### Summarization
- [ ] Large outputs are summarized before return
- [ ] Summaries preserve actionable information
- [ ] Original data is available if needed (lazy loading)

### Error Handling
- [ ] Errors are concise but informative
- [ ] Stack traces are truncated appropriately
- [ ] Recovery suggestions are included

---

## Attention Positioning

### START (High Attention)
- [ ] Agent identity and role
- [ ] Critical constraints and rules
- [ ] Security boundaries
- [ ] Output format requirements

### MIDDLE (Lower Attention)
- [ ] Retrieved documents
- [ ] Older conversation history
- [ ] Background context
- [ ] Optional reference material

### END (High Attention)
- [ ] Current task/query
- [ ] Recent messages
- [ ] Reinforced critical instructions
- [ ] Immediate context for response

---

## Budget Monitoring

### Utilization Tracking
- [ ] Current context size is measurable
- [ ] Budget utilization percentage is tracked
- [ ] Alerts at 70% utilization (compression trigger)
- [ ] Hard limits prevent overflow

### Efficiency Metrics
- [ ] Tokens-per-task is tracked (not per-request)
- [ ] Retrieval efficiency is measured
- [ ] Compression effectiveness is evaluated
- [ ] Cost per completion is monitored

---

## Testing & Validation

### Attention Testing
- [ ] Needle-in-haystack tests for critical info
- [ ] Test at various context positions
- [ ] Validate middle-position retrieval

### Compression Testing
- [ ] Probe-based evaluation implemented
- [ ] >90% probe pass rate target
- [ ] Task completion tested post-compression

### End-to-End
- [ ] Full task completion with optimized context
- [ ] Performance comparison vs unoptimized
- [ ] Edge case handling validated

---

## Quick Reference: Token Budget Allocation

| Application Type | System | Tools | History | Retrieval | Current |
|-----------------|--------|-------|---------|-----------|---------|
| Simple Chat | 5% | 5% | 60% | 20% | 10% |
| RAG Chat | 5% | 5% | 40% | 40% | 10% |
| Agent | 10% | 15% | 30% | 25% | 20% |
| Multi-Agent | 15% | 20% | 25% | 25% | 15% |

---

## Red Flags

- ❌ Context regularly exceeds 80% utilization
- ❌ Tool outputs dominate context (>50%)
- ❌ No compression strategy for long conversations
- ❌ Critical info positioned in middle
- ❌ Pre-loading documents "just in case"
- ❌ Rigid rules instead of flexible principles
- ❌ No token tracking or budgeting

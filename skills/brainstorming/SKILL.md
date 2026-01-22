---
name: brainstorming
description: Use when creating or developing anything, before writing code or implementation plans. Brainstorming skill refines ideas through structured questioning and alternatives.
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: true
---

# Brainstorming Ideas Into Designs

## Overview

Transform rough ideas into fully-formed designs through structured questioning and alternative exploration.

**Core principle:** Ask questions to understand, explore alternatives, present design incrementally for validation.

**Announce skill usage at start of session.**

## When NOT to Use This Skill

**Skip brainstorming when:**
- Requirements are crystal clear and specific
- Only one obvious approach exists
- User has already designed the solution (just needs implementation)
- Time-sensitive bug fix or urgent production issue
- User explicitly says "just implement it" without questions

**Examples of clear requirements (no brainstorming needed):**
- "Add a print button to this page"
- "Fix this TypeError on line 42"
- "Update the copyright year to 2026"
- "Change the button color to #FF5733"

## The Three-Phase Process

| Phase | Key Activities | Tool Usage | Output |
|-------|----------------|------------|--------|
| **1. Understanding** | Ask questions (one at a time) | AskUserQuestion for choices | Purpose, constraints, criteria |
| **2. Exploration** | Propose 2-3 approaches | AskUserQuestion for approach selection | Architecture options with trade-offs |
| **3. Design Presentation** | Present in 200-300 word sections | Open-ended questions | Complete design with validation |

### Phase 1: Understanding

**Goal:** Gather purpose, constraints, and success criteria.

**Process:**
- Check current project state in working directory
- Ask ONE question at a time to refine the idea
- Use AskUserQuestion tool when presenting multiple choice options
- Gather: Purpose, constraints, success criteria

**Tool Usage:**
Use AskUserQuestion for clarifying questions with 2-4 clear options.

Example: "Where should the authentication data be stored?" with options for Session storage, Local storage, Cookies, each with trade-off descriptions.

See `references/example-session-auth.md` for complete Phase 1 example.

### Phase 2: Exploration

**Goal:** Propose 2-3 different architectural approaches with explicit trade-offs.

**Process:**
- Propose 2-3 different approaches
- For each: Core architecture, trade-offs, complexity assessment
- Use AskUserQuestion tool to present approaches as structured choices
- Include trade-off comparison table when helpful

**Trade-off Format:**

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Option 1 | Benefits | Drawbacks | Low/Med/High |
| Option 2 | Benefits | Drawbacks | Low/Med/High |
| Option 3 | Benefits | Drawbacks | Low/Med/High |

See `references/example-session-dashboard.md` for complete Phase 2 example with SSE vs WebSockets vs Polling comparison.

### Phase 3: Design Presentation

**Goal:** Present complete design incrementally, validating each section.

**Process:**
- Present in 200-300 word sections
- Cover: Architecture, components, data flow, error handling, testing
- Ask after each section: "Does this look right so far?"
- Use open-ended questions to allow freeform feedback

**Typical Sections:**
1. Architecture overview
2. Component details
3. Data flow
4. Error handling
5. Security considerations
6. Implementation priorities

**Validation Pattern:**
After each section, pause for feedback before proceeding to next section.

## Tool Usage Guidelines

### Use AskUserQuestion Tool For:
- Phase 1: Clarifying questions with 2-4 clear options
- Phase 2: Architectural approach selection (2-3 alternatives)
- Any decision with distinct, mutually exclusive choices
- When options have clear trade-offs to explain

**Benefits:**
- Structured presentation of options with descriptions
- Clear trade-off visibility
- Forces explicit choice (prevents vague "maybe both" responses)

### Use Open-Ended Questions For:
- Phase 3: Design validation
- When detailed feedback or explanation is needed
- When the user should describe their own requirements
- When structured options would limit creative input

## Non-Linear Progression

**Flexibility is key.** Go backward when needed - don't force linear progression.

**Return to Phase 1 when:**
- User reveals new constraint during Phase 2 or 3
- Validation shows fundamental gap in requirements
- Something doesn't make sense

**Return to Phase 2 when:**
- User questions the chosen approach during Phase 3
- New information suggests a different approach would be better

**Continue forward when:**
- All requirements are clear
- Chosen approach is validated
- No new constraints emerge

## Key Principles

| Principle | Application |
|-----------|-------------|
| **One question at a time** | Phase 1: Single question per message, use AskUserQuestion for choices |
| **Structured choices** | Use AskUserQuestion tool for 2-4 options with trade-offs |
| **YAGNI ruthlessly** | Remove unnecessary features from all designs |
| **Explore alternatives** | Always propose 2-3 approaches before settling |
| **Incremental validation** | Present design in sections, validate each |
| **Flexible progression** | Go backward when needed - flexibility > rigidity |

## After Brainstorming Completes

Consider these optional next steps:
- Document the design in project's design documentation
- Break down the design into actionable implementation tasks
- Create a git branch or workspace for isolated development

Use templates in `scripts/design-doc-template.md` and `scripts/decision-matrix-template.md` for structured documentation.

## Socratic Questioning Templates

### Purpose Discovery Questions

**Goal:** Understand the "why" behind the feature.

- "What problem does this solve for your users?"
- "What happens if we don't build this?"
- "How will success be measured?"
- "Who is the primary user of this feature?"
- "What's the most important outcome?"

### Constraint Identification Questions

**Goal:** Uncover limitations and requirements.

- "Are there performance requirements? (e.g., must load in < 2s)"
- "What's the expected scale? (users, data volume, requests/sec)"
- "Are there compliance requirements? (GDPR, HIPAA, SOC2)"
- "What's the timeline/budget constraint?"
- "What existing systems must this integrate with?"

### Trade-Off Exploration Questions

**Goal:** Make implicit preferences explicit.

- "Would you prefer faster development or better performance?"
- "Is flexibility more important than simplicity?"
- "Should this be user-friendly or developer-friendly?"
- "Optimize for: initial build speed, maintainability, or scalability?"
- "What's more critical: feature completeness or time-to-market?"

### Alternative Exploration Questions

**Goal:** Ensure we consider all viable approaches.

- "What if we didn't build this at all? What's the workaround?"
- "How would [competitor/similar product] solve this?"
- "Could we start with a simpler version? What's the MVP?"
- "What if we had unlimited time/budget? What would we add?"
- "What approaches have you already considered and rejected? Why?"

---

## Common Pitfalls to Avoid

### Pitfall 1: Asking Too Many Questions Upfront

```
❌ BAD:
"Before we start, I need to know:
1. What's your tech stack?
2. How many users?
3. What's the budget?
4. What's the timeline?
5. Who's the target audience?
..."

✅ GOOD:
"What problem does this solve for your users?"
[Wait for answer, then ask next most important question]
```

**Why:** Information overload prevents conversation flow. Ask one at a time.

### Pitfall 2: Proposing Only One Approach

```
❌ BAD:
"Here's the solution: Use Redis for caching..."

✅ GOOD:
"I see three approaches:
1. Redis (fast, but adds infrastructure)
2. In-memory (simple, but doesn't scale)
3. Database query cache (integrated, but slower)
Which trade-offs matter most?"
```

**Why:** Single approach suggests you haven't explored alternatives.

### Pitfall 3: Over-Engineering from the Start

```
❌ BAD:
"Let's use microservices, Kubernetes, Redis, Kafka,
message queues, and a service mesh..."

✅ GOOD:
"For 100 users/day, a monolith with PostgreSQL
is sufficient. We can split services later if needed."
```

**Why:** YAGNI (You Aren't Gonna Need It). Start simple, scale when necessary.

### Pitfall 4: Ignoring Existing Code/Patterns

```
❌ BAD:
"Let's rebuild this with a completely different architecture..."

✅ GOOD:
[Read existing code first]
"I see you're using Express + PostgreSQL. Let's extend
that pattern with a new route handler..."
```

**Why:** Consistency > novelty. Use existing patterns unless there's a compelling reason to change.

---

## Integration with Other Skills

**After brainstorming completes, consider:**

- **architecture-decision-record**: Document key architectural decisions made during brainstorming
- **design-system-starter**: Create design tokens and components if building UI
- **api-design-framework**: Define API contracts if building backend services
- **testing-strategy-builder**: Plan testing approach for the designed system
- **security-checklist**: Review security implications of design choices

**Example flow:**
1. Brainstorming → Design approach selected
2. Architecture Decision Record → Document "Why we chose approach X"
3. API Design → Define endpoints and contracts
4. Testing Strategy → Plan how to test the implementation

---

## Tips for Effective Brainstorming

1. **Read the codebase first** - Don't propose changes without understanding existing patterns
2. **One question at a time** - Conversation flow > information dump
3. **Always propose 2-3 alternatives** - Shows you've explored options
4. **Make trade-offs explicit** - "Fast but complex" vs "Slow but simple"
5. **Validate incrementally** - Don't present 10-page design at once
6. **Be ready to backtrack** - Non-linear is fine when new info emerges
7. **Start simple, scale later** - YAGNI ruthlessly
8. **Document decisions** - Use ADRs for key architectural choices

---

**Version:** 2.0.0 (January 2026)
**Status:** Production patterns from OrchestKit brainstorming sessions

## Related Skills

- `architecture-decision-record` - Document key architectural decisions made during brainstorming sessions
- `implement` - Execute the implementation plan after brainstorming completes
- `context-engineering` - Optimize context for complex brainstorming sessions with many alternatives
- `explore` - Deep codebase exploration to understand existing patterns before proposing changes

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Question format | One at a time | Prevents information overload, maintains conversation flow |
| Tool for choices | AskUserQuestion | Structured options with trade-offs, forces explicit selection |
| Phase progression | Non-linear allowed | New constraints may require backtracking to earlier phases |
| Design presentation | 200-300 word sections | Incremental validation prevents large design misalignment |
| Alternative proposals | Always 2-3 options | Demonstrates exploration, reveals trade-offs |

## Capability Details

### phase-1-understanding
**Keywords:** brainstorm, idea, explore, requirements, constraints, purpose
**Solves:**
- Help me think through this idea
- What questions should I answer first?
- Clarify requirements and constraints
- Understand the purpose of this feature

### socratic-questions
**Keywords:** why, what problem, how measure, who uses, constraints
**Solves:**
- What questions should I ask about this feature?
- Help me discover requirements through questioning
- Uncover implicit constraints

### phase-2-exploration
**Keywords:** alternatives, options, different approach, trade-offs, compare
**Solves:**
- What are alternative approaches?
- Compare implementation options
- Explore trade-offs between solutions
- Which approach is best?

### trade-off-analysis
**Keywords:** pros, cons, trade-off, complexity, cost, performance
**Solves:**
- What are the trade-offs of each approach?
- Compare complexity vs features
- Speed vs maintainability decisions

### phase-3-design
**Keywords:** design, architecture, components, data flow, implementation
**Solves:**
- Present the complete design incrementally
- How should I structure this solution?
- What are the key components?
- Design validation and feedback

### mvp-scoping
**Keywords:** mvp, minimum, yagni, simplify, essential, start small
**Solves:**
- What's the minimum viable version?
- How do I avoid over-engineering?
- Apply YAGNI ruthlessly
- Start simple, scale later

### real-world-examples
**Keywords:** example, orchestkit, caching, dashboard, authentication
**Solves:**
- Show me real examples of brainstorming sessions
- How was OrchestKit designed?
- Caching strategy examples
- Real-time dashboard design decisions

### design-documentation
**Keywords:** document, adr, decision record, design doc
**Solves:**
- How do I document this design?
- Create an architecture decision record
- Document trade-offs and rationale

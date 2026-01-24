---
name: brainstorming
description: Use when creating or developing anything, before writing code or implementation plans. Brainstorming skill refines ideas through structured questioning and alternatives.
tags: [planning, ideation, creativity, design]
context: fork
version: 3.0.0
author: OrchestKit
user-invocable: true
allowedTools: [Task, Read, Grep, Glob, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [architecture-decision-record, api-design-framework, design-system-starter, recall, remember]
---

# Brainstorming Ideas Into Designs

## Overview

Transform rough ideas into fully-formed designs through intelligent agent selection and structured exploration.

**Core principle:** Analyze the topic, select the most relevant agents dynamically, explore alternatives in parallel, present design incrementally.

## When NOT to Use This Skill

**Skip brainstorming when:**
- Requirements are crystal clear and specific
- Only one obvious approach exists
- User has already designed the solution (just needs implementation)
- Time-sensitive bug fix or urgent production issue

**Examples of clear requirements (no brainstorming needed):**
- "Add a print button to this page"
- "Fix this TypeError on line 42"
- "Change the button color to #FF5733"

## The Five-Phase Process

| Phase | Key Activities | Agents/Tools | Output |
|-------|----------------|--------------|--------|
| **0. Topic Analysis** | Classify topic, select agents | Keyword matching | Agent list, skill list |
| **1. Memory + Context** | Search past decisions, check codebase | mcp__memory, Grep/Glob | Prior patterns, existing code |
| **2. Parallel Research** | 3-5 agents explore in parallel | Dynamic agent selection | Multiple perspectives |
| **3. Synthesis** | Combine agent outputs | Trade-off table | 2-3 unified approaches |
| **4. Design Presentation** | Present incrementally | AskUserQuestion | Validated design |

---

## Phase 0: Topic Analysis & Agent Selection (MANDATORY)

**Goal:** Identify topic domain and dynamically select the most relevant agents.

### Step 1: Create Brainstorming Task

```python
TaskCreate(
  subject="Brainstorm: {topic}",
  description="Design exploration for {topic} with parallel agent research",
  activeForm="Brainstorming {topic}"
)
```

### Step 2: Classify Topic Keywords

Parse the brainstorming topic for domain keywords:

| Domain | Keywords to Detect |
|--------|-------------------|
| **Backend/API** | api, endpoint, REST, GraphQL, backend, server, route |
| **Frontend/UI** | UI, component, React, frontend, page, form, dashboard |
| **Database** | database, schema, query, SQL, PostgreSQL, migration |
| **Auth/Security** | auth, login, JWT, OAuth, security, permission, role |
| **AI/LLM** | AI, LLM, RAG, embeddings, prompt, agent, workflow |
| **Performance** | performance, slow, optimize, cache, speed, latency |
| **Testing** | test, coverage, quality, e2e, unit, integration |
| **DevOps** | deploy, CI/CD, Docker, Kubernetes, infrastructure |
| **Real-time** | websocket, SSE, real-time, live, streaming, notification |

### Step 3: Select Agents Dynamically

**Agent Selection Matrix:**

| Detected Domain | Primary Agents | Skills to Read |
|-----------------|----------------|----------------|
| Backend/API | `backend-system-architect`, `security-auditor` | api-design-framework, error-handling-rfc9457 |
| Frontend/UI | `frontend-ui-developer`, `ux-researcher` | react-server-components-framework, design-system-starter |
| Database | `backend-system-architect` | database-schema-designer, sqlalchemy-2-async |
| Auth/Security | `security-auditor`, `backend-system-architect` | auth-patterns, owasp-top-10 |
| AI/LLM | `llm-integrator`, `workflow-architect` | rag-retrieval, langgraph-state, embeddings |
| Performance | `performance-engineer`, `backend-system-architect` | core-web-vitals, caching-strategies |
| Testing | `test-generator`, `code-quality-reviewer` | unit-testing, integration-testing |
| DevOps | `infrastructure-architect`, `ci-cd-engineer` | devops-deployment |
| Real-time | `backend-system-architect`, `frontend-ui-developer` | streaming-api-patterns, message-queues |

**Always include:** `workflow-architect` (system design perspective)

**Selection Rule:** Pick 3-5 agents based on detected domains. If multiple domains detected, include agents from each.

### Example Topic Analysis

**Topic:** "brainstorm user authentication with social login"

```
Keywords detected: auth, login, social
Domains: Auth/Security, Backend/API
Selected agents:
  1. workflow-architect (always)
  2. security-auditor (auth/security)
  3. backend-system-architect (auth + API)
  4. frontend-ui-developer (login UI)
Selected skills to read:
  - auth-patterns
  - owasp-top-10
  - api-design-framework
```

---

## Phase 1: Memory Check + Codebase Context

**Goal:** Gather existing knowledge before parallel research.

### Step 1: Search Knowledge Graph

```python
# Check for similar past brainstorms/decisions
mcp__memory__search_nodes(query="{topic}")
mcp__memory__search_nodes(query="{primary domain} patterns")
```

### Step 2: Check Existing Codebase

```python
# PARALLEL - Quick codebase scan
Grep(pattern="{topic keywords}", output_mode="files_with_matches")
Glob(pattern="**/*{topic}*")
```

### Step 3: Summarize Context

Document:
- Prior decisions found in memory
- Existing patterns in codebase
- Constraints from current architecture

---

## Phase 2: Parallel Agent Research (3-5 Agents)

**Goal:** Get diverse perspectives from dynamically selected agents.

### Dispatch Pattern

Launch ALL selected agents in ONE message with `run_in_background: true`:

```python
# Example for "user authentication with social login"
# PARALLEL - All agents in ONE message

Task(
  subagent_type="workflow-architect",
  prompt="""BRAINSTORM RESEARCH: user authentication with social login

  Analyze system design approaches:
  1. Identify 2-3 architectural patterns
  2. Consider: session vs JWT, OAuth flow, token storage
  3. Return trade-off matrix with complexity ratings

  Output format:
  {approaches: [{name, description, pros, cons, complexity}]}""",
  run_in_background=True
)

Task(
  subagent_type="security-auditor",
  prompt="""SECURITY ANALYSIS: user authentication with social login

  Evaluate security considerations:
  1. OAuth vulnerabilities (CSRF, token theft)
  2. Session management risks
  3. Secure token storage options
  4. OWASP auth best practices

  Output format:
  {risks: [...], recommendations: [...], must_haves: [...]}""",
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""BACKEND DESIGN: user authentication with social login

  Design backend implementation:
  1. API endpoint structure
  2. Database schema for users/sessions
  3. OAuth provider integration pattern
  4. Error handling approach

  Output format:
  {endpoints: [...], schema: {...}, patterns: [...]}""",
  run_in_background=True
)

Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND UX: user authentication with social login

  Design frontend experience:
  1. Login page component structure
  2. OAuth redirect flow UX
  3. Error states and loading states
  4. Accessibility requirements

  Output format:
  {components: [...], user_flow: [...], a11y: [...]}""",
  run_in_background=True
)
```

### Wait and Collect Results

```python
# Update task status
TaskUpdate(taskId="1", status="in_progress", activeForm="Collecting agent research")

# Results arrive via background task completion
# Synthesize in Phase 3
```

---

## Phase 3: Synthesis

**Goal:** Combine agent outputs into unified approaches.

### Step 1: Merge Agent Perspectives

For each agent result:
1. Extract key recommendations
2. Identify conflicts between agents
3. Note unanimous agreements

### Step 2: Build Trade-off Table

| Approach | Architecture | Security | UX | Complexity | Recommendation |
|----------|-------------|----------|-----|------------|----------------|
| Option A | [from workflow-architect] | [from security-auditor] | [from frontend] | Low/Med/High | Best for: ... |
| Option B | [from workflow-architect] | [from security-auditor] | [from frontend] | Low/Med/High | Best for: ... |
| Option C | [from workflow-architect] | [from security-auditor] | [from frontend] | Low/Med/High | Best for: ... |

### Step 3: Present to User

Use AskUserQuestion with synthesized options:

```python
AskUserQuestion(
  questions=[{
    "question": "Which authentication approach fits your needs?",
    "header": "Auth Design",
    "options": [
      {"label": "Option A: JWT + Redis", "description": "Stateless, scalable, requires Redis"},
      {"label": "Option B: Session cookies", "description": "Simple, stateful, no extra infra"},
      {"label": "Option C: OAuth-only", "description": "Delegate to providers, minimal backend"}
    ]
  }]
)
```

---

## Phase 4: Design Presentation

**Goal:** Present complete design incrementally, validating each section.

### Present in 200-300 Word Sections

1. **Architecture Overview** - High-level system design
2. **Component Details** - Specific implementation pieces
3. **Data Flow** - How data moves through the system
4. **Error Handling** - Failure modes and recovery
5. **Security Considerations** - From security-auditor insights
6. **Implementation Priorities** - What to build first

### Validation Pattern

After each section:
- "Does this look right so far?"
- Wait for feedback before proceeding
- Be ready to backtrack if new constraints emerge

### Store Decision in Memory

```python
# After user approves design
mcp__memory__create_entities(entities=[{
  "name": "{topic}-design-decision",
  "entityType": "Decision",
  "observations": ["Chose {approach} because {rationale}"]
}])

# Mark task complete
TaskUpdate(taskId="1", status="completed")
```

---

## Quick Reference: Agent Selection by Topic

| Topic Example | Agents to Spawn |
|---------------|-----------------|
| "brainstorm API for users" | workflow-architect, backend-system-architect, security-auditor |
| "brainstorm dashboard UI" | workflow-architect, frontend-ui-developer, ux-researcher, performance-engineer |
| "brainstorm RAG pipeline" | workflow-architect, llm-integrator, data-pipeline-engineer, backend-system-architect |
| "brainstorm caching strategy" | workflow-architect, backend-system-architect, performance-engineer |
| "brainstorm real-time notifications" | workflow-architect, backend-system-architect, frontend-ui-developer |
| "brainstorm database schema" | workflow-architect, backend-system-architect |
| "brainstorm CI/CD pipeline" | workflow-architect, ci-cd-engineer, infrastructure-architect |

---

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Dynamic agent selection** | Don't hardcode - select agents based on topic keywords |
| **Parallel research** | Launch 3-5 agents in ONE message for speed |
| **Memory-first** | Always check graph for past decisions before research |
| **Task tracking** | Use TaskCreate/TaskUpdate for progress visibility |
| **Synthesize, don't dump** | Combine agent outputs into unified trade-offs |
| **YAGNI ruthlessly** | Remove unnecessary complexity from all designs |

See `references/example-session-dashboard.md` for complete Phase 2 example with SSE vs WebSockets vs Polling comparison.

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

**Version:** 3.0.0 (January 2026)
**Status:** Production patterns from OrchestKit brainstorming sessions

## Related Skills

- `architecture-decision-record` - Document key architectural decisions made during brainstorming sessions
- `implement` - Execute the implementation plan after brainstorming completes
- `context-engineering` - Optimize context for complex brainstorming sessions with many alternatives
- `explore` - Deep codebase exploration to understand existing patterns before proposing changes

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent selection | Dynamic based on topic | Different topics need different expertise - no hardcoding |
| Parallel research | 3-5 agents in ONE message | Speed through parallelism, diverse perspectives |
| Memory integration | Check graph before research | Avoid re-discovering known patterns |
| Task tracking | TaskCreate/Update throughout | Progress visibility, structured workflow |
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

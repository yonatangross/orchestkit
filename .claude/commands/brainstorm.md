---
description: Multi-perspective idea exploration with parallel agents, Socratic method, and system design thinking
---

# Brainstorm: $ARGUMENTS

Deep exploration using 14-16 parallel agents with system design first approach.

> **📋 OUTPUT POLICY**: All agents follow `.claude/policies/agent-output-policy.md`
> - Tier 1 (Default): Return analysis inline - NO file creation
> - Tier 3 (Patterns): Only with explicit user approval
> - Tier 4 (Decisions): Update session/state.json (Context Protocol 2.0) after synthesis

## Phase 0: System Design Interrogation (NEW)

**Before exploring solutions, ask the right questions.**

### 0a. Load System Design Skills

```python
# Load skills for structured thinking
Read(".claude/skills/system-design-interrogation/capabilities.json")
Read(".claude/skills/system-design-interrogation/checklists/before-implementation.md")
```

### 0b. Five-Dimension Quick Assessment

Run these questions BEFORE any implementation thinking:

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM DESIGN INTERROGATION                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ SCALE     How many users? Data volume? Growth?           │
│  □ DATA      Where stored? Access pattern? Search needs?    │
│  □ SECURITY  Who can access? Tenant isolation? Attacks?     │
│  □ UX        Latency target? Feedback? Error handling?      │
│  □ COHERENCE Types across layers? Contracts? Breaking?      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```python
mcp__sequential-thinking__sequentialthinking(
  thought="""SYSTEM DESIGN INTERROGATION for: $ARGUMENTS

  SCALE:
  - How many users will use this?
  - What's the expected data volume?
  - What's the read/write ratio?

  DATA:
  - Where does this data naturally belong?
  - What's the primary access pattern?
  - Is search capability needed?

  SECURITY:
  - Who can access this?
  - How is tenant isolation enforced?
  - What attack vectors exist?

  UX:
  - What's the acceptable latency?
  - What feedback does the user need?
  - What happens on failure?

  COHERENCE:
  - Which layers does this touch?
  - What types/contracts change?
  - Is this a breaking change?""",
  thoughtNumber=1,
  totalThoughts=5,
  nextThoughtNeeded=true
)
```

## Phase 1: Initial Exploration (Sequential-Thinking MCP)

### 1a. Define the Problem Space

Use sequential-thinking for structured decomposition:

```python
mcp__sequential-thinking__sequentialthinking(
  thought="Exploring the problem space for: $ARGUMENTS",
  thoughtNumber=1,
  totalThoughts=7,
  nextThoughtNeeded=true
)
```

Key questions to answer:
- What problem are we solving?
- Who are the users?
- What constraints exist?
- What's already been tried?

### 1b. Load Brainstorming Skill

```python
Read(".claude/skills/brainstorming/capabilities.json")
Read(".claude/skills/brainstorming/SKILL.md")  # Full Socratic method
```

## Phase 2: Research & Context

### 2a. Web Search for Industry Solutions

```python
# PARALLEL - All searches in one message!
WebSearch("$ARGUMENTS best practices December 2025")
WebSearch("$ARGUMENTS industry solutions 2025")
WebSearch("$ARGUMENTS common pitfalls 2025")
WebSearch("$ARGUMENTS security considerations 2025")
WebSearch("$ARGUMENTS scalability patterns 2025")
```

### 2b. Memory MCP - Previous Brainstorms

```python
mcp__memory__search_nodes(query="brainstorm")
mcp__memory__search_nodes(query="design decisions")
mcp__memory__search_nodes(query="$ARGUMENTS")
```

### 2c. Context7 for Technical Possibilities

```python
# Look up relevant technologies
mcp__context7__get-library-docs(context7CompatibleLibraryID="/facebook/react", topic="patterns")
mcp__context7__get-library-docs(context7CompatibleLibraryID="/tiangolo/fastapi", topic="advanced")
```

## Phase 3: Multi-Perspective Analysis (12 Parallel Agents)

Launch TWELVE agents for diverse perspectives - ALL in ONE message:

**CRITICAL RULES FOR ALL AGENTS:**
- DO NOT write any files - Return analysis inline only
- DO NOT create MD files - No documentation, no reports
- Return structured text - Use code blocks and ASCII art
- Keep output concise - 500-1000 words max per agent

```python
# PARALLEL - All twelve in ONE message!

Task(
  subagent_type="product-manager",
  prompt="""BUSINESS PERSPECTIVE

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze from product perspective:
  1. Market need - does this solve a real problem?
  2. User value proposition
  3. Competitive landscape
  4. Success metrics (KPIs)
  5. Go-to-market considerations

  Use frameworks:
  - Jobs-to-be-Done
  - Value proposition canvas
  - RICE prioritization

  Output: Business case analysis with recommendations.""",
  run_in_background=true
)

Task(
  subagent_type="product-manager",
  prompt="""REQUIREMENTS ANALYSIS

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Define requirements:
  1. Functional requirements (must-have)
  2. Non-functional requirements (performance, security)
  3. User stories with acceptance criteria
  4. Edge cases and error scenarios
  5. Dependencies and constraints

  Format as structured user stories:
  "As a [user], I want [feature] so that [benefit]"

  Output: Requirements document.""",
  run_in_background=true
)

Task(
  subagent_type="ux-researcher",
  prompt="""USER EXPERIENCE PERSPECTIVE

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze user needs:
  1. User personas (who will use this?)
  2. User journey mapping
  3. Pain points addressed
  4. Delight opportunities
  5. Accessibility considerations

  Research methods to suggest:
  - User interviews
  - Usability testing
  - A/B testing opportunities

  Output: UX research plan and personas.""",
  run_in_background=true
)

Task(
  subagent_type="ux-researcher",
  prompt="""USABILITY ANALYSIS

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Evaluate usability:
  1. Cognitive load assessment
  2. Information architecture
  3. Navigation patterns
  4. Error prevention
  5. Help and documentation needs

  Apply heuristics:
  - Nielsen's 10 heuristics
  - WCAG 2.1 guidelines

  Output: Usability recommendations.""",
  run_in_background=true
)

Task(
  subagent_type="backend-system-architect",
  prompt="""TECHNICAL ARCHITECTURE PERSPECTIVE

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze technical feasibility:
  1. Architecture options (monolith vs microservice vs serverless)
  2. Technology stack considerations
  3. Scalability requirements
  4. Performance implications
  5. Integration challenges

  Consider trade-offs:
  - Build vs buy
  - Complexity vs flexibility
  - Speed vs robustness

  Output: Technical options with pros/cons.""",
  run_in_background=true
)

Task(
  subagent_type="security-auditor",
  prompt="""SECURITY & TENANT ISOLATION PERSPECTIVE (NEW)

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze security implications using 8-layer defense-in-depth:
  1. Edge protection needs (WAF, rate limiting)
  2. Authentication requirements
  3. Authorization model (RBAC/ABAC)
  4. Tenant isolation strategy
  5. Data access security (parameterized queries)
  6. LLM safety (if applicable - no IDs in prompts)
  7. Output validation needs
  8. Audit logging requirements

  Answer critical questions:
  - Who can access this data/feature?
  - How is tenant isolation enforced?
  - What attack vectors exist?
  - Is there PII involved?

  Output: Security assessment with layer-by-layer recommendations.""",
  run_in_background=true
)

Task(
  subagent_type="database-engineer",
  prompt="""DATA ARCHITECTURE PERSPECTIVE (NEW)

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze data requirements:
  1. Data model options (normalized vs denormalized)
  2. Storage location (existing table, new table, JSON field)
  3. Access patterns (read-heavy, write-heavy, balanced)
  4. Search requirements (full-text, vector, filter/sort)
  5. Schema migration needs
  6. Retention and archival policy

  Consider SkillForge context:
  - PostgreSQL with PGVector
  - Multi-tenant with tenant_id
  - User ownership with user_id

  Output: Data architecture recommendations with trade-offs.""",
  run_in_background=true
)

Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND IMPLEMENTATION PERSPECTIVE

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Analyze frontend approach:
  1. Component architecture options
  2. State management strategy
  3. Rendering approach (SSR, CSR, hybrid)
  4. Performance optimization
  5. Testing strategy

  React 19 considerations:
  - Server Components applicability
  - Streaming opportunities
  - Suspense boundaries

  Output: Frontend implementation options.""",
  run_in_background=true
)

Task(
  subagent_type="llm-integrator",
  prompt="""AI/ML OPPORTUNITIES & SAFETY (ENHANCED)

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Evaluate AI integration with safety in mind:
  1. Where can AI add value?
  2. LLM use cases (generation, analysis, search)
  3. Embedding/RAG opportunities
  4. Automation possibilities
  5. Cost-benefit analysis

  SAFETY CONSIDERATIONS:
  - Context separation (IDs flow AROUND LLM, not THROUGH)
  - What parameters must NOT go in prompts?
  - Pre-LLM filtering requirements
  - Post-LLM attribution needs
  - Output guardrails required

  Output: AI opportunity assessment with safety guardrails.""",
  run_in_background=true
)

Task(
  subagent_type="sprint-prioritizer",
  prompt="""IMPLEMENTATION PLANNING

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Plan implementation:
  1. MVP scope (minimum viable)
  2. Phase breakdown (iterations)
  3. Risk assessment
  4. Resource requirements
  5. Timeline estimation

  Use frameworks:
  - MoSCoW prioritization
  - Story point estimation
  - Risk matrix

  Output: Implementation roadmap.""",
  run_in_background=true
)

Task(
  subagent_type="test-generator",
  prompt="""TEST COVERAGE PLANNING (NEW)

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Plan test coverage:
  1. Unit test requirements (per layer)
  2. Integration test scenarios
  3. E2E test cases
  4. Security tests needed
     - Tenant isolation tests
     - Permission boundary tests
     - Input validation tests
  5. Performance test scenarios

  Critical tests to NOT forget:
  - Cross-tenant access blocked
  - Unauthorized access rejected
  - Invalid input handled
  - Error states covered

  Output: Test coverage plan with critical test cases.""",
  run_in_background=true
)

Task(
  subagent_type="whimsy-injector",
  prompt="""CREATIVE & DELIGHTFUL IDEAS

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Topic: $ARGUMENTS

  Think creatively:
  1. What would make this delightful?
  2. Unexpected features users would love
  3. Gamification opportunities
  4. Easter eggs or personality
  5. Viral/shareable moments

  Push boundaries:
  - What if we had no constraints?
  - What would Apple/Google do?
  - What's the 10x version?

  Output: Creative enhancement ideas.""",
  run_in_background=true
)
```

**Wait for all 12 to complete.**

## Phase 4: Synthesis & Coherence Review (3 Agents)

After collecting all perspectives, synthesize with coherence check:

```python
# PARALLEL - All three in ONE message!

Task(
  subagent_type="studio-coach",
  prompt="""SYNTHESIS: INTEGRATE ALL PERSPECTIVES

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Input: [Results from all 12 agents above]

  Create unified analysis:
  1. Common themes across perspectives
  2. Conflicting viewpoints and resolution
  3. Critical decisions needed
  4. Recommended approach
  5. Open questions for user

  Format: Executive summary with decision points.""",
  run_in_background=true
)

Task(
  subagent_type="Plan",
  prompt="""SOCRATIC QUESTIONS

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Based on all perspectives, generate:
  1. Clarifying questions (what's unclear?)
  2. Challenging questions (what assumptions?)
  3. Trade-off questions (what sacrifices?)
  4. Future questions (what might change?)
  5. Validation questions (how to test?)

  Goal: Surface decisions the user needs to make.""",
  run_in_background=true
)

Task(
  subagent_type="code-quality-reviewer",
  prompt="""COHERENCE & CONSISTENCY REVIEW (NEW)

  CRITICAL: DO NOT write any files. Return your analysis as text only.

  Review all proposals for cross-layer coherence:

  COHERENCE MATRIX:
  ┌──────────────────────────────────────────────────────────┐
  │ Layer      │ Types    │ Contracts │ Tests   │ Status    │
  ├────────────┼──────────┼───────────┼─────────┼───────────┤
  │ Database   │ Models   │ Schema    │ Unit    │ ?         │
  │ Backend    │ Pydantic │ API spec  │ Integ   │ ?         │
  │ Frontend   │ TypeScript│ Client   │ E2E     │ ?         │
  │ LLM        │ Schemas  │ Prompts   │ Golden  │ ?         │
  └──────────────────────────────────────────────────────────┘

  Check:
  1. Do types match across all layers?
  2. Are API contracts clear and consistent?
  3. Are there breaking changes?
  4. Is there a migration plan if needed?

  Output: Coherence assessment with gaps identified.""",
  run_in_background=true
)
```

## Phase 5: Interactive Refinement

Present findings to user with structured options:

```python
AskUserQuestion(questions=[
  {
    "header": "Approach",
    "question": "Which implementation approach resonates most?",
    "options": [
      {"label": "MVP First", "description": "Ship minimal version quickly, iterate"},
      {"label": "Full Build", "description": "Complete implementation upfront"},
      {"label": "Spike First", "description": "Technical proof-of-concept first"}
    ],
    "multiSelect": false
  },
  {
    "header": "Priorities",
    "question": "What matters most for this feature?",
    "options": [
      {"label": "Speed", "description": "Ship fast, iterate later"},
      {"label": "Quality", "description": "Get it right the first time"},
      {"label": "Security", "description": "Minimize attack surface"},
      {"label": "Scalability", "description": "Build for growth"}
    ],
    "multiSelect": true
  },
  {
    "header": "Security",
    "question": "What's the security posture for this feature?",
    "options": [
      {"label": "High Security", "description": "Full 8-layer defense, PII handling"},
      {"label": "Standard", "description": "Tenant isolation, auth, validation"},
      {"label": "Internal Only", "description": "Admin-only, less stringent"}
    ],
    "multiSelect": false
  }
])
```

## Phase 6: Save Brainstorm to Memory

```python
mcp__memory__create_entities(entities=[{
  "name": "brainstorm-$ARGUMENTS-[date]",
  "entityType": "brainstorm-session",
  "observations": [
    "Topic: $ARGUMENTS",
    "Key decision: ...",
    "Chosen approach: ...",
    "Security posture: ...",
    "Scale considerations: ...",
    "Open questions: ...",
    "Next steps: ..."
  ]
}])
```

---

## Summary

**Total Parallel Agents: 15**
- Phase 3: 12 multi-perspective agents (including 3 NEW)
- Phase 4: 3 synthesis agents (including 1 NEW)

**Perspectives Covered:**
- Business (2 product-managers)
- User Experience (2 ux-researchers)
- Architecture (1 backend-system-architect)
- **Security (1 security-auditor)** NEW
- **Data (1 database-engineer)** NEW
- Frontend (1 frontend-ui-developer)
- AI/ML (1 llm-integrator) ENHANCED
- Planning (1 sprint-prioritizer)
- **Testing (1 test-generator)** NEW
- Creativity (1 whimsy-injector)

**NEW System Design First Approach:**
- Phase 0 asks 5-dimension questions BEFORE exploring solutions
- Security-auditor evaluates 8-layer defense-in-depth
- Database-engineer considers data architecture specifically
- Test-generator plans coverage including security tests
- Coherence reviewer ensures cross-layer consistency

**MCPs Used:**
- sequential-thinking (structured decomposition)
- context7 (technical possibilities)
- memory (previous decisions)
- WebSearch (industry research)

**Skills Used:**
- brainstorming (Socratic method)
- **system-design-interrogation** NEW
- **defense-in-depth** NEW
- **llm-safety-patterns** NEW

**Output:**
- System design assessment (5 dimensions)
- Multi-perspective analysis (12 agents)
- Security layer review
- Coherence validation
- Synthesized recommendations
- Socratic questions
- Interactive decision points
- Saved to memory for future reference

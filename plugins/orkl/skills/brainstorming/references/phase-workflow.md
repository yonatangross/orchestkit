# Brainstorming Phase Workflow

Detailed instructions for the 7-phase brainstorming process.

## Phase 0: Project Context Discovery & Agent Selection

**Goal:** Detect project tier, then identify topic domain and select relevant agents.

### Step 0: Detect Project Tier

Before analyzing the topic, classify the project into one of 6 tiers (see `scope-appropriate-architecture` skill). This tier becomes the **complexity ceiling** for all ideas generated in later phases.

**Tier impacts on brainstorming:**
- **Tier 1-2 (Interview/Hackathon):** Skip complex patterns entirely. Ideas should focus on simplicity and directness. Limit to 5 ideas max.
- **Tier 3 (MVP):** Prefer managed services and monolith patterns. Flag any microservice or event-driven idea as OVERKILL.
- **Tier 4-5 (Growth/Enterprise):** Full brainstorming with all patterns available.
- **Tier 6 (Open Source):** Focus on API design, extensibility, and backwards compatibility.

**Include tier context in EVERY agent prompt:**
```
PROJECT TIER: {tier_name} (Tier {N})
COMPLEXITY CEILING: {ceiling_description}
Do NOT suggest patterns marked OVERKILL for this tier in the scope-appropriate-architecture matrix.
```

### Step 1: Classify Topic Keywords

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

### Step 2: Select Agents

| Detected Domain | Primary Agents | Skills to Read |
|-----------------|----------------|----------------|
| Backend/API | `backend-system-architect`, `security-auditor` | api-design-framework |
| Frontend/UI | `frontend-ui-developer`, `ux-researcher` | design-system-starter |
| Database | `backend-system-architect` | database-schema-designer |
| Auth/Security | `security-auditor`, `backend-system-architect` | auth-patterns |
| AI/LLM | `llm-integrator`, `workflow-architect` | rag-retrieval |
| Performance | `frontend-performance-engineer` | performance |

**Always include:** `workflow-architect` (system design perspective) + `test-generator` (testability assessment)

---

## Phase 1: Memory + Codebase Context

```python
# Check knowledge graph for past decisions
mcp__memory__search_nodes(query="{topic}")

# Quick codebase scan (PARALLEL)
Grep(pattern="{keywords}", output_mode="files_with_matches")
Glob(pattern="**/*{topic}*")
```

---

## Phase 2: Divergent Exploration

**CRITICAL:** Generate 10+ ideas WITHOUT filtering. Quantity over quality.

```python
# Launch ALL agents in ONE message
Task(subagent_type="workflow-architect", prompt="...", run_in_background=True)
Task(subagent_type="security-auditor", prompt="...", run_in_background=True)
Task(subagent_type="backend-system-architect", prompt="...", run_in_background=True)
```

**Divergent mindset instruction for agents:**
```
PROJECT TIER: {tier_name} (Tier {N})
COMPLEXITY CEILING: {ceiling_description}

DIVERGENT MODE: Generate as many approaches as possible.
- Do NOT filter or critique ideas in this phase
- Include unconventional, "crazy" approaches
- Target: At least 3-4 distinct approaches
- CONSTRAINT: Do NOT suggest patterns marked OVERKILL for Tier {N}
```

---

## Phase 3: Feasibility Fast-Check

30-second viability assessment per idea, including testability.

| Score | Label | Action |
|-------|-------|--------|
| 0-2 | Infeasible | Drop immediately |
| 3-5 | Challenging | Keep (flag risks) |
| 6-8 | Feasible | Keep for evaluation |
| 9-10 | Easy | Keep (may be too simple) |

### Testability Quick-Check (per idea)

Ask these 3 questions for each surviving idea:

1. **Unit testable?** Can core logic be tested without external services?
2. **Mock surface?** How many dependencies need mocking/stubbing? (fewer = better)
3. **Integration testable?** Can this be tested with real services via docker-compose/testcontainers?

Flag ideas that require mocking 5+ dependencies or cannot be integration-tested without complex setup.

---

## Phase 4: Evaluation & Rating

See `evaluation-rubric.md` for scoring criteria (6 dimensions including **testability**).
See `devils-advocate-prompts.md` for challenge templates (including testing challenges).

### Composite Score Formula

```python
composite = (
    impact * 0.20 +
    (10 - effort) * 0.20 +
    (10 - risk) * 0.15 +
    alignment * 0.20 +
    testability * 0.15 +
    innovation * 0.10
)

# Devil's advocate adjustment
if critical_concerns > 0:
    composite *= 0.7  # 30% penalty
```

---

## Phase 5: Synthesis

1. Filter to top 2-3 approaches
2. Merge perspectives from all agents
3. Build comprehensive trade-off table
4. **Add test strategy per approach** (see below)
5. Present to user with scores

### Test Strategy Per Approach

For each top approach, include:

| Aspect | Details |
|--------|---------|
| **Recommended test types** | Unit, Integration, E2E, Contract, Property-based |
| **Mock boundaries** | What to mock vs. what to test with real services |
| **Infrastructure needs** | docker-compose services, testcontainers, test DBs |
| **Testing-patterns rules** | Which `testing-patterns` rules apply (e.g., `integration-api`, `e2e-playwright`) |

This ensures the chosen design comes with a concrete testing plan, not just architecture.

```python
AskUserQuestion(questions=[{
  "question": "Which approach fits your needs?",
  "header": "Design Options",
  "options": [
    {"label": "Option A (7.8/10)", "description": "..."},
    {"label": "Option B (7.5/10)", "description": "..."}
  ]
}])
```

---

## Phase 6: Design Presentation

Present in 200-300 word sections:
1. Architecture Overview
2. Component Details
3. Data Flow
4. Error Handling
5. Security Considerations
6. **Test Plan** (test types, mock boundaries, infrastructure requirements)
7. Implementation Priorities

After each section: "Does this look right so far?"

```python
# Store decision in memory
mcp__memory__create_entities(entities=[{
  "name": "{topic}-design-decision",
  "entityType": "Decision",
  "observations": ["Chose {approach} because {rationale}"]
}])
```

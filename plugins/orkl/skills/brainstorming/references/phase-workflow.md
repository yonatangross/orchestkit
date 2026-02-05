# Brainstorming Phase Workflow

Detailed instructions for the 7-phase brainstorming process.

## Phase 0: Topic Analysis & Agent Selection

**Goal:** Identify topic domain and dynamically select relevant agents.

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
| Performance | `performance-engineer` | core-web-vitals |

**Always include:** `workflow-architect` (system design perspective)

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
DIVERGENT MODE: Generate as many approaches as possible.
- Do NOT filter or critique ideas in this phase
- Include unconventional, "crazy" approaches
- Target: At least 3-4 distinct approaches
```

---

## Phase 3: Feasibility Fast-Check

30-second viability assessment per idea.

| Score | Label | Action |
|-------|-------|--------|
| 0-2 | Infeasible | Drop immediately |
| 3-5 | Challenging | Keep (flag risks) |
| 6-8 | Feasible | Keep for evaluation |
| 9-10 | Easy | Keep (may be too simple) |

---

## Phase 4: Evaluation & Rating

See `evaluation-rubric.md` for scoring criteria.
See `devils-advocate-prompts.md` for challenge templates.

### Composite Score Formula

```python
composite = (
    impact * 0.25 +
    (10 - effort) * 0.20 +
    (10 - risk) * 0.20 +
    alignment * 0.20 +
    innovation * 0.15
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
4. Present to user with scores

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
6. Implementation Priorities

After each section: "Does this look right so far?"

```python
# Store decision in memory
mcp__memory__create_entities(entities=[{
  "name": "{topic}-design-decision",
  "entityType": "Decision",
  "observations": ["Chose {approach} because {rationale}"]
}])
```

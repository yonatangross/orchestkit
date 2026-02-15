# Agent Phases Reference

## 128K Output Token Strategy

With Opus 4.6's 128K output tokens, each agent produces **complete artifacts in a single pass**. This reduces implementation from 17 agents across 4 phases to **14 agents across 3 phases**.

| Metric | Before (64K) | After (128K) | Agent Teams Mode |
|--------|-------------|--------------|-----------------|
| Phase 4 agents | 5 | 5 (unchanged) | 4 teammates + lead |
| Phase 5 agents | 8 | 5 | Same 4 teammates (persist) |
| Phase 6 agents | 4 | 4 (unchanged) | 1 (code-reviewer verdict) + lead tests |
| **Total agents** | **17** | **14** | **4 teammates** (reused across phases) |
| Full API + models | 2 passes | 1 pass | 1 pass (same) |
| Component + tests | 2 passes | 1 pass | 1 pass (same) |
| Complete feature | 4-6 passes | 2-3 passes | 1-2 passes (overlapping) |
| Communication | Lead relays | Lead relays | Peer-to-peer messaging |
| Token cost | Baseline | ~Same | ~2.5x (full sessions) |

**Key principle:** Prefer one comprehensive response over multiple incremental ones. Only split when scope genuinely exceeds 128K tokens.

**Agent Teams advantage:** Teammates persist across phases 4→5→6, so context is preserved. No re-explaining architecture to implementation agents — they already know it because they designed it.

---

## Phase 4: Architecture Design (5 Agents)

All 5 agents launch in ONE message with `run_in_background=true`.

### Agent 1: Workflow Architect
```python
Task(
  subagent_type="workflow-architect",
  prompt="""ARCHITECTURE PLANNING — SINGLE-PASS OUTPUT

  Feature: $ARGUMENTS

  Produce a COMPLETE implementation roadmap in one response:

  1. COMPONENT BREAKDOWN
     - Frontend components needed (with file paths)
     - Backend services/endpoints (with route paths)
     - Database schema changes (with table/column names)
     - AI/ML integrations (if any)

  2. DEPENDENCY GRAPH
     - What must be built first?
     - What can be parallelized?
     - Integration points between frontend/backend

  3. RISK ASSESSMENT
     - Technical challenges with mitigations
     - Performance concerns with benchmarks
     - Security considerations with OWASP mapping

  4. TASK BREAKDOWN
     - Concrete tasks for each agent
     - Estimated tool calls per task
     - Acceptance criteria per task

  Output: Complete implementation roadmap with task dependencies.
  Use full 128K output capacity — don't truncate or summarize.""",
  run_in_background=true
)
```

### Agent 2: Backend Architect
```python
Task(
  subagent_type="backend-system-architect",
  prompt="""COMPLETE BACKEND ARCHITECTURE — SINGLE PASS

  Feature: $ARGUMENTS
  Standards: FastAPI, Pydantic v2, async/await, SQLAlchemy 2.0

  Produce ALL of the following in one response:
  1. API endpoint design (routes, methods, status codes, rate limits)
  2. Pydantic v2 request/response schemas with Field constraints
  3. SQLAlchemy 2.0 async model definitions with relationships
  4. Service layer patterns (repository + unit of work)
  5. Error handling (RFC 9457 Problem Details)
  6. Database migration strategy (tables, indexes, constraints)
  7. Testing strategy (unit + integration test outline)

  Include file paths for every artifact.
  Output: Complete backend implementation spec ready for coding.""",
  run_in_background=true
)
```

### Agent 3: Frontend Developer
```python
Task(
  subagent_type="frontend-ui-developer",
  prompt="""COMPLETE FRONTEND ARCHITECTURE — SINGLE PASS

  Feature: $ARGUMENTS
  Standards: React 19, TypeScript strict, Zod, TanStack Query

  Produce ALL of the following in one response:
  1. Component hierarchy with file paths
  2. Zod schemas for ALL API responses
  3. State management approach (Zustand slices or React 19 hooks)
  4. TanStack Query configuration (keys, stale time, prefetching)
  5. Form handling with React Hook Form + Zod
  6. Loading states (skeleton components, not spinners)
  7. Error boundaries and fallback UI
  8. Accessibility requirements (WCAG 2.1 AA)

  Include Tailwind class specifications for key components.
  Output: Complete frontend implementation spec ready for coding.""",
  run_in_background=true
)
```

### Agent 4: LLM Integrator
```python
Task(
  subagent_type="llm-integrator",
  prompt="""AI/ML INTEGRATION ANALYSIS — SINGLE PASS

  Feature: $ARGUMENTS

  Evaluate and design AI integration in one response:
  1. Does this feature need LLM? (justify yes/no)
  2. Provider selection (Anthropic/OpenAI/Ollama) with rationale
  3. Prompt template design (versioned, with Langfuse tracking)
  4. Function calling / tool definitions (if needed)
  5. Streaming strategy (SSE endpoint design)
  6. Caching strategy (prompt caching + semantic caching)
  7. Cost estimation (tokens per request, monthly projection)
  8. Fallback chain configuration

  Output: Complete AI integration spec or "No AI needed" with justification.""",
  run_in_background=true
)
```

### Agent 5: UX Researcher
```python
Task(
  subagent_type="ux-researcher",
  prompt="""UX ANALYSIS — SINGLE PASS

  Feature: $ARGUMENTS

  Produce complete UX research in one response:
  1. Primary persona with behavioral patterns
  2. User journey map with friction points and opportunities
  3. Accessibility requirements (WCAG 2.1 AA specific checks)
  4. Loading state strategy (skeleton vs progressive)
  5. Error messaging guidelines
  6. Mobile responsiveness breakpoints
  7. Success metrics (measurable KPIs)
  8. User stories with acceptance criteria

  Output: Complete UX requirements document.""",
  run_in_background=true
)
```

### Phase 4 — Teams Mode

In Agent Teams mode, 4 teammates form a team (`implement-{feature-slug}`) instead of 5 independent Task spawns. The workflow-architect and ux-researcher roles are handled by the lead or omitted for simpler features. Teammates message architecture decisions to each other in real-time.

See [Agent Teams Full-Stack Pipeline](agent-teams-full-stack.md) for spawn prompts.

---

## Phase 5: Implementation (5 Agents)

**128K consolidation:** Backend is 1 agent (was 2), frontend is 1 agent (was 3 incl. styling). Each produces complete working code in a single pass.

All 5 agents launch in ONE message with `run_in_background=true`.

### Agent 1: Backend — Complete Implementation
```python
Task(
  subagent_type="backend-system-architect",
  prompt="""IMPLEMENT COMPLETE BACKEND — SINGLE PASS (128K output)

  Feature: $ARGUMENTS
  Architecture: [paste Phase 4 backend spec]

  Generate ALL backend code in ONE response:

  1. API ROUTES (backend/app/api/v1/routes/)
     - All endpoints with full implementation
     - Dependency injection
     - Rate limiting decorators

  2. SCHEMAS (backend/app/schemas/)
     - Pydantic v2 request/response models
     - Field constraints and validators

  3. MODELS (backend/app/db/models/)
     - SQLAlchemy 2.0 async models
     - Relationships, constraints, indexes

  4. SERVICES (backend/app/services/)
     - Business logic with repository pattern
     - Error handling (RFC 9457)

  5. TESTS (backend/tests/)
     - Unit tests for services
     - Integration tests for endpoints
     - Fixtures and factories

  Write REAL code to disk using Write/Edit tools.
  Every file must be complete and runnable.
  Do NOT split across responses — use full 128K output.""",
  run_in_background=true
)
```

### Agent 2: Frontend — Complete Implementation
```python
Task(
  subagent_type="frontend-ui-developer",
  prompt="""IMPLEMENT COMPLETE FRONTEND — SINGLE PASS (128K output)

  Feature: $ARGUMENTS
  Architecture: [paste Phase 4 frontend spec]

  Generate ALL frontend code in ONE response:

  1. COMPONENTS (frontend/src/features/[feature]/components/)
     - React 19 components with TypeScript strict
     - useOptimistic for mutations
     - Skeleton loading states
     - Motion animation presets from @/lib/animations

  2. API LAYER (frontend/src/features/[feature]/api/)
     - Zod schemas for all API responses
     - TanStack Query hooks with prefetching
     - MSW handlers for testing

  3. STATE (frontend/src/features/[feature]/store/)
     - Zustand slices or React 19 state hooks
     - Optimistic update reducers

  4. STYLING
     - Tailwind classes using @theme tokens
     - Responsive breakpoints (mobile-first)
     - Dark mode variants
     - All component states (hover, focus, disabled, loading)

  5. TESTS (frontend/src/features/[feature]/__tests__/)
     - Component tests with MSW
     - Hook tests
     - Zod schema tests

  Write REAL code to disk. Every file must be complete.
  Include styling inline — no separate styling agent needed.
  Do NOT split across responses — use full 128K output.""",
  run_in_background=true
)
```

### Agent 3: AI Integration (if needed)
```python
Task(
  subagent_type="llm-integrator",
  prompt="""IMPLEMENT AI INTEGRATION — SINGLE PASS (128K output)

  Feature: $ARGUMENTS
  Architecture: [paste Phase 4 AI spec]

  Generate ALL AI integration code in ONE response:

  1. Provider setup and configuration
  2. Prompt templates (versioned)
  3. Function calling / tool definitions
  4. Streaming SSE endpoint
  5. Prompt caching configuration
  6. Fallback chain implementation
  7. Langfuse tracing integration
  8. Tests with VCR.py cassettes

  Write REAL code to disk. Skip if AI spec says "No AI needed".""",
  run_in_background=true
)
```

### Agent 4: Test Suite — Complete Coverage
```python
Task(
  subagent_type="test-generator",
  prompt="""GENERATE COMPLETE TEST SUITE — SINGLE PASS (128K output)

  Feature: $ARGUMENTS

  Generate ALL tests in ONE response:

  1. UNIT TESTS
     - Python: pytest with factories (not raw dicts)
     - TypeScript: Vitest with meaningful assertions
     - Cover edge cases: empty input, errors, timeouts, rate limits

  2. INTEGRATION TESTS
     - API endpoint tests with TestClient
     - Database tests with fixtures
     - VCR.py cassettes for external HTTP calls

  3. FIXTURES & FACTORIES
     - conftest.py with shared fixtures
     - Factory classes for test data
     - MSW handlers for frontend API mocking

  4. COVERAGE ANALYSIS
     - Run: poetry run pytest --cov=app --cov-report=term-missing
     - Run: npm test -- --coverage
     - Target: 80% minimum

  Write REAL test files to disk.
  Run tests after writing to verify they pass.
  Do NOT split across responses — use full 128K output.""",
  run_in_background=true
)
```

### Agent 5: Design System (optional — skip if existing design)
```python
Task(
  subagent_type="rapid-ui-designer",
  prompt="""DESIGN SYSTEM SPECIFICATIONS — SINGLE PASS (128K output)

  Feature: $ARGUMENTS

  Produce complete design specs in ONE response:

  1. Color tokens (@theme directive) for new components
  2. Component specifications with all states
  3. Responsive breakpoint strategy
  4. Accessibility contrast ratios
  5. Motion animation preset mapping
  6. Tailwind class definitions for every component variant

  Output: Design specification document.
  Skip if feature uses existing design system without new components.""",
  run_in_background=true
)
```

### Phase 5 — Teams Mode

In Agent Teams mode, the same 4 teammates from Phase 4 continue into implementation. Key difference: backend-architect messages the API contract to frontend-dev as soon as it's defined (not after full implementation), enabling overlapping work. Optionally, each teammate gets a dedicated worktree. See [Team Worktree Setup](team-worktree-setup.md).

---

## Phase 6: Integration & Validation (4 Agents)

### Validation Commands

**Backend:**
```bash
poetry run alembic upgrade head  # dry-run
poetry run ruff check app/
poetry run ty check app/
poetry run pytest tests/unit/ -v --cov=app
```

**Frontend:**
```bash
npm run typecheck
npm run lint
npm run build
npm test -- --coverage
```

### Agent 1: Backend Integration
```python
Task(
  subagent_type="backend-system-architect",
  prompt="""BACKEND INTEGRATION VERIFICATION

  Verify all backend code works together:
  1. Run alembic migrations (dry-run)
  2. Run ruff/mypy type checking
  3. Run full test suite with coverage
  4. Verify API endpoints respond correctly
  5. Fix any integration issues found

  This is verification, not new implementation.""",
  run_in_background=true
)
```

### Agent 2: Frontend Integration
```python
Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND INTEGRATION VERIFICATION

  Verify all frontend code works together:
  1. Run TypeScript type checking (tsc --noEmit)
  2. Run linting (biome/eslint)
  3. Run build (vite build)
  4. Run test suite with coverage
  5. Fix any integration issues found

  This is verification, not new implementation.""",
  run_in_background=true
)
```

### Agent 3: Code Quality Review
```python
Task(
  subagent_type="code-quality-reviewer",
  prompt="""FULL QUALITY REVIEW — SINGLE PASS (128K output)

  Review ALL new code in one comprehensive report:
  1. Run all automated checks (lint, type, test, audit)
  2. Verify React 19 patterns (useOptimistic, Zod, assertNever)
  3. Check security (OWASP, secrets, input validation)
  4. Verify test coverage meets 80% threshold
  5. Check architectural compliance

  Produce structured review with APPROVE/REJECT decision.""",
  run_in_background=true
)
```

### Agent 4: Security Audit
```python
Task(
  subagent_type="security-auditor",
  prompt="""SECURITY AUDIT — SINGLE PASS (128K output)

  Audit ALL new code in one comprehensive report:
  1. Run bandit/semgrep on Python code
  2. Run npm audit on JavaScript dependencies
  3. Run pip-audit on Python dependencies
  4. Grep for secrets (API keys, passwords, tokens)
  5. OWASP Top 10 verification
  6. Input validation coverage

  Produce structured security report with severity ratings.""",
  run_in_background=true
)
```

### Security Checks
- No hardcoded secrets
- SQL injection prevention
- XSS prevention
- Proper input validation
- npm audit / pip-audit

### Phase 6 — Teams Mode

In Agent Teams mode, the code-reviewer has been reviewing continuously during Phase 5. Integration validation is lighter: the lead merges worktrees, runs integration tests, and collects the code-reviewer's final APPROVE/REJECT verdict. After Phase 6, the lead tears down the team (shutdown_request to all teammates + TeamDelete + worktree cleanup).

---

## Phase 7: Scope Creep Detection

Launch `workflow-architect` to compare planned vs actual files/features. Score 0-10:

| Score | Level | Action |
|-------|-------|--------|
| 0-2 | Minimal | Proceed to reflection |
| 3-5 | Moderate | Document and justify unplanned changes |
| 6-8 | Significant | Review with user, potentially split PR |
| 9-10 | Major | Stop and reassess |

See [Scope Creep Detection](scope-creep-detection.md) for the full agent prompt.

---

## Phase 8: E2E Verification

If UI changes were made, verify with agent-browser:

```bash
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot /tmp/feature.png
agent-browser close
```

Skip this phase for backend-only or library implementations.

---

## Phase 9: Documentation

Save implementation decisions to the knowledge graph for future reference:

```python
mcp__memory__create_entities(entities=[{
  "name": "impl-{feature}-{date}",
  "entityType": "ImplementationDecision",
  "observations": ["chose X over Y because...", "pattern: ..."]
}])
```

---

## Phase 10: Post-Implementation Reflection

Launch `workflow-architect` to evaluate:

- What went well / what to improve
- Estimation accuracy (actual vs planned time)
- Reusable patterns to extract
- Technical debt created
- Knowledge gaps discovered

Store lessons in memory for future implementations.

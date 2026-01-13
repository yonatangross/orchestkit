# Agent Phases Reference

## Phase 3: Architecture Design (5 Agents)

### Agent 1: Plan
```python
Task(
  subagent_type="Plan",
  prompt="""ARCHITECTURE PLANNING

  Feature: $ARGUMENTS

  Design comprehensive implementation plan:
  1. COMPONENT BREAKDOWN
     - Frontend components needed
     - Backend services/endpoints
     - Database schema changes
     - AI/ML integrations

  2. DEPENDENCY GRAPH
     - What must be built first?
     - What can be parallelized?
     - Integration points

  3. RISK ASSESSMENT
     - Technical challenges
     - Performance concerns
     - Security considerations

  Output: Detailed implementation roadmap with task dependencies.""",
  run_in_background=true
)
```

### Agent 2: Backend Architect
```python
Task(
  subagent_type="backend-system-architect",
  prompt="""BACKEND ARCHITECTURE

  Feature: $ARGUMENTS
  Standards: FastAPI, Pydantic v2, async/await, SQLAlchemy 2.0

  Design:
  1. API endpoints (REST conventions)
  2. Service layer structure
  3. Database schema/migrations
  4. Error handling patterns
  5. Testing strategy (unit + integration)

  Output: Backend implementation spec with file paths.""",
  run_in_background=true
)
```

### Agent 3: Frontend Developer
```python
Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND ARCHITECTURE

  Feature: $ARGUMENTS
  Standards: React 19, TypeScript strict, Zod, TanStack Query

  Design:
  1. Component hierarchy
  2. State management approach
  3. API integration (hooks)
  4. Form handling with Zod
  5. Error boundaries

  Output: Frontend implementation spec with component tree.""",
  run_in_background=true
)
```

### Agent 4: AI/ML Engineer
```python
Task(
  subagent_type="ai-ml-engineer",
  prompt="""AI/ML INTEGRATION ANALYSIS

  Feature: $ARGUMENTS

  Evaluate AI integration needs:
  1. Does this feature need LLM?
  2. Embedding/RAG requirements?
  3. LangGraph workflow needed?
  4. Caching strategy for LLM calls
  5. Cost optimization

  Output: AI integration spec or "No AI needed" with justification.""",
  run_in_background=true
)
```

### Agent 5: UX Researcher
```python
Task(
  subagent_type="ux-researcher",
  prompt="""UX ANALYSIS

  Feature: $ARGUMENTS

  Analyze user experience:
  1. User journey mapping
  2. Accessibility requirements (WCAG 2.1)
  3. Loading states and feedback
  4. Error messaging
  5. Mobile responsiveness

  Output: UX requirements document.""",
  run_in_background=true
)
```

## Phase 4: Implementation (8 Agents)

### Agent 1-2: Backend Implementation
- API endpoints in `backend/app/api/v1/`
- Pydantic models in `backend/app/models/`
- Service layer in `backend/app/services/`
- Database models in `backend/app/db/models/`
- Repository pattern in `backend/app/db/repositories/`
- Alembic migrations in `backend/alembic/versions/`

### Agent 3-4: Frontend Implementation
- Components in `frontend/src/features/[feature]/`
- API hooks in `frontend/src/features/[feature]/api/`
- Zod schemas for validation
- TanStack Query integration

### Agent 5: AI Integration
- LangGraph workflows
- Prompt templates
- Streaming support
- Caching implementation

### Agent 6: Styling
- TailwindCSS styling
- Responsive breakpoints
- Dark mode support
- Design tokens

### Agent 7: Test Suite
- Unit tests for all new functions
- Integration tests for API endpoints
- Component tests for React
- Target: 80% coverage minimum

### Agent 8: Progress Tracking
- Monitor all implementation agents
- Track task completion
- Identify blockers
- Update TodoWrite

## Phase 5: Integration (4 Agents)

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

### Security Checks
- No hardcoded secrets
- SQL injection prevention
- XSS prevention
- Proper input validation
- npm audit / pip-audit
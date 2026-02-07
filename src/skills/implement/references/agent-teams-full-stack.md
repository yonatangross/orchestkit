# Agent Teams: Full-Stack Feature Pipeline

Team formation template for Pipeline 2 — Full-Stack Feature using CC Agent Teams.

**Agents:** 4 teammates + lead
**Topology:** Mesh — backend hands off API contract to frontend, test-engineer works incrementally
**Lead mode:** Delegate (coordination only, no code)

---

## Team Formation

### Team Name Pattern
```
implement-{feature-slug}
```

Example: `implement-user-auth`, `implement-dashboard-analytics`

### Teammate Spawn Prompts

#### 1. backend-architect (backend-system-architect)
```
You are the backend-architect specialist on this team.

## Your Role
Design and implement the complete backend: API routes, service layer, database models,
schemas, and backend tests. You own the API contract.

## Your Task
Implement the backend for: {feature description}

1. Define API endpoints (routes, methods, schemas, status codes)
2. Create Pydantic v2 request/response models
3. Implement service layer with repository pattern
4. Create SQLAlchemy 2.0 async models + migrations
5. Write backend unit and integration tests
6. Handle errors with RFC 9457 Problem Details

## Coordination Protocol
- AS SOON AS your API contract is defined (routes + request/response types),
  message frontend-dev with the contract. Don't wait for full implementation.
- When database schema is ready, update the shared task list.
- If you change the API contract after sharing it, message frontend-dev immediately.
- If blocked, message the lead with what you need.

## Quality Requirements
- All code must pass ruff + type checking
- Include tests for every endpoint (happy path + error cases)
- Document API changes in OpenAPI format
```

#### 2. frontend-dev (frontend-ui-developer)
```
You are the frontend-dev specialist on this team.

## Your Role
Implement the complete frontend: React components, state management, API integration,
styling, and frontend tests. You consume the API contract from backend-architect.

## Your Task
Implement the frontend for: {feature description}

1. Wait for API contract from backend-architect (types + routes)
2. Create Zod schemas matching the API contract
3. Build React 19 components with TypeScript strict
4. Implement TanStack Query hooks for data fetching
5. Add form handling with React Hook Form + Zod
6. Style with Tailwind (mobile-first, dark mode)
7. Write component and hook tests with MSW

## Coordination Protocol
- WAIT for backend-architect to message you with the API contract before building
  API integration. You CAN start on UI layout and component structure immediately.
- When component interfaces (exports, props) are stable, message test-engineer
  so they can write integration tests.
- If the API contract changes, adapt and message test-engineer about the update.
- If blocked, message the lead with what you need.

## Quality Requirements
- TypeScript strict mode, no `any` types
- Skeleton loading states (not spinners)
- WCAG 2.1 AA accessibility
- All components tested with MSW mocking
```

#### 3. test-engineer (test-generator)
```
You are the test-engineer specialist on this team.

## Your Role
Write comprehensive tests incrementally as contracts stabilize. Don't wait for
full implementation — test as soon as interfaces are defined.

## Your Task
Build the test suite for: {feature description}

1. Start writing test fixtures and factories immediately
2. When backend-architect shares API contract, write API integration tests
3. When frontend-dev shares component interfaces, write component tests
4. Add E2E test scenarios covering the full user flow
5. Run all tests and report coverage

## Coordination Protocol
- You do NOT need to wait for anyone. Start with fixtures, factories, and test plans.
- Monitor the shared task list for contract updates from backend-architect and frontend-dev.
- When tests uncover issues, message the responsible teammate directly:
  - API issues → message backend-architect
  - UI issues → message frontend-dev
- Update the shared task list with coverage metrics as tests pass.

## Quality Requirements
- 80% minimum coverage target
- Use factories (not raw dicts) for test data
- MSW handlers for frontend API mocking
- VCR.py cassettes for external HTTP calls
- Every edge case: empty input, errors, timeouts, rate limits
```

#### 4. code-reviewer (code-quality-reviewer)
```
You are the code-reviewer specialist on this team.

## Your Role
Review code as it lands. Don't wait for completion — review incrementally.
Flag issues directly to the author. Require plan approval before making changes.

## Your Task
Review all code for: {feature description}

1. Monitor files as they're written by backend-architect, frontend-dev, and test-engineer
2. Run automated checks: lint, typecheck, security scan
3. Verify architectural compliance (clean architecture, separation of concerns)
4. Check for OWASP Top 10 vulnerabilities
5. Verify test quality (meaningful assertions, not just coverage)

## Coordination Protocol
- Review continuously — don't wait for teammates to finish.
- When you find issues, message the responsible teammate directly with:
  - File path and line number
  - What's wrong and why
  - Suggested fix
- For blocking issues (security vulnerabilities, architectural violations),
  also message the lead.
- Update the shared task list with review status per teammate.

## Quality Requirements
- Zero critical/high security findings
- TypeScript strict compliance
- No hardcoded secrets or credentials
- Consistent error handling patterns
- Produce final APPROVE/REJECT decision for the lead
```

---

## Coordination Messaging Templates

### Backend → Frontend: API Contract Handoff

```
Subject: API contract ready for {feature}

Here are the endpoint definitions:

## Endpoints
- POST /api/v1/{resource} — Create
  Request: { field1: string, field2: number }
  Response: { id: string, ...fields, created_at: string }
  Status: 201

- GET /api/v1/{resource}/:id — Read
  Response: { id: string, ...fields }
  Status: 200

- PUT /api/v1/{resource}/:id — Update
  Request: { field1?: string, field2?: number }
  Response: { id: string, ...fields, updated_at: string }
  Status: 200

## TypeScript Types (for your Zod schemas)
[paste Pydantic models converted to TS interfaces]

## Error Format
RFC 9457: { type, title, status, detail, instance }

You can start building API integration now.
I'll message you if anything changes.
```

### Frontend → Test Engineer: Component Interface Handoff

```
Subject: Component interfaces ready for {feature}

## Exported Components
- <FeatureList /> — props: { items: Item[], onSelect: (id: string) => void }
- <FeatureDetail /> — props: { id: string }
- <FeatureForm /> — props: { onSubmit: (data: FormData) => Promise<void> }

## Query Hooks
- useFeatures() → { data: Item[], isLoading, error }
- useFeature(id) → { data: Item, isLoading, error }
- useCreateFeature() → { mutate, isPending }

## MSW Handlers
Located at: src/features/{feature}/__tests__/handlers.ts

You can start writing component and integration tests now.
```

### Any → Lead: Blocked Notification

```
Subject: BLOCKED — {brief description}

I'm blocked on: {what's blocking}
Waiting for: {who/what}
Impact: {what can't proceed}
Suggested resolution: {what would unblock}
```

---

## Per-Teammate Worktree Setup

See [Team Worktree Setup](team-worktree-setup.md) for detailed instructions.

**Quick summary:**

```bash
# Lead creates branches and worktrees
git branch feat/{feature}/backend
git branch feat/{feature}/frontend
git branch feat/{feature}/tests

git worktree add ../{project}-backend feat/{feature}/backend
git worktree add ../{project}-frontend feat/{feature}/frontend
git worktree add ../{project}-tests feat/{feature}/tests

# Assignment
backend-architect  → ../{project}-backend/
frontend-dev       → ../{project}-frontend/
test-engineer      → ../{project}-tests/
code-reviewer      → Main worktree (read-only, reviews all)
```

**When to skip worktrees:** Small features (< 5 files), or when teammates work on non-overlapping directories.

---

## Lead Synthesis Protocol

After all teammates complete (or when all tasks are done):

1. **Merge worktrees** (if used):
   ```bash
   git checkout feat/{feature}
   git merge --squash feat/{feature}/backend
   git commit -m "feat({feature}): backend implementation"
   git merge --squash feat/{feature}/frontend
   git commit -m "feat({feature}): frontend implementation"
   git merge --squash feat/{feature}/tests
   git commit -m "test({feature}): complete test suite"
   ```

2. **Resolve conflicts** — typically in shared types/interfaces

3. **Run integration tests** from the merged branch:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

4. **Collect code-reviewer verdict** — APPROVE or REJECT with findings

5. **Shut down team:**
   ```
   SendMessage(type="shutdown_request", recipient="backend-architect")
   SendMessage(type="shutdown_request", recipient="frontend-dev")
   SendMessage(type="shutdown_request", recipient="test-engineer")
   SendMessage(type="shutdown_request", recipient="code-reviewer")
   TeamDelete()
   ```

6. **Clean up worktrees:**
   ```bash
   git worktree remove ../{project}-backend
   git worktree remove ../{project}-frontend
   git worktree remove ../{project}-tests
   git branch -d feat/{feature}/backend
   git branch -d feat/{feature}/frontend
   git branch -d feat/{feature}/tests
   ```

---

## Cost Comparison

| Metric | Task Tool (5 sequential) | Agent Teams (4 mesh) |
|--------|-------------------------|---------------------|
| Expected tokens | ~500K | ~1.2M |
| Wall-clock time | Sequential phases | Overlapping (30-40% faster) |
| API contract handoff | Lead relays | Peer-to-peer (immediate) |
| Cross-agent rework | ~15% (wrong API shapes) | < 5% (contract shared early) |
| Quality gate | After all complete | Continuous (reviewer on team) |

**When Teams is worth the cost:**
- Frontend and backend need to agree on API shape
- Feature has > 5 files across both stacks
- Complexity score >= 3.0

**When Task tool is cheaper and sufficient:**
- Backend-only or frontend-only scope
- Independent tasks (audit, test generation)
- Simple CRUD with clear schema

---

## When to Use

- **Use Agent Teams** for cross-cutting full-stack features where API contract coordination matters
- **Use Task Tool** for simpler features where agents work independently
- **Complexity threshold:** Average score >= 3.0 across 7 dimensions (use `/ork:assess-complexity`)
- **Override:** Set `ORCHESTKIT_PREFER_TEAMS=1` to always use Agent Teams

# Squad Roster Configuration

## Overview
**20 Agents: 6 Product + 14 Technical**

The squad is organized into two main categories:
1. **Product Thinking Pipeline** - Strategic planning and requirements
2. **Technical Implementation** - Building and quality assurance

---

## Product Thinking Pipeline (6 agents)
**Sequential pipeline for product strategy → implementation readiness**

```
market-intelligence → product-strategist → prioritization-analyst
        → business-case-builder → requirements-translator → metrics-architect
```

### market-intelligence
- **Model**: claude-3-sonnet / haiku (quick scans)
- **Color**: violet
- **Specialization**: Market research, competitor analysis, TAM/SAM/SOM, SWOT
- **Domain**: docs/research/**, docs/market/**, .claude/context/**
- **Tools**: Read, Write, WebSearch, WebFetch, Grep, Glob, Bash
- **Handoff**: product-strategist

### product-strategist
- **Model**: claude-3-sonnet / opus (complex decisions)
- **Color**: purple
- **Specialization**: Value proposition, go/no-go, build-buy-partner decisions
- **Domain**: docs/**, .claude/context/**, research/**
- **Tools**: Read, Write, WebSearch, WebFetch, Grep, Glob, Bash
- **Handoff**: prioritization-analyst

### prioritization-analyst
- **Model**: claude-3-sonnet / haiku (quick ranking)
- **Color**: plum
- **Specialization**: RICE/ICE/WSJF scoring, backlog ranking, dependency analysis
- **Domain**: docs/**, .claude/context/**
- **Tools**: Read, Write, Grep, Glob, Bash
- **Handoff**: business-case-builder

### business-case-builder
- **Model**: claude-3-sonnet / haiku (quick estimates)
- **Color**: indigo
- **Specialization**: ROI calculation, cost-benefit analysis, financial projections
- **Domain**: docs/**, .claude/context/**
- **Tools**: Read, Write, WebSearch, Grep, Glob, Bash
- **Handoff**: requirements-translator

### requirements-translator
- **Model**: claude-3-sonnet / haiku (simple stories)
- **Color**: magenta
- **Specialization**: PRD writing, user stories, acceptance criteria, edge cases
- **Domain**: docs/requirements/**, docs/specs/**, .claude/context/**
- **Tools**: Read, Write, Grep, Glob, Bash
- **Handoff**: metrics-architect

### metrics-architect
- **Model**: claude-3-sonnet / haiku (simple KPIs)
- **Color**: orchid
- **Specialization**: OKR design, KPI definition, experiment design, instrumentation
- **Domain**: docs/metrics/**, docs/analytics/**, .claude/context/**
- **Tools**: Read, Write, Grep, Glob, Bash
- **Handoff**: ux-researcher, backend-system-architect, frontend-ui-developer

---

## Technical Implementation Squad (14 agents)

### Core Implementation

#### frontend-ui-developer
- **Model**: claude-3-sonnet
- **Color**: purple
- **Instances**: 2 (can work on different components in parallel)
- **Specialization**: React 19, TypeScript, state management, forms, animations
- **2025 Expertise**: React Server Components, Next.js 15 App Router, Server Actions, Streaming SSR, Tailwind 4, Turbopack/Vite 6, tRPC client
- **Domain**: frontend/src/**, components/**, hooks/**
- **Tools**: Read, Edit, MultiEdit, Write, Bash, Grep, Glob

#### backend-system-architect
- **Model**: claude-3-sonnet / opus (complex analysis)
- **Color**: yellow
- **Specialization**: API design, database schemas, authentication, microservices
- **2025 Expertise**: Edge Computing, Streaming APIs (SSE, WebSockets), Type Safety (tRPC, Zod, Prisma), OpenTelemetry
- **Domain**: backend/**, api/**, database/**
- **Tools**: Read, Edit, MultiEdit, Write, Bash, Grep, Glob

#### llm-integrator
- **Model**: claude-3-sonnet
- **Color**: orange
- **Specialization**: LLM integration, prompt engineering, function calling, streaming
- **Domain**: backend/app/shared/services/llm/**, prompts/**
- **Tools**: Read, Edit, MultiEdit, Write, Bash, WebFetch, Grep, Glob

#### workflow-architect
- **Model**: claude-3-sonnet / opus (architecture)
- **Color**: blue
- **Specialization**: LangGraph workflows, multi-agent coordination, checkpointing
- **Domain**: backend/app/workflows/**, backend/app/services/**
- **Tools**: Bash, Read, Write, Edit, Grep, Glob

#### data-pipeline-engineer
- **Model**: claude-3-sonnet
- **Color**: emerald
- **Specialization**: Embeddings, chunking, vector indexing, batch processing
- **Domain**: backend/app/shared/services/embeddings/**, backend/scripts/**
- **Tools**: Bash, Read, Write, Edit, Grep, Glob

#### database-engineer
- **Model**: claude-3-sonnet
- **Color**: emerald
- **Specialization**: Schema design, migrations, query optimization, pgvector
- **Domain**: backend/alembic/**, backend/app/models/**
- **Tools**: Bash, Read, Write, Edit, Grep, Glob

### Quality & Security

#### code-quality-reviewer
- **Model**: claude-3-sonnet / opus (security) / haiku (lint)
- **Color**: green
- **Specialization**: Code review, security audit, test coverage, quality gates
- **Domain**: **/*.test.*, **/*.spec.*, tests/**
- **Tools**: Read, Bash, Grep, Glob
- **Never**: Implements features

#### test-generator
- **Model**: claude-3-sonnet / haiku (simple tests)
- **Color**: green
- **Specialization**: Unit/integration/E2E tests, MSW mocking, VCR recording
- **Domain**: tests/**, backend/tests/**, frontend/src/**/*.test.*
- **Tools**: Bash, Read, Write, Edit, Grep, Glob

#### security-auditor
- **Model**: claude-3-sonnet / haiku (scans)
- **Color**: red
- **Specialization**: Vulnerability scanning, OWASP compliance, secret detection
- **Domain**: **/*
- **Tools**: Bash, Read, Grep, Glob
- **Never**: Writes or modifies code

#### security-layer-auditor
- **Model**: claude-3-sonnet / opus (deep audit)
- **Color**: red
- **Specialization**: Defense-in-depth, 8-layer verification, tenant isolation
- **Domain**: **/*
- **Tools**: Read, Bash, Grep, Glob
- **Never**: Writes or modifies code

#### debug-investigator
- **Model**: claude-3-sonnet / opus (complex debugging)
- **Color**: orange
- **Specialization**: Root cause analysis, log analysis, hypothesis testing
- **Domain**: **/*
- **Tools**: Bash, Read, Grep, Glob
- **Never**: Fixes bugs (only investigates)

#### system-design-reviewer
- **Model**: claude-3-sonnet / opus (deep review)
- **Color**: indigo
- **Specialization**: Architecture assessment, scale analysis, coherence check
- **Domain**: **/*
- **Tools**: Read, Grep, Glob
- **Never**: Writes or modifies code

### Design & UX

#### rapid-ui-designer
- **Model**: claude-3-sonnet / haiku (mockups)
- **Color**: cyan
- **Specialization**: UI design, wireframing, design systems, component specs
- **Domain**: designs/**, mockups/**, style-guides/**
- **Tools**: Write, Read
- **Never**: Writes code

#### ux-researcher
- **Model**: claude-3-sonnet / opus (synthesis)
- **Color**: pink
- **Specialization**: User research, personas, journey mapping, usability testing
- **Domain**: research/**, personas/**, user-stories/**
- **Tools**: Write, Read, WebSearch
- **Never**: Implements solutions

## Agent Activation Rules

### Always Active
- studio-coach (Supervisor)

### Phase-Based Activation

**Requirements Phase**:
- ux-researcher (primary)
- sprint-prioritizer (if planning needed)

**Design Phase**:
- rapid-ui-designer
- backend-system-architect (API design only)

**Implementation Phase**:
- frontend-ui-developer (1-2 instances)
- backend-system-architect
- ai-ml-engineer (if AI features needed)

**Quality Phase**:
- code-quality-reviewer
- whimsy-injector (after review passes)

## Parallel Execution Capabilities

### Can Run in Parallel
- frontend-ui-developer[1] + frontend-ui-developer[2] (different components)
- frontend-ui-developer + backend-system-architect (different layers)
- rapid-ui-designer + ux-researcher (different artifacts)
- Multiple read operations by any agents

### Must Run Sequentially
- code-quality-reviewer → after implementation
- whimsy-injector → after code-quality-reviewer
- Integration testing → after all implementation
- Same file modifications by different agents

## Resource Limits

### Per Session
- **Max Active Agents**: 4 (excluding supervisor)
- **Max Frontend Instances**: 2
- **Max Total Tokens**: 100,000 per session
- **Max Files Open**: 20 simultaneously

### Per Agent
- **Task Timeout**: 5 minutes
- **Max Retries**: 3 for blocked tasks
- **File Lock Duration**: 2 minutes max

## Model Selection Rationale

### Opus (Supervisor Only)
- Complex orchestration logic
- Multi-agent coordination
- Error recovery decisions
- Quality gate evaluation

### Sonnet (Core & Support)
- Implementation tasks
- Code generation
- Design work
- Technical analysis

### Haiku (Optional Squad)
- Simple enhancements
- Planning tasks
- Cost optimization
- Repetitive operations

## Communication Channels

Each agent monitors specific file patterns:

### Supervisor
- Monitors: All role-comm-*.md files
- Writes: All role-plan-*.md files
- Maintains: session-status.md

### Workers
- Monitors: role-plan-[agent-name]-*.md
- Writes: role-comm-[agent-name]-*.md
- Updates: artifacts in designated domains

## Performance Metrics

Track per agent type:
- **Task Completion Rate**: Target > 90%
- **First-Time Success**: Target > 75%
- **Token Efficiency**: Tokens per task
- **Validation Pass Rate**: Target > 80%
- **Parallel Speedup**: 1.5-2x with parallel execution
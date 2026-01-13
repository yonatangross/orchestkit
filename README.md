<p align="center">
  <img src="Logo.png" alt="SkillForge Logo" width="120" />
</p>

<h1 align="center">SkillForge (skf)</h1>

<p align="center">
  <strong>The Complete AI Development Toolkit for Claude Code</strong>
</p>

<p align="center">
  <a href="https://github.com/yonatangross/skillforge-claude-plugin"><img src="https://img.shields.io/github/stars/yonatangross/skillforge-claude-plugin?style=flat-square" alt="GitHub Stars"></a>
  <a href="https://github.com/yonatangross/skillforge-claude-plugin/releases"><img src="https://img.shields.io/badge/version-4.11.0-green?style=flat-square" alt="Version"></a>
  <img src="https://img.shields.io/badge/CC-≥2.1.6-blue?style=flat-square" alt="Claude Code 2.1.6+">
  <a href="https://github.com/yonatangross/skillforge-claude-plugin/actions/workflows/ci.yml"><img src="https://github.com/yonatangross/skillforge-claude-plugin/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License"></a>
  <a href="https://github.com/anthropics/claude-plugins-official/pull/86"><img src="https://img.shields.io/badge/anthropic--official-pending-yellow?style=flat-square" alt="Anthropic Official"></a>
  <a href="https://github.com/ananddtyagi/cc-marketplace/pull/24"><img src="https://img.shields.io/badge/cc--marketplace-pending-yellow?style=flat-square" alt="CC Marketplace"></a>
</p>

<p align="center">
  92 skills | 10 categories | 20 agents | 90 hooks (24 registered) | 4 tiers
</p>

---

> **Transform Claude Code into a full-stack AI development powerhouse.** From RAG pipelines to React 19 patterns, from database schemas to security audits - everything you need to build production-grade applications with AI assistance.


---

## About SkillForge

SkillForge transforms Claude Code into a comprehensive AI development platform by providing:

- **92 Skills**: Reusable knowledge modules organized in 10 categories that load on-demand
- **20 Agents**: Specialized AI personas with domain expertise and pre-loaded skills  
- **90 Hooks**: Lifecycle automation for safety, auditing, and quality gates (24 registered via dispatchers)
- **Progressive Loading**: Token-efficient system that loads only what's needed (~300-800 tokens vs 5000+)

### Why SkillForge?

| Without SkillForge | With SkillForge |
|-------------------|-----------------|
| Manual context management | Automatic progressive loading |
| Generic AI responses | Domain-expert agents (FastAPI, React 19, LangGraph) |
| No guardrails | 90 hooks for safety, auditing, quality gates |
| Single-threaded | Parallel agent execution (fan-out/fan-in) |
| Context overload | Token-efficient (~70% savings) |

## What's New in v4.11.0 (Hook Consolidation)

- **Hook Consolidation**: Reduced from 44 to 23 registered hooks using dispatcher pattern (48% reduction)
- **MCP Updates**: Added mem0 (cloud semantic memory) alongside Anthropic memory
- **Fixed Paths**: All hook references now correctly point to existing files
- **New Dispatchers**: agent-dispatcher, skill-dispatcher, session-end-dispatcher
- **Cleaned Dead Code**: Removed 9 unused hook files

### Previous (v4.10.0 - CC 2.1.6 Integration)

```
skills/
├── ai-llm/.claude/skills/       # 19 skills: RAG, embeddings, agents, caching
├── langgraph/.claude/skills/    # 7 skills: State, routing, parallel, checkpoints
├── backend/.claude/skills/      # 15 skills: FastAPI, architecture, databases
├── frontend/.claude/skills/     # 6 skills: React 19, design systems
├── testing/.claude/skills/      # 9 skills: Unit, integration, E2E, mocking
├── security/.claude/skills/     # 5 skills: OWASP, auth, validation
├── devops/.claude/skills/       # 4 skills: CI/CD, observability
├── workflows/.claude/skills/    # 13 skills: Git, PR, implementation
├── quality/.claude/skills/      # 8 skills: Quality gates, reviews
└── context/.claude/skills/      # 6 skills: Compression, brainstorming
```

## Quick Start

### From Marketplace (Pending Approval)

> **Status:** Awaiting approval at [Anthropic Official](https://github.com/anthropics/claude-plugins-official/pull/86) and [CC Marketplace](https://github.com/ananddtyagi/cc-marketplace/pull/24). Once merged, these commands will work:

```bash
# Step 1: Add the marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin

# Step 2: Install
/plugin install skf
```

### From GitHub (Manual)

```bash
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge
```

### Project-Scoped (Copy to Project)

```bash
# Copy entire plugin
cp -r skillforge-claude-plugin/.claude your-project/.claude

# Or copy specific skill categories (CC 2.1.6 auto-discovers them!)
cp -r skillforge-claude-plugin/skills/ai-llm your-project/
```

### Configuration

#### Interactive Wizard (Recommended)

```bash
/skf:configure
```

The wizard guides you through:

1. **Preset Selection**: Choose your starting point
   - `complete` - All 92 skills, 20 agents, full hooks (default)
   - `standard` - All skills, no auto-agents, full hooks
   - `lite` - Essential skills only, minimal context
   - `hooks-only` - Safety guardrails only

2. **Skill Categories**: Toggle categories on/off based on your stack
3. **Agent Configuration**: Enable/disable specific agents
4. **Hook Settings**: Customize safety and quality hooks
5. **MCP Setup**: Enable optional MCP integrations

#### Configuration File

Settings stored in `~/.claude/plugins/skillforge/config.json`:

```json
{
  "preset": "complete",
  "skills": {
    "ai-llm": true,
    "langgraph": true,
    "backend": true,
    "frontend": true,
    "testing": true,
    "security": true,
    "devops": true,
    "workflows": true,
    "quality": true,
    "context": true
  },
  "agents": { "enabled": true, "allowed": ["*"] },
  "hooks": { "git_branch_protection": true, "file_guard": true }
}
```

#### Per-Project Overrides

Create `.claude/skillforge.json` in your project root:

```json
{
  "skills": { "langgraph": false },
  "agents": { "allowed": ["backend-system-architect", "database-engineer"] }
}
```


---

## Claude Code Integration (CC 2.1.6+)

SkillForge leverages Claude Code 2.1.6+ features for optimal performance.

### Spawning Agents

Agents are spawned using the `Task` tool with `subagent_type`:

```python
# Spawn a single agent
Task(
    subagent_type="skf:backend-system-architect",
    prompt="Design the user authentication API"
)
```

### Parallel Execution (Fan-Out)

Launch multiple agents simultaneously by making multiple tool calls in a single message:

```python
# These run concurrently - 3x faster than sequential
Task(subagent_type="skf:frontend-ui-developer", prompt="Build dashboard UI")
Task(subagent_type="skf:backend-system-architect", prompt="Build dashboard API")  
Task(subagent_type="skf:database-engineer", prompt="Design dashboard schema")
```

### Context Modes

Control how agents share context via frontmatter:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `fork` | Isolated context (default) | Complex multi-step operations |
| `inherit` | Share parent context | Quick utilities, saves tokens |
| `none` | No context management | Stateless coordination |

```yaml
---
name: my-agent
context: fork  # isolated context
---
```

### Model Selection

Agents specify preferred models for cost/performance tradeoffs:

| Model | Best For | Cost |
|-------|----------|------|
| `opus` | Complex reasoning, architecture design | $$$ |
| `sonnet` | Balanced tasks, implementation (default) | $$ |
| `haiku` | Fast routing, simple validation | $ |

```yaml
---
name: security-auditor
model: haiku  # Fast scanning, low cost
---
```

### Skills Auto-Injection

CC 2.1.6 automatically injects skills listed in agent frontmatter:

```yaml
---
name: backend-system-architect
skills:
  - api-design-framework
  - clean-architecture
  - fastapi-advanced
---
```

When this agent spawns, all three skills are automatically available - no manual loading required.

---

## Installation Tiers

| Tier | Skills | Agents | Commands | Hooks | Use Case |
|------|--------|--------|----------|-------|----------|
| **complete** | 91 | 20 | 12 | 93 | Full AI-assisted development (default) |
| standard | 91 | 0 | 12 | 93 | All skills, spawn agents manually |
| lite | 10 | 0 | 5 | 93 | Essential skills, minimal context |
| hooks-only | 0 | 0 | 0 | 93 | Safety guardrails only |

After installation, skills load automatically based on task context.

---

## Skill Categories

### AI & LLM (`ai-llm/` - 19 skills)

**Focus:** Building AI-powered applications with RAG pipelines, embeddings, multi-agent orchestration, and cost optimization through caching.

| Skill | Description |
|-------|-------------|
| `agent-loops` | Agentic workflows with ReAct, tool use, and autonomous loops |
| `rag-retrieval` | RAG pipelines, chunking strategies, retrieval patterns |
| `embeddings` | Embedding models, vector operations, similarity search |
| `function-calling` | LLM function/tool calling patterns for OpenAI, Anthropic, Ollama |
| `ollama-local` | Local LLM inference with Ollama, model selection, optimization |
| `multi-agent-orchestration` | Coordinating multiple AI agents for complex tasks |
| `prompt-caching` | Anthropic/OpenAI prompt caching for cost reduction |
| `semantic-caching` | Semantic similarity caching with Redis/vector stores |
| `cache-cost-tracking` | LLM cost tracking and optimization |
| `llm-streaming` | Streaming responses, SSE, token-by-token output |
| `llm-evaluation` | Evaluation frameworks, benchmarks, quality metrics |
| `llm-testing` | Testing LLM applications, mocking, deterministic tests |
| `llm-safety-patterns` | LLM security, prompt injection prevention, context separation |
| `langfuse-observability` | LLM tracing, evaluation, prompt management, and cost tracking |
| `hyde-retrieval` | HyDE (Hypothetical Document Embeddings) for vocabulary mismatch |
| `query-decomposition` | Multi-concept query handling with parallel retrieval |
| `reranking-patterns` | Cross-encoder and LLM-based reranking for search precision |
| `contextual-retrieval` | Anthropic's context-prepending technique for improved RAG |
| `mem0-memory` | Cross-session memory with Mem0 MCP integration |

### LangGraph (`langgraph/` - 7 skills)

**Focus:** State machines, conditional routing, parallel execution, checkpointing, and human-in-the-loop workflows using LangGraph.

| Skill | Description |
|-------|-------------|
| `langgraph-state` | State management and persistence in LangGraph |
| `langgraph-routing` | Semantic routing and conditional branching |
| `langgraph-parallel` | Fan-out/fan-in parallel agent execution |
| `langgraph-checkpoints` | Checkpointing and recovery for long-running workflows |
| `langgraph-human-in-loop` | Human approval and intervention patterns |
| `langgraph-supervisor` | Supervisor-worker patterns with LangGraph |
| `langgraph-functional` | @entrypoint/@task decorator API for modern workflows |

### Backend (`backend/` - 15 skills)

**Focus:** FastAPI patterns, clean architecture, databases, API design, caching strategies, and resilience patterns.

| Skill | Description |
|-------|-------------|
| `api-design-framework` | REST patterns, versioning, error handling, OpenAPI templates |
| `api-versioning` | URL path, header, content negotiation versioning strategies |
| `background-jobs` | Celery, ARQ, Redis task queues for async processing |
| `caching-strategies` | Write-through, cache-aside, Redis invalidation patterns |
| `clean-architecture` | SOLID principles, hexagonal architecture, DDD tactical patterns |
| `database-schema-designer` | Normalization, indexing strategies, migration patterns |
| `error-handling-rfc9457` | RFC 9457 Problem Details for structured API errors |
| `fastapi-advanced` | Lifespan, dependencies, middleware, settings (2026 patterns) |
| `rate-limiting` | Token bucket, sliding window, Redis distributed limiting |
| `resilience-patterns` | Circuit breakers, bulkheads, retry logic, fault tolerance |
| `streaming-api-patterns` | SSE, WebSockets, ReadableStream APIs, backpressure handling |
| `type-safety-validation` | Zod + tRPC + Prisma for end-to-end type safety |
| `mcp-server-building` | Building MCP servers for Claude extensibility |
| `pgvector-search` | Hybrid search with PGVector + BM25 |
| `backend-architecture-enforcer` | Architecture enforcement and validation |

### Frontend (`frontend/` - 6 skills)

**Focus:** React 19, Server Components, Next.js App Router, animations, i18n, and performance optimization.

| Skill | Description |
|-------|-------------|
| `react-server-components-framework` | Next.js 16 App Router, RSC patterns, Server Actions, React 19 |
| `design-system-starter` | Design tokens, component architecture, accessibility guidelines |
| `motion-animation-patterns` | Motion (Framer Motion) animations, page transitions, stagger effects |
| `i18n-date-patterns` | Internationalization, date formatting, RTL support |
| `performance-optimization` | React 19 concurrent features, bundle analysis, Core Web Vitals |
| `edge-computing-patterns` | Cloudflare Workers, Vercel Edge, Deno Deploy patterns |

### Testing (`testing/` - 9 skills)

**Focus:** Unit, integration, E2E testing with Playwright, API mocking with MSW, and HTTP recording with VCR.

| Skill | Description |
|-------|-------------|
| `unit-testing` | Unit test patterns, mocking, coverage strategies |
| `integration-testing` | Integration test design, test isolation, fixtures |
| `e2e-testing` | End-to-end testing strategies and patterns |
| `performance-testing` | Load testing, benchmarking, performance profiling |
| `webapp-testing` | Playwright testing with autonomous test agents |
| `msw-mocking` | Mock Service Worker for API mocking |
| `vcr-http-recording` | HTTP recording/playback for deterministic tests |
| `test-data-management` | Test fixtures, factories, data generation |
| `test-standards-enforcer` | Testing standards enforcement |

### Security (`security/` - 5 skills)

**Focus:** OWASP Top 10, authentication patterns, input validation, security scanning, and defense-in-depth architecture.

| Skill | Description |
|-------|-------------|
| `owasp-top-10` | OWASP Top 10 mitigations with code examples |
| `auth-patterns` | Authentication/authorization patterns, JWT, OAuth, sessions |
| `security-scanning` | Security scanning, SAST, dependency audits |
| `input-validation` | Input validation, sanitization, injection prevention |
| `defense-in-depth` | 8-layer security architecture for AI systems |

### DevOps (`devops/` - 4 skills)

**Focus:** CI/CD pipelines, observability, monitoring, GitHub CLI workflows, and deployment automation.

| Skill | Description |
|-------|-------------|
| `devops-deployment` | CI/CD pipelines, Docker, Kubernetes, Terraform patterns |
| `observability-monitoring` | Structured logging, metrics, distributed tracing, alerting |
| `github-cli` | GitHub CLI workflows, PR automation, issue management |
| `run-tests` | Test execution and reporting |

### Workflows (`workflows/` - 13 skills)

**Focus:** Git operations, PR workflows, implementation patterns, codebase exploration, and development automation.

| Skill | Description |
|-------|-------------|
| `commit` | Smart commit with validation and auto-generated message |
| `create-pr` | Create PR with validation and auto-generated description |
| `review-pr` | PR review with parallel code quality agents |
| `implement` | Full-power feature implementation with parallel subagents |
| `explore` | Deep codebase exploration with parallel agents |
| `verify` | Comprehensive feature verification with quality gates |
| `fix-issue` | Fix GitHub issue with parallel analysis |
| `configure` | Interactive configuration wizard |
| `doctor` | Health diagnostics command |
| `errors` | Error pattern analysis and troubleshooting |
| `add-golden` | Curate and add documents to golden dataset |
| `browser-content-capture` | Web scraping, content extraction |

### Quality (`quality/` - 8 skills)

**Focus:** Quality gates, code review, golden dataset management, architecture decisions, and evidence verification.

| Skill | Description |
|-------|-------------|
| `quality-gates` | Automated quality enforcement, CI integration |
| `evidence-verification` | Verification evidence collection and validation |
| `code-review-playbook` | Structured review processes, conventional comments |
| `project-structure-enforcer` | Project structure enforcement |
| `golden-dataset-management` | Managing and versioning golden datasets |
| `golden-dataset-validation` | Validating dataset quality and consistency |
| `golden-dataset-curation` | Curating high-quality datasets for AI/ML |
| `architecture-decision-record` | ADR templates, decision documentation |

### Context (`context/` - 6 skills)

**Focus:** Context management, compression, brainstorming, system design interrogation, and multi-worktree coordination.

| Skill | Description |
|-------|-------------|
| `context-compression` | Anchored summarization, probe-based validation |
| `context-engineering` | Attention-aware positioning, context budget management |
| `brainstorming` | Socratic questioning, alternative exploration, MVP scoping |
| `ascii-visualizer` | Beautiful ASCII art for architectures and workflows |
| `system-design-interrogation` | Structured design questions |
| `worktree-coordination` | Multi-worktree coordination |

---

## Commands Reference

Slash commands for common workflows:

| Command | Description | Example |
|---------|-------------|---------|
| `/skf:configure` | Interactive configuration wizard | `/skf:configure` |
| `/commit` | Smart commit with validation and auto-generated message | `/commit` |
| `/explore` | Deep codebase exploration with parallel agents | `/explore auth system` |
| `/implement` | Full-power feature implementation with 17 parallel subagents | `/implement user dashboard` |
| `/verify` | Comprehensive feature verification with quality gates | `/verify login flow` |
| `/review-pr` | PR review with parallel code quality agents | `/review-pr 123` |
| `/create-pr` | Create PR with validation and auto-generated description | `/create-pr` |
| `/run-tests` | Comprehensive test execution with parallel analysis | `/run-tests backend` |
| `/fix-issue` | Fix GitHub issue with parallel analysis | `/fix-issue 456` |
| `/add-golden` | Curate and add documents to golden dataset | `/add-golden doc.md` |
| `/brainstorm` | Multi-perspective idea exploration | `/brainstorm caching strategy` |
| `/errors` | Analyze error patterns and get fix suggestions | `/errors` |

---

## Agents Reference

Specialized agents for domain-specific tasks:

### Product Thinking Pipeline (6 agents)

| Agent | Model | Specialization |
|-------|-------|----------------|
| `market-intelligence` | Sonnet | Market research, competitor analysis, TAM/SAM/SOM, SWOT |
| `product-strategist` | Sonnet/Opus | Value proposition, go/no-go decisions, build-buy-partner |
| `prioritization-analyst` | Sonnet | RICE/ICE scoring, backlog ranking, dependency analysis |
| `business-case-builder` | Sonnet | ROI calculations, cost-benefit analysis, financial projections |
| `requirements-translator` | Sonnet | PRD writing, user stories, acceptance criteria |
| `metrics-architect` | Sonnet | OKR design, KPI definition, experiment design |

### Technical Implementation (14 agents)

| Agent | Model | Specialization |
|-------|-------|----------------|
| `backend-system-architect` | Sonnet | FastAPI, SQLAlchemy, async patterns, service design |
| `frontend-ui-developer` | Sonnet | React 19, TypeScript strict, TanStack Query, Zod |
| `llm-integrator` | Sonnet | OpenAI/Anthropic/Ollama APIs, streaming, function calling |
| `workflow-architect` | Sonnet | LangGraph workflows, multi-agent coordination |
| `database-engineer` | Sonnet | Schema design, migrations, query optimization |
| `security-auditor` | Haiku | OWASP scanning, dependency audit, secrets detection |
| `code-quality-reviewer` | Sonnet | Code review, test coverage, quality gates |
| `test-generator` | Sonnet | Unit/integration/E2E test creation |
| `debug-investigator` | Sonnet | Root cause analysis, stack trace interpretation |
| `rapid-ui-designer` | Haiku | TailwindCSS, responsive design, accessibility |
| `ux-researcher` | Haiku | User journey mapping, accessibility, mobile UX |
| `data-pipeline-engineer` | Sonnet | Embeddings, ETL, vector databases |
| `system-design-reviewer` | Sonnet | Architecture validation, scalability review |
| `security-layer-auditor` | Haiku | Defense-in-depth validation |

---

## Progressive Loading

SkillForge uses a **token-efficient progressive loading** system via `capabilities.json` files:

```
+----------------------+     +-------------------+     +------------------+
| Tier 1: Discovery    | --> | Tier 2: Overview  | --> | Tier 3: Specific |
| (~100 tokens)        |     | (~500 tokens)     |     | (~200 tokens)    |
| capabilities.json    |     | SKILL.md          |     | references/*.md  |
+----------------------+     +-------------------+     +------------------+
                                                               |
                                                               v
                                                      +------------------+
                                                      | Tier 4: Generate |
                                                      | (~300 tokens)    |
                                                      | templates/*      |
                                                      +------------------+
```

### How It Works

1. **Tier 1 - Discovery** (~100 tokens): Claude reads `capabilities.json` to determine skill relevance via keywords and triggers
2. **Tier 2 - Overview** (~500 tokens): If relevant, loads `SKILL.md` for patterns and best practices
3. **Tier 3 - Specific** (~200 tokens): Loads only the specific reference sections needed
4. **Tier 4 - Generate** (~300 tokens): Loads templates when ready to generate code

**Result:** Instead of loading 5000+ tokens upfront, Claude loads only what's needed - typically 300-800 tokens per task.

### Example: capabilities.json

```json
{
  "name": "llm-caching-patterns",
  "version": "1.3.0",
  "description": "Multi-level caching for 70-95% cost reduction",

  "capabilities": {
    "semantic-cache": {
      "keywords": ["semantic cache", "redis", "vector similarity"],
      "solves": ["How do I implement semantic caching?"],
      "reference_file": "SKILL.md#redis-semantic-cache",
      "token_cost": 200
    }
  },

  "triggers": {
    "high_confidence": ["llm.*caching", "semantic.*cache"],
    "medium_confidence": ["reduce.*cost", "cache.*llm"]
  },

  "progressive_loading": {
    "tier_1_discovery": { "file": "capabilities.json", "tokens": 110 },
    "tier_2_overview": { "file": "SKILL.md", "tokens": 537 }
  }
}
```

---

## MCP Integrations (Optional)

SkillForge commands work **without MCPs**, but these optional integrations enhance functionality:

| MCP Server | Enhances | Purpose |
|------------|----------|---------|
| `context7` | /implement, /verify, /review-pr | Up-to-date library documentation |
| `sequential-thinking` | /brainstorm, /implement | Structured reasoning for complex problems |
| `mem0` | Session continuity, decisions | Cloud semantic memory (AI-powered recall) |
| `memory` | Quick notes, preferences | Local file-based key-value storage |
| `playwright` | /verify, browser-content-capture | Browser automation for E2E testing |

### Installing MCPs

MCPs are **opt-in**. Configure them via the wizard:

```bash
/skf:configure
```

Or manually create `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

### Example: Using Context7 for Current Docs

```python
# If context7 MCP is installed, skills can query for latest patterns
mcp__context7__query-docs(
  libraryId="/langchain-ai/langgraph",
  query="How to implement supervisor-worker pattern"
)
```

---

## Security

### Hook Auditing

All 90 hooks (24 registered via dispatcher pattern) have been security-audited and follow these standards:

- **Strict mode enabled**: `set -euo pipefail` in all bash hooks
- **Input validation**: All hook inputs are validated via JSON schema
- **No arbitrary execution**: Hooks never execute user-provided code
- **Read-only by default**: Most hooks are observational, not mutational
- **Line continuation protection**: CC 2.1.6 security fix integrated

### Protected Hooks

| Hook | Purpose | Security Level |
|------|---------|----------------|
| `git-branch-protection.sh` | Blocks commits to dev/main | **Critical** |
| `file-guard.sh` | Prevents writes to protected paths | **Critical** |
| `auto-approve-safe-bash.sh` | Whitelists known-safe commands | Medium |
| `memory-validator.sh` | Validates MCP memory operations | Medium |
| `audit-logger.sh` | Records all tool invocations | Low |

---

## Project Structure (CC 2.1.6)

```
.claude/
+-- agents/                    # 20 specialized agents
+-- commands/                  # 12 slash commands
+-- hooks/                     # 90 hooks (24 registered)
+-- schemas/                   # JSON schemas
+-- scripts/                   # Utility scripts

skills/                        # 92 skills in 10 categories
+-- ai-llm/
|   +-- .claude/skills/
|       +-- rag-retrieval/
|       |   +-- capabilities.json
|       |   +-- SKILL.md
|       |   +-- references/
|       |   +-- templates/
|       +-- embeddings/
|       +-- ...
+-- langgraph/
|   +-- .claude/skills/
|       +-- langgraph-state/
|       +-- ...
+-- backend/
+-- frontend/
+-- testing/
+-- security/
+-- devops/
+-- workflows/
+-- quality/
+-- context/
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-skill`
3. Add your skill with `capabilities.json` for progressive loading
4. Write tests for any code templates
5. Submit a PR with description of the skill's purpose

### Skill Development

```bash
# Create a new skill (CC 2.1.6 nested structure)
mkdir -p skills/backend/.claude/skills/my-skill
touch skills/backend/.claude/skills/my-skill/{capabilities.json,SKILL.md}

# Validate capabilities.json schema
npx ajv validate -s .claude/schemas/skill-capabilities.schema.json \
                 -d skills/backend/.claude/skills/my-skill/capabilities.json
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Credits

**Created by:** [Yonatan Gross](https://github.com/yonatangross)

**Inspired by:**
- The Claude Code community
- LangChain and LangGraph projects
- React and Next.js ecosystems

**Special Thanks:**
- Anthropic for Claude and Claude Code
- All contributors and early adopters

---

<p align="center">
  <sub>Built with love for the Claude Code community</sub>
</p>

<p align="center">
  <a href="https://skillforge.dev">Website</a> |
  <a href="https://github.com/yonatangross/skillforge-claude-plugin">GitHub</a> |
  <a href="https://discord.gg/skillforge">Discord</a> |
  <a href="https://twitter.com/skillforgedev">Twitter</a>
</p>

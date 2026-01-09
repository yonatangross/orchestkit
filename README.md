<p align="center">
  <img src="Logo.png" alt="SkillForge Logo" width="120" />
</p>

<h1 align="center">@skillforge/complete</h1>

<p align="center">
  <strong>The Complete AI Development Toolkit for Claude Code</strong>
</p>

<p align="center">
  <a href="https://github.com/yonatangross/skillforge-claude-plugin"><img src="https://img.shields.io/github/stars/yonatangross/skillforge-claude-plugin?style=flat-square" alt="GitHub Stars"></a>
  <a href="https://github.com/yonatangross/skillforge-claude-plugin/releases"><img src="https://img.shields.io/badge/version-4.6.3-green?style=flat-square" alt="Version"></a>
  <a href="https://github.com/yonatangross/skillforge-claude-plugin/actions/workflows/ci.yml"><img src="https://github.com/yonatangross/skillforge-claude-plugin/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License"></a>
  <a href="https://github.com/anthropics/claude-plugins-official/pull/86"><img src="https://img.shields.io/badge/anthropic--official-pending-yellow?style=flat-square" alt="Anthropic Official"></a>
  <a href="https://github.com/ananddtyagi/cc-marketplace/pull/24"><img src="https://img.shields.io/badge/cc--marketplace-pending-yellow?style=flat-square" alt="CC Marketplace"></a>
</p>

<p align="center">
  78 skills | 12 commands | 20 agents | 92 hooks | 4 tiers
</p>

---

> **Transform Claude Code into a full-stack AI development powerhouse.** From RAG pipelines to React 19 patterns, from database schemas to security audits - everything you need to build production-grade applications with AI assistance.

## Quick Start

### From Marketplace (Pending Approval)

> **Status:** Awaiting approval at [Anthropic Official](https://github.com/anthropics/claude-plugins-official/pull/86) and [CC Marketplace](https://github.com/ananddtyagi/cc-marketplace/pull/24). Once merged, these commands will work:

```bash
# Step 1: Add the marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin

# Step 2: Install (default = complete with everything)
/plugin install @skillforge                    # Everything (78 skills, 20 agents)

# Or choose a lighter tier:
/plugin install @skillforge/standard           # All skills, no agents
/plugin install @skillforge/lite               # 10 essential skills only
/plugin install @skillforge/hooks-only         # Just safety hooks
```

### From GitHub (Manual)

```bash
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge
```

### Project-Scoped (Copy to Project)

```bash
cp -r skillforge-claude-plugin/.claude your-project/.claude
```

### Configuration

Customize your installation anytime:

```bash
/skillforge:configure
```

Interactive wizard to:
- Choose preset (complete/standard/lite/hooks-only)
- Toggle skill categories
- Enable/disable agents
- Configure hooks

Config: `~/.claude/plugins/skillforge/config.json`

---

## Installation Tiers

| Tier | Skills | Agents | Commands | Hooks | Use Case |
|------|--------|--------|----------|-------|----------|
| **complete** | 78 | 20 | 12 | 90 | Full AI-assisted development (default) |
| standard | 78 | 0 | 12 | 90 | All skills, spawn agents manually |
| lite | 10 | 0 | 5 | 90 | Essential skills, minimal context |
| hooks-only | 0 | 0 | 0 | 90 | Safety guardrails only |

After installation, skills load automatically based on task context.

---

## Features Overview

### AI & LLM Development

| Skill | Description |
|-------|-------------|
| `agent-loops` | Agentic workflows with ReAct, tool use, and autonomous loops |
| `rag-retrieval` | RAG pipelines, chunking strategies, retrieval patterns |
| `embeddings` | Embedding models, vector operations, similarity search |
| `function-calling` | LLM function/tool calling patterns for OpenAI, Anthropic, Ollama |
| `ollama-local` | Local LLM inference with Ollama, model selection, optimization |
| `multi-agent-orchestration` | Coordinating multiple AI agents for complex tasks |
| `langgraph-supervisor` | Supervisor-worker patterns with LangGraph |
| `langgraph-routing` | Semantic routing and conditional branching |
| `langgraph-parallel` | Fan-out/fan-in parallel agent execution |
| `langgraph-state` | State management and persistence in LangGraph |
| `langgraph-checkpoints` | Checkpointing and recovery for long-running workflows |
| `langgraph-human-in-loop` | Human approval and intervention patterns |
| `prompt-caching` | Anthropic/OpenAI prompt caching for cost reduction |
| `semantic-caching` | Semantic similarity caching with Redis/vector stores |
| `cache-cost-tracking` | LLM cost tracking and optimization |
| `llm-streaming` | Streaming responses, SSE, token-by-token output |
| `llm-evaluation` | Evaluation frameworks, benchmarks, quality metrics |
| `llm-testing` | Testing LLM applications, mocking, deterministic tests |
| `langfuse-observability` | LLM tracing, evaluation, prompt management, and cost tracking |
| `pgvector-search` | Hybrid search with PGVector + BM25 using Reciprocal Rank Fusion |
| `hyde-retrieval` | HyDE (Hypothetical Document Embeddings) for vocabulary mismatch resolution |
| `query-decomposition` | Multi-concept query handling with parallel retrieval and fusion |
| `reranking-patterns` | Cross-encoder and LLM-based reranking for search precision |
| `contextual-retrieval` | Anthropic's context-prepending technique for improved RAG |
| `langgraph-functional` | @entrypoint/@task decorator API for modern LangGraph workflows |
| `context-compression` | Anchored summarization, probe-based validation, token optimization |
| `context-engineering` | Attention-aware positioning, context budget management, progressive loading |
| `llm-safety-patterns` | LLM security, prompt injection prevention, context separation |

### Backend Development

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
| `mcp-server-building` | Building MCP (Model Context Protocol) servers for Claude extensibility |

### Frontend Development

| Skill | Description |
|-------|-------------|
| `react-server-components-framework` | Next.js 15 App Router, RSC patterns, Server Actions, React 19 |
| `design-system-starter` | Design tokens, component architecture, accessibility guidelines |
| `motion-animation-patterns` | Motion (Framer Motion) animations, page transitions, stagger effects |
| `i18n-date-patterns` | Internationalization, date formatting, RTL support, useFormatting hook |
| `performance-optimization` | React 19 concurrent features, bundle analysis, Core Web Vitals |
| `edge-computing-patterns` | Cloudflare Workers, Vercel Edge, Deno Deploy patterns |

### Quality & Testing

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
| `code-review-playbook` | Structured review processes, conventional comments |
| `quality-gates` | Automated quality enforcement, CI integration |
| `evidence-verification` | Verification evidence collection and validation |
| `golden-dataset-curation` | Curating high-quality datasets for AI/ML |
| `golden-dataset-validation` | Validating dataset quality and consistency |
| `golden-dataset-management` | Managing and versioning golden datasets |

### DevOps & Security

| Skill | Description |
|-------|-------------|
| `devops-deployment` | CI/CD pipelines, Docker, Kubernetes, Terraform patterns |
| `observability-monitoring` | Structured logging, metrics, distributed tracing, alerting |
| `owasp-top-10` | OWASP Top 10 mitigations with code examples |
| `auth-patterns` | Authentication/authorization patterns, JWT, OAuth, sessions |
| `security-scanning` | Security scanning, SAST, dependency audits |
| `input-validation` | Input validation, sanitization, injection prevention |
| `defense-in-depth` | 8-layer security architecture for AI systems, multi-tenant isolation |

### Process & Planning

| Skill | Description |
|-------|-------------|
| `brainstorming` | Socratic questioning, alternative exploration, MVP scoping |
| `architecture-decision-record` | ADR templates, decision documentation |
| `ascii-visualizer` | Beautiful ASCII art for architectures and workflows |
| `github-cli` | GitHub CLI workflows, PR automation, issue management |
| `browser-content-capture` | Web scraping, content extraction, documentation capture |
| `system-design-interrogation` | Structured design questions for scale, security, data, UX, coherence |

---

## Commands Reference

Slash commands for common workflows:

| Command | Description | Example |
|---------|-------------|---------|
| `/skillforge:configure` | Interactive configuration wizard | `/skillforge:configure` |
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

## MCP Integrations

SkillForge skills integrate with these MCP servers:

| MCP Server | Used By | Purpose |
|------------|---------|---------|
| `context7` | All skills | Up-to-date library documentation lookup |
| `langfuse` | AI skills | Prompt management, tracing, cost tracking |
| `playwright` | Testing skills | Browser automation, E2E testing |
| `memory` | All commands | Cross-session decision persistence |
| `sequential-thinking` | Planning | Multi-step reasoning for complex problems |
| `pg-aiguide` | Database skills | PostgreSQL and TimescaleDB guidance |

### Example: Using Context7 for Current Docs

```python
# Skills automatically query Context7 for latest patterns
mcp__context7__query-docs(
  libraryId="/langchain-ai/langgraph",
  query="How to implement supervisor-worker pattern"
)
```

---

## Security

### Hook Auditing

All 92 hooks have been security-audited and follow these standards:

- **Strict mode enabled**: `set -euo pipefail` in all bash hooks
- **Input validation**: All hook inputs are validated via JSON schema
- **No arbitrary execution**: Hooks never execute user-provided code
- **Read-only by default**: Most hooks are observational, not mutational

### Protected Hooks

| Hook | Purpose | Security Level |
|------|---------|----------------|
| `git-branch-protection.sh` | Blocks commits to dev/main | **Critical** |
| `file-guard.sh` | Prevents writes to protected paths | **Critical** |
| `auto-approve-safe-bash.sh` | Whitelists known-safe commands | Medium |
| `memory-validator.sh` | Validates MCP memory operations | Medium |
| `audit-logger.sh` | Records all tool invocations | Low |

### Example: git-branch-protection.sh

```bash
#!/bin/bash
set -euo pipefail

# Blocks: git commit, git push on dev/main/master
if [[ "$CURRENT_BRANCH" == "dev" || "$CURRENT_BRANCH" == "main" ]]; then
  if [[ "$COMMAND" =~ git\ commit || "$COMMAND" =~ git\ push ]]; then
    echo "BLOCKED: Cannot commit directly to '$CURRENT_BRANCH'" >&2
    exit 2  # Exit code 2 blocks the command
  fi
fi
```

---

## Project Structure

```
.claude/
+-- skills/                    # 78 domain-specific skills
|   +-- agent-loops/
|   |   +-- capabilities.json  # Discovery metadata
|   |   +-- SKILL.md          # Core patterns
|   |   +-- references/       # Detailed docs
|   |   +-- templates/        # Code templates
|   +-- langgraph-supervisor/
|   +-- rag-retrieval/
|   +-- ...
+-- commands/                  # 12 slash commands
|   +-- commit.md
|   +-- implement.md
|   +-- errors.md
|   +-- ...
+-- agents/                    # 20 specialized agents (6 product + 14 technical)
|   +-- market-intelligence.md
|   +-- product-strategist.md
|   +-- llm-integrator.md
|   +-- ...
+-- hooks/                     # 90 lifecycle hooks
|   +-- pretool/
|   +-- posttool/
|   +-- lifecycle/
|   +-- permission/
|   +-- ...
+-- scripts/                   # Utility scripts
|   +-- analyze_errors.py
+-- rules/                     # Learned error patterns
|   +-- error_rules.json
+-- schemas/                   # JSON schemas
    +-- skill-capabilities.schema.json
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
# Create a new skill
mkdir .claude/skills/my-skill
touch .claude/skills/my-skill/{capabilities.json,SKILL.md}

# Validate capabilities.json schema
npx ajv validate -s .claude/schemas/skill-capabilities.schema.json \
                 -d .claude/skills/my-skill/capabilities.json
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Credits

**Created by:** [SkillForge Team](https://github.com/skillforge)

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

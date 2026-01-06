---
name: skillforge-complete
description: Complete AI Development Toolkit for Claude Code
version: 1.0.0
owner: yonatangross
license: MIT
---

# SkillForge Complete

The Complete AI Development Toolkit - 61 skills, 20 agents, 11 commands, 29 hooks.

## When to Activate

- Building AI/LLM applications (RAG, agents, embeddings)
- Full-stack development with React 19 / Next.js 15
- Database design and query optimization
- Security audits and penetration testing
- DevOps pipelines and deployment
- Code review and quality gates

## Skill Categories

### AI & LLM Development (23 skills)

| Skill | Purpose |
|-------|---------|
| `agent-loops` | ReAct patterns, autonomous reasoning |
| `rag-retrieval` | RAG pipelines, chunking, retrieval |
| `embeddings` | Vector operations, similarity search |
| `function-calling` | LLM tool use, structured output |
| `langgraph-*` | Supervisor, routing, parallel, checkpoints, human-in-loop, state |
| `llm-evaluation` | Quality metrics, benchmarks |
| `llm-testing` | Mocking, deterministic tests |
| `prompt-caching` | Anthropic/OpenAI cost reduction |
| `semantic-caching` | Redis vector similarity cache |
| `context-compression` | Token optimization |
| `llm-safety-patterns` | Prompt injection prevention |

### Backend Development (5 skills)

| Skill | Purpose |
|-------|---------|
| `api-design-framework` | REST patterns, OpenAPI templates |
| `database-schema-designer` | Normalization, indexing, migrations |
| `streaming-api-patterns` | SSE, WebSockets, backpressure |
| `type-safety-validation` | Zod + tRPC + Prisma |
| `resilience-patterns` | Circuit breakers, retry logic |

### Frontend Development (6 skills)

| Skill | Purpose |
|-------|---------|
| `react-server-components-framework` | Next.js 15, RSC, Server Actions |
| `design-system-starter` | Design tokens, accessibility |
| `motion-animation-patterns` | Framer Motion, page transitions |
| `i18n-date-patterns` | Internationalization, RTL |
| `performance-optimization` | React 19, Core Web Vitals |
| `edge-computing-patterns` | Cloudflare Workers, Vercel Edge |

### Quality & Testing (14 skills)

| Skill | Purpose |
|-------|---------|
| `unit-testing` | Mocking, coverage strategies |
| `integration-testing` | Component interactions |
| `e2e-testing` | Playwright patterns |
| `webapp-testing` | Autonomous test agents |
| `msw-mocking` | Mock Service Worker |
| `vcr-http-recording` | HTTP recording/playback |
| `code-review-playbook` | Conventional comments |
| `quality-gates` | Automated enforcement |
| `golden-dataset-*` | Curation, validation, management |

### DevOps & Security (7 skills)

| Skill | Purpose |
|-------|---------|
| `devops-deployment` | CI/CD, Docker, Kubernetes |
| `observability-monitoring` | Logging, metrics, tracing |
| `owasp-top-10` | Security mitigations |
| `auth-patterns` | JWT, OAuth, sessions |
| `security-scanning` | SAST, dependency audits |
| `input-validation` | Sanitization, injection prevention |
| `defense-in-depth` | 8-layer security architecture |

### Process & Planning (6 skills)

| Skill | Purpose |
|-------|---------|
| `brainstorming` | Socratic questioning, MVP scoping |
| `architecture-decision-record` | ADR templates |
| `ascii-visualizer` | ASCII diagrams |
| `github-cli` | PR automation, issue management |
| `browser-content-capture` | Web scraping, docs capture |
| `system-design-interrogation` | Structured design questions |

## Installation

### From Marketplace

```bash
# Add marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin

# Install full toolkit
/plugin install skillforge-complete@complete

# Or install specific bundles
/plugin install skillforge-complete@ai-development
/plugin install skillforge-complete@backend
/plugin install skillforge-complete@frontend
/plugin install skillforge-complete@quality-testing
/plugin install skillforge-complete@devops-security
/plugin install skillforge-complete@process-planning
```

### From GitHub

```bash
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge
```

## Progressive Loading

Skills use `capabilities.json` for token-efficient discovery:

1. **Tier 1 - Discovery** (~100 tokens): `capabilities.json` for relevance
2. **Tier 2 - Overview** (~500 tokens): `SKILL.md` for patterns
3. **Tier 3 - Specific** (~200 tokens): `references/*.md` for details
4. **Tier 4 - Generate** (~300 tokens): `templates/*` for code

See `.claude/skills/*/capabilities.json` for trigger patterns.

## Additional Features

- **20 Agents**: Product thinking (6) + technical implementation (14)
- **11 Commands**: `/commit`, `/implement`, `/review-pr`, `/explore`, etc.
- **29 Hooks**: Safety, auditing, auto-approval, lifecycle management

## References

- [Full README](README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Agent Registry](.claude/agent-registry.json)

/**
 * OrchestKit Shared Data Layer
 * Single source of truth for all playground pages.
 * Uses window global (not ES modules) for file:// protocol compatibility.
 */
window.ORCHESTKIT_DATA = {
  version: "5.5.0",

  plugins: [
    { name: "ork-core", description: "Core foundation - context engineering, architecture decisions, project structure", fullDescription: "The required foundation plugin. Provides context engineering, architecture decision records, project structure enforcement, brainstorming workflows, quality gates, and task dependency patterns. All 119 lifecycle hooks live here.", category: "development", version: "5.5.0",
      skills: ["architecture-decision-record","project-structure-enforcer","context-compression","context-engineering","system-design-interrogation","assess","assess-complexity","brainstorming","configure","quality-gates","task-dependency-patterns","monorepo-context","biome-linting"],
      agents: ["debug-investigator","system-design-reviewer","documentation-specialist"],
      commands: ["assess","assess-complexity","brainstorming","configure","doctor"],
      hooks: 119, color: "#8b5cf6", required: true },

    { name: "ork-workflows", description: "Implement, explore, verify, review-pr, commit, doctor, feedback", fullDescription: "Essential workflow commands that power the core development loop. Implements parallel subagent execution for feature building, deep codebase exploration, comprehensive verification, PR review with 6+ agents, smart commits, and skill evolution tracking.", category: "development", version: "5.3.0",
      skills: ["implement","explore","verify","review-pr","code-review-playbook","skill-evolution","feedback","worktree-coordination","commit","doctor","errors","run-tests","decision-history","multi-scenario-orchestration"],
      agents: ["code-quality-reviewer"],
      commands: ["implement","explore","verify","review-pr","commit","doctor","feedback","worktree-coordination","decision-history","skill-evolution"],
      hooks: 0, color: "#8b5cf6", required: true },

    { name: "ork-memory-graph", description: "Knowledge graph memory - remember, recall, load-context", fullDescription: "Zero-config knowledge graph memory that always works. Store decisions, patterns, and context as graph entities. Recall by semantic search. Auto-load relevant context at session start.", category: "development", version: "1.0.0",
      skills: ["remember","recall","load-context"], agents: [],
      commands: ["remember","recall","load-context"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-memory-mem0", description: "Mem0 cloud memory - semantic search, cross-session sync", fullDescription: "Optional cloud memory layer using Mem0 API. Provides semantic search across sessions, automatic sync of decisions and patterns. Requires MEM0_API_KEY environment variable.", category: "development", version: "1.0.0",
      skills: ["mem0-memory","mem0-sync"], agents: [],
      commands: ["mem0-sync"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-memory-fabric", description: "Memory orchestration - parallel query, cross-reference boosting", fullDescription: "Orchestration layer that merges results from graph and mem0 memory with deduplication and cross-reference boosting. Dispatches queries to both memory backends in parallel.", category: "development", version: "1.0.0",
      skills: ["memory-fabric"], agents: [],
      commands: [],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-rag", description: "RAG & Retrieval - embeddings, contextual, HyDE, reranking, pgvector", fullDescription: "RAG and retrieval patterns for AI applications. Core RAG retrieval, text embeddings for semantic search, Contextual Retrieval (Anthropic), HyDE for hypothetical document generation, reranking for precision, query decomposition, agentic RAG with Self-RAG/Corrective-RAG, multimodal RAG, PGVector hybrid search, and semantic caching with Redis.", category: "ai", version: "5.3.0",
      skills: ["rag-retrieval","embeddings","contextual-retrieval","hyde-retrieval","reranking-patterns","query-decomposition","agentic-rag-patterns","multimodal-rag","pgvector-search","semantic-caching"],
      agents: ["data-pipeline-engineer","multimodal-specialist"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-langgraph", description: "LangGraph & Agent Orchestration - state, routing, parallel, checkpoints, supervisor", fullDescription: "LangGraph and agent orchestration patterns. State management, conditional routing, parallel execution, checkpointing and persistence, functional API with @entrypoint/@task, supervisor-worker patterns, human-in-the-loop, multi-agent coordination, autonomous agent loops, alternative frameworks (CrewAI, AutoGen), and Temporal.io durable workflows.", category: "ai", version: "5.3.0",
      skills: ["langgraph-state","langgraph-routing","langgraph-parallel","langgraph-checkpoints","langgraph-functional","langgraph-supervisor","langgraph-human-in-loop","multi-agent-orchestration","agent-loops","alternative-agent-frameworks","temporal-io"],
      agents: ["workflow-architect"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-llm", description: "LLM Patterns - function-calling, prompts, streaming, testing, safety, caching", fullDescription: "LLM integration patterns for production AI apps. Function calling and tool use, prompt engineering with CoT/few-shot, streaming responses, LLM testing strategies, safety patterns against injection, prompt caching for cost reduction, fine-tuning with LoRA/QLoRA, and multimodal (vision + audio) models.", category: "ai", version: "5.3.0",
      skills: ["function-calling","prompt-engineering-suite","llm-streaming","llm-testing","llm-safety-patterns","prompt-caching","fine-tuning-customization","vision-language-models","audio-language-models","high-performance-inference","ollama-local"],
      agents: ["llm-integrator","prompt-engineer","multimodal-specialist"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-ai-observability", description: "AI Observability - langfuse, cost-tracking, drift-detection, PII masking", fullDescription: "AI observability and monitoring. Langfuse integration for LLM tracing, cache-aware cost tracking, statistical drift detection, PII masking for compliance, silent failure detection in agent pipelines, and evidence verification.", category: "ai", version: "5.2.6",
      skills: ["langfuse-observability","cache-cost-tracking","evidence-verification","drift-detection","pii-masking-patterns","silent-failure-detection","skill-analyzer"],
      agents: ["monitoring-engineer"],
      commands: ["drift-detection","silent-failure-detection"],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-evaluation", description: "Evaluation - LLM evaluation, golden datasets, curation, validation", fullDescription: "LLM evaluation and golden dataset management. Evaluate LLM outputs with scoring rubrics, curate high-quality golden datasets, manage dataset versions, validate dataset quality, and add new golden examples with the /ork:add-golden command.", category: "data", version: "5.2.6",
      skills: ["llm-evaluation","golden-dataset-curation","golden-dataset-management","golden-dataset-validation","add-golden"],
      agents: ["data-pipeline-engineer"],
      commands: ["add-golden"],
      hooks: 0, color: "#6366f1", required: false },

    { name: "ork-product", description: "Product Management - strategist, business-case, prioritization, market-intelligence", fullDescription: "Product management agents (no skills, pure agent power). Includes product strategist for value propositions, business case builder for ROI analysis, prioritization analyst with RICE/ICE/WSJF scoring, market intelligence for competitive analysis, requirements translator for PRDs, and metrics architect for OKRs/KPIs.", category: "product", version: "5.2.6",
      skills: [], agents: ["product-strategist","business-case-builder","prioritization-analyst","market-intelligence","requirements-translator","metrics-architect"],
      commands: [],
      hooks: 0, color: "#a855f7", required: false },

    { name: "ork-api", description: "API Design - FastAPI, GraphQL, REST, streaming, versioning, rate-limiting", fullDescription: "API design patterns for modern backends. FastAPI advanced patterns, Strawberry GraphQL, RESTful API design framework, real-time streaming (SSE/WebSocket), API versioning strategies, rate limiting, and RFC 9457 error handling.", category: "backend", version: "5.3.0",
      skills: ["fastapi-advanced","api-design-framework","api-versioning","streaming-api-patterns","rate-limiting","error-handling-rfc9457","strawberry-graphql"],
      agents: ["backend-system-architect"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-database", description: "Database patterns - SQLAlchemy 2, Alembic, schema design, zero-downtime migration", fullDescription: "Database patterns for production systems. SQLAlchemy 2.0 async with proper session management, Alembic migration workflows, schema design for SQL and NoSQL, zero-downtime migrations, and connection pooling strategies.", category: "backend", version: "5.2.6",
      skills: ["sqlalchemy-2-async","alembic-migrations","database-schema-designer","database-versioning","zero-downtime-migration","connection-pooling"],
      agents: ["database-engineer"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-async", description: "Async & Tasks - asyncio, background-jobs, Celery, distributed-locks, resilience", fullDescription: "Async and task processing patterns. Python asyncio with TaskGroup and structured concurrency, background job processing with Celery and ARQ, distributed locking with Redis, and production-grade resilience patterns (circuit breakers, retries, bulkheads).", category: "backend", version: "5.2.6",
      skills: ["asyncio-advanced","background-jobs","celery-advanced","distributed-locks","resilience-patterns"],
      agents: ["backend-system-architect","python-performance-engineer"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-backend-patterns", description: "Backend Architecture - clean-arch, DDD, CQRS, event-sourcing, sagas, outbox, gRPC", fullDescription: "Comprehensive backend architecture patterns including Clean Architecture with SOLID principles, Domain-Driven Design tactical patterns, CQRS for read/write separation, event sourcing, saga orchestration, transactional outbox, and gRPC service definitions.", category: "backend", version: "5.3.0",
      skills: ["clean-architecture","domain-driven-design","backend-architecture-enforcer","cqrs-patterns","event-sourcing","saga-patterns","aggregate-patterns","outbox-pattern","idempotency-patterns","caching-strategies","grpc-python","message-queues"],
      agents: ["backend-system-architect","event-driven-architect"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-react-core", description: "React Core - RSC, forms, Zustand, TanStack Query, React Aria, type-safety", fullDescription: "React core patterns for modern applications. React Server Components with Next.js 16+, form state with React Hook Form + Zod, Zustand 5.x state management, TanStack Query v5 for data fetching, React Aria for accessibility, and end-to-end type safety.", category: "frontend", version: "5.2.6",
      skills: ["react-server-components-framework","form-state-patterns","zustand-patterns","tanstack-query-advanced","react-aria-patterns","type-safety-validation"],
      agents: ["frontend-ui-developer"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-ui-design", description: "UI & Design - design-system, shadcn, Radix, Motion animations, i18n", fullDescription: "UI and design patterns. Design system creation with tokens and components, shadcn/ui with CVA variants, Radix UI accessible primitives, Motion (Framer Motion) animation patterns, and internationalization with date formatting.", category: "frontend", version: "5.2.6",
      skills: ["design-system-starter","shadcn-patterns","radix-primitives","motion-animation-patterns","i18n-date-patterns"],
      agents: ["frontend-ui-developer","rapid-ui-designer","ux-researcher"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-frontend", description: "Frontend Patterns - PWA, view-transitions, scroll-anim, dashboard, CWV, Vite", fullDescription: "Frontend optimization and advanced patterns. Progressive Web Apps with Workbox 7, View Transitions API, scroll-driven animations, responsive layouts with Container Queries, dashboard widget composition, Core Web Vitals optimization, Vite 7+ config, and image optimization.", category: "frontend", version: "5.3.0",
      skills: ["pwa-patterns","view-transitions","scroll-driven-animations","responsive-patterns","dashboard-patterns","performance-optimization","render-optimization","lazy-loading-patterns","image-optimization","core-web-vitals","vite-advanced","recharts-patterns"],
      agents: ["frontend-ui-developer","performance-engineer"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-testing", description: "Testing - unit, integration, property-based, e2e, MSW, VCR, contract, pytest", fullDescription: "Comprehensive testing patterns. Unit testing with AAA pattern, integration testing for APIs, property-based testing with Hypothesis, end-to-end with Playwright, web app testing with AI agents, MSW 2.x for API mocking, VCR.py for HTTP recording, consumer-driven contract testing, test data management, and advanced pytest patterns.", category: "testing", version: "5.3.0",
      skills: ["unit-testing","integration-testing","property-based-testing","test-data-management","test-standards-enforcer","pytest-advanced","e2e-testing","webapp-testing","msw-mocking","vcr-http-recording","contract-testing"],
      agents: ["test-generator"],
      commands: ["run-tests"],
      hooks: 0, color: "#22c55e", required: false },

    { name: "ork-security", description: "Security - OWASP Top 10, auth, input-validation, defense-in-depth, scanning, guardrails", fullDescription: "Security patterns for production applications. OWASP Top 10 vulnerability prevention, authentication and authorization (JWT, OAuth, RBAC), input validation and sanitization, defense-in-depth across 8 layers, automated security scanning, and advanced LLM guardrails (NeMo, Guardrails AI).", category: "security", version: "5.2.6",
      skills: ["owasp-top-10","auth-patterns","input-validation","defense-in-depth","security-scanning","advanced-guardrails"],
      agents: ["security-auditor","security-layer-auditor","ai-safety-auditor"],
      commands: [],
      hooks: 0, color: "#ef4444", required: false },

    { name: "ork-devops", description: "DevOps & Infrastructure - deployment, monitoring, performance-testing, release, edge", fullDescription: "DevOps and infrastructure patterns. Zero-downtime deployment strategies, observability with Prometheus/Grafana, load testing with k6/Locust, GitHub release automation with semver, edge computing on Cloudflare/Vercel/Deno, and Slack MCP integration.", category: "devops", version: "5.3.0",
      skills: ["devops-deployment","observability-monitoring","performance-testing","github-operations","release-management","edge-computing-patterns","slack-integration","best-practices"],
      agents: ["ci-cd-engineer","deployment-manager","release-engineer","infrastructure-architect","monitoring-engineer"],
      commands: ["performance-testing","release-management"],
      hooks: 0, color: "#f97316", required: false },

    { name: "ork-git", description: "Git/GitHub - workflow, recovery, create-pr, fix-issue, stacked-prs", fullDescription: "Git and GitHub workflow patterns. Complete git workflow with branching strategies, recovery commands for common mistakes (reflog, cherry-pick, reset), automated PR creation with validation, issue fixing with parallel analysis, progress tracking on GitHub issues, and stacked PR workflows for large features.", category: "development", version: "5.2.6",
      skills: ["git-workflow","git-recovery-command","create-pr","fix-issue","issue-progress-tracking","stacked-prs"],
      agents: ["git-operations-engineer"],
      commands: ["create-pr","fix-issue","git-recovery-command"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-accessibility", description: "Accessibility - WCAG compliance, a11y testing, focus management", fullDescription: "Accessibility patterns for inclusive applications. WCAG 2.2 AA compliance checklists and implementation, automated a11y testing with axe-core, and keyboard focus management patterns for complex widgets.", category: "accessibility", version: "5.2.6",
      skills: ["wcag-compliance","a11y-testing","focus-management"],
      agents: ["accessibility-specialist"],
      commands: [],
      hooks: 0, color: "#14b8a6", required: false },

    { name: "ork-mcp", description: "MCP Integration - server-building, advanced-patterns, security, agent-browser", fullDescription: "Model Context Protocol integration. Build custom MCP servers, advanced tool composition patterns, security hardening against prompt injection and tool poisoning, headless browser automation with agent-browser, and content capture from JS-rendered pages.", category: "development", version: "5.2.6",
      skills: ["mcp-server-building","mcp-advanced-patterns","mcp-security-hardening","agent-browser","browser-content-capture"],
      agents: [],
      commands: ["agent-browser","browser-content-capture"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-video", description: "Video & Demo - Remotion, Manim, VHS, storyboarding, narration, HeyGen", fullDescription: "Video and demo production toolkit. Create marketing videos with Remotion compositions, Manim math animations, VHS terminal recordings, video storyboarding, pacing optimization, ElevenLabs narration, scene intro cards, hook formulas, HeyGen AI avatars, thumbnail optimization, and audio mixing.", category: "development", version: "5.3.0",
      skills: ["demo-producer","terminal-demo-generator","remotion-composer","manim-visualizer","video-storyboarding","video-pacing","narration-scripting","elevenlabs-narration","content-type-recipes","scene-intro-cards","hook-formulas","callout-positioning","heygen-avatars","thumbnail-first-frame","ascii-visualizer","audio-mixing-patterns","music-sfx-selection"],
      agents: ["demo-producer"],
      commands: ["demo-producer","remotion-composer"],
      hooks: 0, color: "#8b5cf6", required: false },
  ],

  agents: [
    { name: "accessibility-specialist", description: "Accessibility expert - WCAG 2.2 compliance, screen readers, keyboard nav, ARIA patterns.", plugins: ["ork-accessibility"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: ["wcag-compliance","a11y-testing","focus-management"] },
    { name: "ai-safety-auditor", description: "AI safety/security auditor - red teaming, prompt injection, jailbreak testing, OWASP LLM.", plugins: ["ork-security"], model: "sonnet", tools: ["Read","Write","Bash","Edit","Grep","Glob","WebFetch","WebSearch"], skills: [] },
    { name: "backend-system-architect", description: "Backend architect - REST/GraphQL APIs, database schemas, microservices, distributed systems.", plugins: ["ork-api","ork-async","ork-backend-patterns"], model: "sonnet", tools: ["Read","Edit","MultiEdit","Write","Bash","Grep","Glob"], skills: [] },
    { name: "business-case-builder", description: "Business analyst - ROI projections, cost-benefit analysis, risk assessments.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","Write","WebSearch","Grep","Glob","Bash"], skills: [] },
    { name: "ci-cd-engineer", description: "CI/CD specialist - GitHub Actions, GitLab CI, build optimization, security scanning.", plugins: ["ork-devops"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "code-quality-reviewer", description: "QA expert - bugs, security vulnerabilities, performance issues, best practices.", plugins: ["ork-workflows"], model: "sonnet", tools: [], skills: [] },
    { name: "data-pipeline-engineer", description: "Data pipeline - embeddings, chunking, vector indexes, data transformation.", plugins: ["ork-evaluation","ork-rag"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "database-engineer", description: "PostgreSQL specialist - schemas, migrations, query optimization, pgvector.", plugins: ["ork-database"], model: "sonnet", tools: [], skills: [] },
    { name: "debug-investigator", description: "Debug specialist - root cause analysis, scientific method, log/stack trace analysis.", plugins: ["ork-core"], model: "sonnet", tools: ["Bash","Read","Grep","Glob"], skills: [] },
    { name: "demo-producer", description: "Video producer - marketing videos, VHS terminal recording, Remotion composition.", plugins: ["ork-video"], model: "sonnet", tools: ["Read","Write","Edit","Bash","Grep","Glob","Task","AskUserQuestion"], skills: [] },
    { name: "deployment-manager", description: "Release/deployment - production releases, rollbacks, feature flags, blue-green.", plugins: ["ork-devops"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "documentation-specialist", description: "Technical writer - API docs, READMEs, guides, ADRs, changelogs, OpenAPI.", plugins: ["ork-core"], model: "sonnet", tools: ["Read","Write","Bash","Edit","Glob","Grep","WebFetch"], skills: [] },
    { name: "event-driven-architect", description: "Event-driven - event sourcing, Kafka, RabbitMQ, CQRS, outbox pattern.", plugins: ["ork-backend-patterns"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "frontend-ui-developer", description: "Frontend dev - React 19/TypeScript, optimistic updates, Zod, TanStack.", plugins: ["ork-react-core","ork-ui-design","ork-frontend"], model: "sonnet", tools: ["Read","Edit","MultiEdit","Write","Bash","Grep","Glob"], skills: [] },
    { name: "git-operations-engineer", description: "Git ops - branches, rebases, merges, stacked PRs, recovery, clean history.", plugins: ["ork-git"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "infrastructure-architect", description: "IaC specialist - Terraform, Kubernetes, AWS/GCP/Azure, networking, cost optimization.", plugins: ["ork-devops"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "llm-integrator", description: "LLM integration - OpenAI/Anthropic/Ollama APIs, prompt templates, function calling.", plugins: ["ork-llm"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob","WebFetch"], skills: [] },
    { name: "market-intelligence", description: "Market research - competitive landscapes, trends, TAM/SAM/SOM.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","WebSearch","WebFetch","Grep","Glob","Bash"], skills: [] },
    { name: "metrics-architect", description: "Metrics specialist - OKRs, KPIs, success criteria, instrumentation plans.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","Write","Grep","Glob","Bash"], skills: [] },
    { name: "monitoring-engineer", description: "Observability - Prometheus, Grafana, alerting, distributed tracing, SLOs.", plugins: ["ork-devops","ork-ai-observability"], model: "sonnet", tools: ["Read","Write","Bash","Edit","Glob","Grep","WebFetch","WebSearch"], skills: [] },
    { name: "multimodal-specialist", description: "Vision/audio/video - GPT-5, Claude 4.5, Gemini 3, image analysis, transcription.", plugins: ["ork-llm","ork-rag"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob","WebFetch"], skills: [] },
    { name: "performance-engineer", description: "Performance - Core Web Vitals, bundle analysis, render profiling, RUM.", plugins: ["ork-frontend"], model: "sonnet", tools: ["Read","Edit","Write","Bash","Grep","Glob"], skills: [] },
    { name: "prioritization-analyst", description: "Prioritization - RICE/ICE/WSJF scoring, opportunity costs, backlog ranking.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","Grep","Glob","Bash"], skills: [] },
    { name: "product-strategist", description: "Product strategy - value propositions, build/buy/partner, go/no-go decisions.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","Write","WebSearch","WebFetch","Grep","Glob","Bash"], skills: [] },
    { name: "prompt-engineer", description: "Prompt expert - CoT, few-shot, structured outputs, versioning, A/B testing.", plugins: ["ork-llm"], model: "sonnet", tools: ["Read","Write","Bash","Edit","WebFetch","WebSearch"], skills: [] },
    { name: "python-performance-engineer", description: "Python performance - profiling, memory optimization, async, query optimization.", plugins: ["ork-async"], model: "sonnet", tools: ["Read","Edit","MultiEdit","Write","Bash","Grep","Glob","Task"], skills: [] },
    { name: "rapid-ui-designer", description: "UI/UX designer - Tailwind CSS prototyping, design systems, responsive layouts.", plugins: ["ork-ui-design"], model: "sonnet", tools: ["Write","Read","Grep","Glob"], skills: [] },
    { name: "release-engineer", description: "Release/versioning - GitHub releases, milestones, changelogs, semver.", plugins: ["ork-devops"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "requirements-translator", description: "Requirements - PRDs, user stories, acceptance criteria, engineering handoff.", plugins: ["ork-product"], model: "sonnet", tools: ["Read","Grep","Glob","Bash"], skills: [] },
    { name: "security-auditor", description: "Security - vulnerability scanning, dependency audit, OWASP Top 10, secrets detection.", plugins: ["ork-security"], model: "sonnet", tools: ["Bash","Read","Grep","Glob"], skills: [] },
    { name: "security-layer-auditor", description: "Defense-in-depth - 8 security layers from edge to storage.", plugins: ["ork-security"], model: "sonnet", tools: ["Bash","Read","Grep","Glob"], skills: [] },
    { name: "system-design-reviewer", description: "System design review - scale, data, security, UX, coherence evaluation.", plugins: ["ork-core"], model: "sonnet", tools: [], skills: [] },
    { name: "test-generator", description: "Test specialist - coverage gaps, unit/integration tests, MSW mocking, VCR.", plugins: ["ork-testing"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
    { name: "ux-researcher", description: "User research - personas, journey maps, usability testing, behavioral analysis.", plugins: ["ork-ui-design"], model: "sonnet", tools: ["Write","Read","WebSearch","Grep","Glob"], skills: [] },
    { name: "workflow-architect", description: "Multi-agent workflows - LangGraph pipelines, supervisor-worker, state, RAG.", plugins: ["ork-langgraph"], model: "sonnet", tools: ["Bash","Read","Write","Edit","Grep","Glob"], skills: [] },
  ],

  categories: {
    development: { color: "#8b5cf6", label: "Development" },
    ai:          { color: "#06b6d4", label: "AI" },
    backend:     { color: "#f59e0b", label: "Backend" },
    frontend:    { color: "#ec4899", label: "Frontend" },
    testing:     { color: "#22c55e", label: "Testing" },
    security:    { color: "#ef4444", label: "Security" },
    devops:      { color: "#f97316", label: "DevOps" },
    product:     { color: "#a855f7", label: "Product" },
    accessibility: { color: "#14b8a6", label: "Accessibility" },
    data:        { color: "#6366f1", label: "Data" },
  },

  compositions: [
    // === Production / Landscape 16:9 / Core Skills ===
    { id: "Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#8b5cf6", thumbnail: "thumbnails/Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/ac596921e6535c7f52c0d6177b50803d5cbebecd-639x360.png", relatedPlugin: "ork-workflows", tags: ["core","landscape","tri-terminal"] },
    { id: "Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#22c55e", thumbnail: "thumbnails/Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/43bf6882afcd73f8f5ae8e35d312b32ded656eeb-639x360.png", relatedPlugin: "ork-workflows", tags: ["core","landscape","tri-terminal"] },
    { id: "Commit", skill: "commit", command: "/ork:commit", hook: "Conventional commits in seconds", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", thumbnail: "thumbnails/Commit.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/66f43642b59e09d058ab03cfdd0d10073a2f3eba-639x360.png", relatedPlugin: "ork-workflows", tags: ["core","landscape","tri-terminal"] },
    { id: "Explore", skill: "explore", command: "/ork:explore", hook: "Understand codebases in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", thumbnail: "thumbnails/Explore.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/d0741c09b66f877401ccfc27f956578e3ce47e2c-639x360.png", relatedPlugin: "ork-workflows", tags: ["core","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / Memory Skills ===
    { id: "Remember", skill: "remember", command: "/ork:remember", hook: "Build your team's knowledge base", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#8b5cf6", thumbnail: "thumbnails/Remember.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/7f4b1fcaf5783671e1cd06cc078206f85442dbf8-639x360.png", relatedPlugin: "ork-memory-graph", tags: ["memory","landscape","tri-terminal"] },
    { id: "Recall", skill: "recall", command: "/ork:recall", hook: "Your team's decisions, instantly searchable", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#06b6d4", thumbnail: "thumbnails/Recall.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/ff8664b1b2bd7238c6a878a9e6078f30ae961bbf-639x360.png", relatedPlugin: "ork-memory-graph", tags: ["memory","landscape","tri-terminal"] },
    { id: "LoadContext", skill: "load-context", command: "/ork:load-context", hook: "Resume where you left off, instantly", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#8b5cf6", thumbnail: "thumbnails/LoadContext.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/e5b7fd4c66b232baa035e5184d2f566d6f9b4597-639x360.png", relatedPlugin: "ork-memory-graph", tags: ["memory","landscape","tri-terminal"] },
    { id: "Mem0Sync", skill: "mem0-sync", command: "/ork:mem0-sync", hook: "Session context that persists forever", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#06b6d4", thumbnail: "thumbnails/Mem0Sync.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/b2f28592bca62ee3a994fe30f4b7c7167b477616-639x360.png", relatedPlugin: "ork-memory-mem0", tags: ["memory","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / Review Skills ===
    { id: "ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#f97316", thumbnail: "thumbnails/ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/b187e003ab94d1e9b3eae5aae5e7d47a1fa7fc3d-639x360.png", relatedPlugin: "ork-workflows", tags: ["review","landscape","tri-terminal"] },
    { id: "CreatePR", skill: "create-pr", command: "/ork:create-pr", hook: "PRs that pass review the first time", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#22c55e", thumbnail: "thumbnails/CreatePR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/a43efa564e0cb78e7edbf4d97bf919373ac9198e-639x360.png", relatedPlugin: "ork-git", tags: ["review","landscape","tri-terminal"] },
    { id: "FixIssue", skill: "fix-issue", command: "/ork:fix-issue", hook: "From bug report to merged fix in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#ef4444", thumbnail: "thumbnails/FixIssue.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/43b1dc8b4b09894e4b81bdb54e46087e9b7b1246-639x360.png", relatedPlugin: "ork-git", tags: ["review","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / DevOps Skills ===
    { id: "Doctor", skill: "doctor", command: "/ork:doctor", hook: "Health diagnostics for OrchestKit systems", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#ef4444", thumbnail: "thumbnails/Doctor.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/5d0342006116a8ece0678441c5fe5a392d7b6c10-639x360.png", relatedPlugin: "ork-core", tags: ["devops","landscape","tri-terminal"] },
    { id: "Configure", skill: "configure", command: "/ork:configure", hook: "Your AI toolkit, your rules", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#f59e0b", thumbnail: "thumbnails/Configure.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/daef6693e325ab9e6b5cd7df2c3bdb5252b7aeac-639x360.png", relatedPlugin: "ork-core", tags: ["devops","landscape","tri-terminal"] },
    { id: "RunTests", skill: "run-tests", command: "/ork:run-tests", hook: "Parallel test execution at scale", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#22c55e", thumbnail: "thumbnails/RunTests.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/4d53beb44559de9b6144f93a1db3d63f0bed465a-639x360.png", relatedPlugin: "ork-testing", tags: ["devops","landscape","tri-terminal"] },
    { id: "Feedback", skill: "feedback", command: "/ork:feedback", hook: "Your patterns. Your control. Privacy-first learning.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#ec4899", thumbnail: "thumbnails/Feedback.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/6c9d91b24a99652598ed8648c4ffd639654e4ac1-639x360.png", relatedPlugin: "ork-workflows", tags: ["devops","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / AI Skills ===
    { id: "Brainstorming", skill: "brainstorming", command: "/ork:brainstorming", hook: "Generate ideas in parallel. 4 specialists. Synthesis included.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#f59e0b", thumbnail: "thumbnails/Brainstorming.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/5f5a4e19631f87fd49c9853f63b8b472e1d5d657-639x360.png", relatedPlugin: "ork-core", tags: ["ai","landscape","tri-terminal"] },
    { id: "Assess", skill: "assess", command: "/ork:assess", hook: "Evaluate quality across 6 dimensions", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#22c55e", thumbnail: "thumbnails/Assess.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/8c69c775078b8d410530eeda745c7b84cef3d7bb-639x360.png", relatedPlugin: "ork-core", tags: ["ai","landscape","tri-terminal"] },
    { id: "AssessComplexity", skill: "assess-complexity", command: "/ork:assess-complexity", hook: "Know before you code: 7 metrics, 1 decision", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#f97316", thumbnail: "thumbnails/AssessComplexity.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/0f061f093ea95cff65f2327a697ff7c6f430e6ab-639x360.png", relatedPlugin: "ork-core", tags: ["ai","landscape","tri-terminal"] },
    { id: "DecisionHistory", skill: "decision-history", command: "/ork:decision-history", hook: "Every decision tracked. Every rationale preserved. Time travel.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#6366f1", thumbnail: "thumbnails/DecisionHistory.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/1f53e733a3cf7276818c14a14ce7e13a73b94baa-639x360.png", relatedPlugin: "ork-workflows", tags: ["ai","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / Advanced Skills ===
    { id: "WorktreeCoordination", skill: "worktree-coordination", command: "/ork:worktree-coordination", hook: "3 Claude instances. 0 merge conflicts. Perfect sync.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#3b82f6", thumbnail: "thumbnails/WorktreeCoordination.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/b41eea564397ec0739f9ae690e93de0e9b1209c1-639x360.png", relatedPlugin: "ork-workflows", tags: ["advanced","landscape","tri-terminal"] },
    { id: "SkillEvolution", skill: "skill-evolution", command: "/ork:skill-evolution", hook: "Skills that learn. Patterns that improve. Auto-evolve.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#10b981", thumbnail: "thumbnails/SkillEvolution.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/8704c74b338c8373b234a6b78b3fcb5ac5e3b900-639x360.png", relatedPlugin: "ork-workflows", tags: ["advanced","landscape","tri-terminal"] },
    { id: "DemoProducer", skill: "demo-producer", command: "/ork:demo-producer", hook: "Professional demos in minutes, not days", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#ec4899", thumbnail: "thumbnails/DemoProducer.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/5c6414c0d1a2024c1b7b2316becb78ca7f06eb7f-639x360.png", relatedPlugin: "ork-video", tags: ["advanced","landscape","tri-terminal"] },
    { id: "AddGolden", skill: "add-golden", command: "/ork:add-golden", hook: "Curate your training data gold standard", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#f59e0b", thumbnail: "thumbnails/AddGolden.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/e81c1d865710b430276f1643e44daded1d3b48cf-639x360.png", relatedPlugin: "ork-evaluation", tags: ["advanced","landscape","tri-terminal"] },

    // === Production / Landscape 16:9 / Styles / ProgressiveZoom ===
    { id: "PZ-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "ProgressiveZoom", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Production/Landscape-16x9/Styles/ProgressiveZoom", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/PZ-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/633b8c22671ab92094e2f5baf7ff6e46dd0c1fef-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","progressive-zoom"] },
    { id: "PZ-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "ProgressiveZoom", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Production/Landscape-16x9/Styles/ProgressiveZoom", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/PZ-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/9d057720b045873b3bc70376c286a1b4732e64f1-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","progressive-zoom"] },

    // === Production / Landscape 16:9 / Styles / SplitMerge ===
    { id: "SM-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "SplitThenMerge", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Styles/SplitMerge", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/SM-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/59dd9da79b4a9daa78902a5969f0e4799a2ca8e7-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","split-merge"] },
    { id: "SM-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "SplitThenMerge", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Styles/SplitMerge", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/SM-ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/1e41e0ee4c0b64a3d7eeedfc1054230adb1f1939-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","split-merge"] },

    // === Production / Landscape 16:9 / Styles / Cinematic ===
    { id: "CIN-Verify", skill: "verify", command: "/ork:verify", hook: "6 parallel agents validate your feature", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Production/Landscape-16x9/Styles/Cinematic", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/CIN-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/20897faabafc833bab6fa848d8a7d00d0e17d4e1-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","cinematic"] },
    { id: "CIN-Explore", skill: "explore", command: "/ork:explore", hook: "Understand any codebase instantly", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Production/Landscape-16x9/Styles/Cinematic", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/CIN-Explore.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/3bb6dd8335ddb8467fb0ed0476bf3228e4531735-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","cinematic"] },
    { id: "CIN-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "6 specialized agents review your PR", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Production/Landscape-16x9/Styles/Cinematic", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/CIN-ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/4fa5a9e296f36e8d038f2957cf1d5dd89c539ab8-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","cinematic"] },
    { id: "CIN-Commit", skill: "commit", command: "/ork:commit", hook: "AI-generated conventional commits", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Styles/Cinematic", category: "styles", primaryColor: "#06b6d4", thumbnail: "thumbnails/CIN-Commit.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/72333e4d43ad252d0770795fc637e1a0566f3ff5-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","cinematic"] },
    { id: "CIN-Implement", skill: "implement", command: "/ork:implement", hook: "Full-power feature implementation", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 30, folder: "Production/Landscape-16x9/Styles/Cinematic", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/CIN-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/ccda6a93008ca83befda2ae6ba3918dfb47561e4-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","cinematic"] },

    // === Production / Landscape 16:9 / Styles / Hybrid-VHS ===
    { id: "HYB-InstallDemo", skill: "plugin install ork", command: "claude plugin install ork", hook: "One command. Full-stack AI toolkit.", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 10, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/HYB-InstallDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/e585836501a75cdf898dfa0ac0fa897e75961565-639x360.png", relatedPlugin: "ork-core", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-ShowcaseDemo", skill: "showcase", command: "", hook: "", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 30, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/HYB-ShowcaseDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/45f4b3e75a6b8f86c63a0940dea4551a7c585a15-639x360.png", relatedPlugin: "ork-core", tags: ["style","landscape","hybrid-vhs","showcase"] },
    { id: "HYB-Explore", skill: "explore", command: "/ork:explore", hook: "Understand any codebase instantly", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 13, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/HYB-Explore.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-Verify", skill: "verify", command: "/ork:verify", hook: "6 parallel agents validate your feature", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 8, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/HYB-Verify.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-Commit", skill: "commit", command: "/ork:commit", hook: "AI-generated conventional commits", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 8, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#06b6d4", thumbnail: "thumbnails/HYB-Commit.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-Brainstorming", skill: "brainstorming", command: "/ork:brainstorming", hook: "Think before you code", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 10, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#f59e0b", thumbnail: "thumbnails/HYB-Brainstorming.png", relatedPlugin: "ork-core", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "6 specialized agents review your PR", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 13, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/HYB-ReviewPR.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","hybrid-vhs"] },
    { id: "HYB-Remember", skill: "remember", command: "/ork:remember", hook: "Teach Claude your patterns", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 8, folder: "Production/Landscape-16x9/Styles/Hybrid-VHS", category: "styles", primaryColor: "#ec4899", thumbnail: "thumbnails/HYB-Remember.png", relatedPlugin: "ork-memory-graph", tags: ["style","landscape","hybrid-vhs"] },

    // === Production / Landscape 16:9 / Styles / SkillPhase ===
    { id: "ImplementSkillPhaseDemo", skill: "implement", command: "/ork:implement", hook: "Full-power feature implementation", style: "SkillPhase", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 24, folder: "Production/Landscape-16x9/Styles/SkillPhase", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/ImplementSkillPhaseDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/b853be1a9e63c3d947c1c9cfa88232e97809d728-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","skill-phase"] },
    { id: "ImplementPhases", skill: "implement", command: "/ork:implement", hook: "Full-power feature implementation", style: "PhaseComparison", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Styles/SkillPhase", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/ImplementPhases.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/bdf669d421397fecc226b9ac1775ddbe0218fed8-639x360.png", relatedPlugin: "ork-workflows", tags: ["style","landscape","phase-comparison"] },

    // === Production / Vertical 9:16 / TriTerminalRace ===
    { id: "V-TTR-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/TriTerminalRace", category: "core", primaryColor: "#8b5cf6", thumbnail: "thumbnails/V-TTR-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/a3893e2fd400e75e89b14c566571badbe89c0ef9-360x639.png", relatedPlugin: "ork-workflows", tags: ["core","vertical","tri-terminal"] },
    { id: "V-TTR-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "TriTerminalRace", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/TriTerminalRace", category: "core", primaryColor: "#22c55e", thumbnail: "thumbnails/V-TTR-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/cbdbeab5a730a8cad975ecd27e41cb421c7994c2-360x639.png", relatedPlugin: "ork-workflows", tags: ["core","vertical","tri-terminal"] },

    // === Production / Vertical 9:16 / ProgressiveZoom ===
    { id: "V-PZ-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "ProgressiveZoom", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/ProgressiveZoom", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/V-PZ-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/1859b5ee9e135ad663785f9a3538494914009110-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","progressive-zoom"] },
    { id: "V-PZ-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "ProgressiveZoom", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/ProgressiveZoom", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/V-PZ-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/ce6c185e176ba5505aafa018e01d9749c2c078d7-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","progressive-zoom"] },

    // === Production / Vertical 9:16 / SplitMerge ===
    { id: "V-SM-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "SplitThenMerge", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 16, folder: "Production/Vertical-9x16/SplitMerge", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/V-SM-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/9f7b067516abffbca83b271c7afa5c62356e3436-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","split-merge"] },
    { id: "V-SM-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "SplitThenMerge", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 16, folder: "Production/Vertical-9x16/SplitMerge", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/V-SM-ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/693fe93f3cf66d700f315506c5e144e0c1cc49f5-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","split-merge"] },

    // === Production / Vertical 9:16 / VHS ===
    { id: "VVHS-Explore", skill: "explore", command: "/ork:explore", hook: "Understand any codebase instantly", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 15, folder: "Production/Vertical-9x16/VHS", category: "core", primaryColor: "#8b5cf6", thumbnail: "thumbnails/VVHS-Explore.png", relatedPlugin: "ork-workflows", tags: ["core","vertical","vhs"] },
    { id: "VVHS-Verify", skill: "verify", command: "/ork:verify", hook: "6 parallel agents validate your feature", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 12, folder: "Production/Vertical-9x16/VHS", category: "core", primaryColor: "#22c55e", thumbnail: "thumbnails/VVHS-Verify.png", relatedPlugin: "ork-workflows", tags: ["core","vertical","vhs"] },
    { id: "VVHS-Commit", skill: "commit", command: "/ork:commit", hook: "AI-generated conventional commits", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 12, folder: "Production/Vertical-9x16/VHS", category: "core", primaryColor: "#06b6d4", thumbnail: "thumbnails/VVHS-Commit.png", relatedPlugin: "ork-workflows", tags: ["core","vertical","vhs"] },
    { id: "VVHS-Brainstorming", skill: "brainstorming", command: "/ork:brainstorming", hook: "Think before you code", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 14, folder: "Production/Vertical-9x16/VHS", category: "ai", primaryColor: "#f59e0b", thumbnail: "thumbnails/VVHS-Brainstorming.png", relatedPlugin: "ork-core", tags: ["ai","vertical","vhs"] },
    { id: "VVHS-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "6 specialized agents review your PR", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 15, folder: "Production/Vertical-9x16/VHS", category: "review", primaryColor: "#f97316", thumbnail: "thumbnails/VVHS-ReviewPR.png", relatedPlugin: "ork-workflows", tags: ["review","vertical","vhs"] },
    { id: "VVHS-Remember", skill: "remember", command: "/ork:remember", hook: "Teach Claude your patterns", style: "Vertical-VHS", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 12, folder: "Production/Vertical-9x16/VHS", category: "memory", primaryColor: "#ec4899", thumbnail: "thumbnails/VVHS-Remember.png", relatedPlugin: "ork-memory-graph", tags: ["memory","vertical","vhs"] },

    // === Production / Vertical 9:16 / Cinematic ===
    { id: "CINV-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "Cinematic", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/Cinematic", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/CINV-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/737fdb66c3cdd626c555c647a78d0a1a44eb7651-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","cinematic"] },
    { id: "CINV-Explore", skill: "explore", command: "/ork:explore", hook: "Understand any codebase instantly", style: "Cinematic", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/Cinematic", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/CINV-Explore.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/cca2627967aaeadb8edc113be911c91d823d43b3-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","cinematic"] },
    { id: "CINV-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "6 agents review your PR", style: "Cinematic", format: "vertical", width: 1080, height: 1920, fps: 30, durationSeconds: 18, folder: "Production/Vertical-9x16/Cinematic", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/CINV-ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/8e15022c9dc169319c99cfcb338b44bac227e260-360x639.png", relatedPlugin: "ork-workflows", tags: ["style","vertical","cinematic"] },

    // === Production / Square 1:1 / TriTerminalRace ===
    { id: "SQ-TTR-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Square-1x1/TriTerminalRace", category: "core", primaryColor: "#8b5cf6", thumbnail: "thumbnails/SQ-TTR-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/49e87096cd634b63e774dbe5c37b58e53fb95525-360x360.png", relatedPlugin: "ork-workflows", tags: ["core","square","tri-terminal"] },
    { id: "SQ-TTR-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "TriTerminalRace", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Square-1x1/TriTerminalRace", category: "core", primaryColor: "#22c55e", thumbnail: "thumbnails/SQ-TTR-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/fa57c83cb86e368ed24adc015aa4cd70a710c7d1-360x360.png", relatedPlugin: "ork-workflows", tags: ["core","square","tri-terminal"] },

    // === Production / Square 1:1 / ProgressiveZoom ===
    { id: "SQ-PZ-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "ProgressiveZoom", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 22, folder: "Production/Square-1x1/ProgressiveZoom", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/SQ-PZ-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/71e9b1579ce56ecf7cd902a8771eafc79941f6ec-360x360.png", relatedPlugin: "ork-workflows", tags: ["style","square","progressive-zoom"] },
    { id: "SQ-PZ-Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "ProgressiveZoom", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 22, folder: "Production/Square-1x1/ProgressiveZoom", category: "styles", primaryColor: "#22c55e", thumbnail: "thumbnails/SQ-PZ-Verify.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/d968b3c32606bee14c3475acac315f567c92ad45-360x360.png", relatedPlugin: "ork-workflows", tags: ["style","square","progressive-zoom"] },

    // === Production / Square 1:1 / SplitMerge ===
    { id: "SQ-SM-Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "SplitThenMerge", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Square-1x1/SplitMerge", category: "styles", primaryColor: "#8b5cf6", thumbnail: "thumbnails/SQ-SM-Implement.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/5b6d521fb52d0f795d18b9aa313f66f823336b41-360x360.png", relatedPlugin: "ork-workflows", tags: ["style","square","split-merge"] },
    { id: "SQ-SM-ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "SplitThenMerge", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Square-1x1/SplitMerge", category: "styles", primaryColor: "#f97316", thumbnail: "thumbnails/SQ-SM-ReviewPR.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/67943b5c868b124daf17c074078ae09516e5cdb3-360x360.png", relatedPlugin: "ork-workflows", tags: ["style","square","split-merge"] },

    // === Production / Square 1:1 / Social ===
    { id: "SpeedrunDemo", skill: "speedrun", command: "", hook: "Full-stack speedrun", style: "Social", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 15, folder: "Production/Square-1x1/Social", category: "marketing", primaryColor: "#8b5cf6", thumbnail: "thumbnails/SpeedrunDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/56f0ff382bbe8ab7d351149b669bfbd39e15a8d2-360x360.png", relatedPlugin: "ork-core", tags: ["marketing","square","social"] },
    { id: "BrainstormingShowcase", skill: "brainstorming", command: "/ork:brainstorming", hook: "Generate ideas in parallel", style: "Social", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 15, folder: "Production/Square-1x1/Social", category: "marketing", primaryColor: "#f59e0b", thumbnail: "thumbnails/BrainstormingShowcase.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/43ab22d956661df0f06f394a989d8f927d822774-360x360.png", relatedPlugin: "ork-core", tags: ["marketing","square","social"] },
    { id: "HooksAsyncDemo", skill: "hooks", command: "", hook: "Async hooks in action", style: "Social", format: "square", width: 1080, height: 1080, fps: 30, durationSeconds: 15, folder: "Production/Square-1x1/Social", category: "marketing", primaryColor: "#8b5cf6", thumbnail: "thumbnails/HooksAsyncDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/7b5cdeb5fd2a241f816b537149922c8bad45ae12-360x360.png", relatedPlugin: "ork-core", tags: ["marketing","square","social"] },

    // === Production / Marketing ===
    { id: "HeroGif", skill: "hero", command: "", hook: "", style: "Marketing", format: "landscape", width: 1200, height: 700, fps: 15, durationSeconds: 30, folder: "Production/Marketing", category: "marketing", primaryColor: "#8b5cf6", thumbnail: "thumbnails/HeroGif.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/d5676d42906c7812915c562573df4671e96fce3b-400x233.png", relatedPlugin: "ork-core", tags: ["marketing","landscape","hero","gif"] },
    { id: "MarketplaceDemo", skill: "marketplace", command: "", hook: "", style: "Marketing", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 45, folder: "Production/Marketing", category: "marketing", primaryColor: "#a855f7", thumbnail: "thumbnails/MarketplaceDemo.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/731e9e6617f2c2ba8d523ca1e2359b403984e165-639x360.png", relatedPlugin: "ork-core", tags: ["marketing","landscape"] },
    { id: "MarketplaceIntro", skill: "marketplace", command: "", hook: "", style: "Marketing", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 30, folder: "Production/Marketing", category: "marketing", primaryColor: "#8b5cf6", thumbnail: "thumbnails/MarketplaceIntro.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/313423138e4d248f6a2c74c58ac99e19d3f50399-639x360.png", relatedPlugin: "ork-core", tags: ["marketing","landscape"] },

    // === Templates ===
    { id: "TPL-TriTerminalRace", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-TriTerminalRace.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/ac596921e6535c7f52c0d6177b50803d5cbebecd-639x360.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },
    { id: "TPL-ProgressiveZoom", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "ProgressiveZoom", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-ProgressiveZoom.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/633b8c22671ab92094e2f5baf7ff6e46dd0c1fef-639x360.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },
    { id: "TPL-SplitMerge", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "SplitThenMerge", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-SplitMerge.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/59dd9da79b4a9daa78902a5969f0e4799a2ca8e7-639x360.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },
    { id: "TPL-SkillPhase", skill: "implement", command: "/ork:implement", hook: "Full-power feature implementation", style: "SkillPhase", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 24, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-SkillPhase.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/b853be1a9e63c3d947c1c9cfa88232e97809d728-639x360.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },
    { id: "TPL-Cinematic", skill: "implement", command: "/ork:implement", hook: "Full-power feature implementation", style: "Cinematic", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 25, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-Cinematic.png", thumbnailCdn: "https://cdn.sanity.io/images/8cv388wg/production/57d8d5a8321f6f3c0002c5e30187b10ad9c067b4-639x360.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },
    { id: "TPL-HybridVHS", skill: "explore", command: "/ork:explore", hook: "Understand any codebase instantly", style: "Hybrid-VHS", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 13, folder: "Templates", category: "templates", primaryColor: "#8b5cf6", thumbnail: "thumbnails/TPL-HybridVHS.png", relatedPlugin: "ork-workflows", tags: ["template","landscape"] },

    // === Experiments (excluded from gallery by default) ===
    { id: "EXP-Placeholder", skill: "", command: "", hook: "", style: "Experiment", format: "square", width: 100, height: 100, fps: 15, durationSeconds: 2, folder: "Experiments", category: "experiments", primaryColor: "#666", thumbnail: "thumbnails/_placeholder.png", relatedPlugin: "", tags: ["experiment"] },
  ],

  demoStyles: [
    { id: "TriTerminalRace", label: "Tri-Terminal Race", description: "Three terminal panes racing through stages simultaneously" },
    { id: "ProgressiveZoom", label: "Progressive Zoom", description: "Zooming into terminal output with progressive detail reveal" },
    { id: "SplitThenMerge", label: "Split Then Merge", description: "Split view that merges into a combined result" },
    { id: "Cinematic", label: "Cinematic", description: "Film-quality phased demo with dramatic transitions" },
    { id: "Hybrid-VHS", label: "Hybrid VHS", description: "Retro VHS aesthetic mixed with modern terminal UI" },
    { id: "Vertical-VHS", label: "Vertical VHS", description: "Vertical format VHS-style for mobile/social" },
    { id: "SkillPhase", label: "Skill Phase", description: "Phase-by-phase skill execution visualization" },
    { id: "PhaseComparison", label: "Phase Comparison", description: "Side-by-side phase comparison view" },
    { id: "Social", label: "Social", description: "Square format optimized for social media" },
    { id: "Marketing", label: "Marketing", description: "Marketing-focused compositions (hero, marketplace)" },
    { id: "Experiment", label: "Experiment", description: "Experimental compositions in development" },
  ],

  get totals() {
    var allSkills = new Set();
    var allAgents = new Set();
    var totalHooks = 0;
    var totalCommands = new Set();
    this.plugins.forEach(function(p) {
      p.skills.forEach(function(s) { allSkills.add(s); });
      p.agents.forEach(function(a) { allAgents.add(a); });
      totalHooks += p.hooks;
      p.commands.forEach(function(c) { totalCommands.add(c); });
    });
    return {
      plugins: this.plugins.length,
      skills: allSkills.size,
      agents: allAgents.size,
      hooks: totalHooks,
      commands: totalCommands.size,
      compositions: this.compositions.filter(function(c) { return c.folder !== "Experiments"; }).length,
    };
  },

  pages: [
    { id: "hub", label: "Hub", href: "index.html", icon: "\u2302", description: "Dashboard overview of the OrchestKit ecosystem" },
    { id: "marketplace", label: "Marketplace", href: "marketplace-explorer.html", icon: "\u229E", description: "Explore all plugins, skills, and agents" },
    { id: "wizard", label: "Setup Wizard", href: "setup-wizard.html", icon: "\u2699", description: "Get a personalized plugin recommendation" },
    { id: "gallery", label: "Demo Gallery", href: "demo-gallery.html", icon: "\u25B6", description: "Browse demo video compositions" },
  ],
};

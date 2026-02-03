/**
 * OrchestKit Shared Data Layer
 * Single source of truth for all playground pages.
 * Uses window global (not ES modules) for file:// protocol compatibility.
 *
 * GENERATED FILE - Do not edit plugins/agents sections manually!
 * Run: npm run generate:playground-data
 */
window.ORCHESTKIT_DATA = {
  version: "5.7.1",

  plugins: [
    { name: "ork-core", description: "Core foundation - context engineering, architecture decisions, project structure", fullDescription: "The required foundation plugin. Provides context engineering, architecture decision records, project structure enforcement, brainstorming workflows, quality gates, and task dependency patterns. All 119 lifecycle hooks live here.", category: "development", version: "5.7.1",
      skills: ["architecture-decision-record","project-structure-enforcer","context-compression","context-engineering","system-design-interrogation","assess","assess-complexity","brainstorming","configure","quality-gates","task-dependency-patterns","monorepo-context","biome-linting","root-cause-analysis"],
      agents: ["debug-investigator","system-design-reviewer","documentation-specialist"],
      commands: ["assess","assess-complexity","brainstorming","configure","doctor"],
      hooks: 119, color: "#8b5cf6", required: true },

    { name: "ork-workflows", description: "Implement, explore, verify, review-pr, commit, doctor, feedback", fullDescription: "Essential workflow commands that power the core development loop. Implements parallel subagent execution for feature building, deep codebase exploration, comprehensive verification, PR review with 6+ agents, smart commits, and skill evolution tracking.", category: "development", version: "5.7.1",
      skills: ["implement","explore","verify","review-pr","code-review-playbook","skill-evolution","feedback","worktree-coordination","commit","doctor","errors","run-tests","multi-scenario-orchestration"],
      agents: ["code-quality-reviewer"],
      commands: ["implement","explore","verify","review-pr","commit","doctor","feedback","worktree-coordination","decision-history","skill-evolution"],
      hooks: 0, color: "#8b5cf6", required: true },

    { name: "ork-accessibility", description: "Accessibility patterns — wcag-compliance, a11y-testing, focus-management", fullDescription: "Accessibility patterns — wcag-compliance, a11y-testing, focus-management", category: "accessibility", version: "5.7.1",
      skills: ["wcag-compliance","a11y-testing","focus-management"],
      agents: ["accessibility-specialist"],
      commands: [],
      hooks: 0, color: "#14b8a6", required: false },

    { name: "ork-ai-observability", description: "AI Observability — langfuse-observability, cache-cost-tracking, evidence-verification", fullDescription: "AI Observability — langfuse-observability, cache-cost-tracking, evidence-verification", category: "ai", version: "5.7.1",
      skills: ["langfuse-observability","cache-cost-tracking","evidence-verification","drift-detection","pii-masking-patterns","silent-failure-detection","skill-analyzer"],
      agents: ["monitoring-engineer"],
      commands: ["drift-detection","silent-failure-detection"],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-api", description: "API Design — FastAPI, GraphQL (Strawberry), REST patterns, streaming, versioning, rate-limiting, error-handling", fullDescription: "API Design — FastAPI, GraphQL (Strawberry), REST patterns, streaming, versioning, rate-limiting, error-handling", category: "backend", version: "5.7.1",
      skills: ["fastapi-advanced","api-design-framework","api-versioning","streaming-api-patterns","rate-limiting","error-handling-rfc9457","strawberry-graphql"],
      agents: ["backend-system-architect"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-async", description: "Async & Tasks — asyncio-advanced, background-jobs, celery-advanced, distributed-locks, resilience-patterns", fullDescription: "Async & Tasks — asyncio-advanced, background-jobs, celery-advanced, distributed-locks, resilience-patterns", category: "backend", version: "5.7.1",
      skills: ["asyncio-advanced","background-jobs","celery-advanced","distributed-locks","resilience-patterns"],
      agents: ["backend-system-architect","python-performance-engineer"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-backend-patterns", description: "Backend Architecture — clean-architecture, DDD, CQRS, event-sourcing, sagas, aggregates, outbox, idempotency, caching, gRPC", fullDescription: "Backend Architecture — clean-architecture, DDD, CQRS, event-sourcing, sagas, aggregates, outbox, idempotency, caching, gRPC", category: "backend", version: "5.7.1",
      skills: ["clean-architecture","domain-driven-design","backend-architecture-enforcer","cqrs-patterns","event-sourcing","saga-patterns","aggregate-patterns","outbox-pattern","idempotency-patterns","caching-strategies","grpc-python","message-queues"],
      agents: ["backend-system-architect","event-driven-architect"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-database", description: "Database patterns — sqlalchemy-2-async, alembic-migrations, database-schema-designer, database-versioning, zero-downtime-migration, connection-pooling", fullDescription: "Database patterns — sqlalchemy-2-async, alembic-migrations, database-schema-designer, database-versioning, zero-downtime-migration, connection-pooling", category: "backend", version: "5.7.1",
      skills: ["sqlalchemy-2-async","alembic-migrations","database-schema-designer","database-versioning","zero-downtime-migration","connection-pooling"],
      agents: ["database-engineer"],
      commands: [],
      hooks: 0, color: "#f59e0b", required: false },

    { name: "ork-devops", description: "DevOps & Infrastructure — deployment, monitoring, performance-testing, release-management, github-operations, edge-computing", fullDescription: "DevOps & Infrastructure — deployment, monitoring, performance-testing, release-management, github-operations, edge-computing", category: "devops", version: "5.7.1",
      skills: ["devops-deployment","observability-monitoring","performance-testing","github-operations","release-management","edge-computing-patterns","slack-integration","best-practices"],
      agents: ["ci-cd-engineer","deployment-manager","release-engineer","infrastructure-architect","monitoring-engineer"],
      commands: ["performance-testing","release-management"],
      hooks: 0, color: "#f97316", required: false },

    { name: "ork-evaluation", description: "Evaluation patterns — llm-evaluation, golden-dataset-curation, golden-dataset-management, golden-dataset-validation, add-golden", fullDescription: "Evaluation patterns — llm-evaluation, golden-dataset-curation, golden-dataset-management, golden-dataset-validation, add-golden", category: "data", version: "5.7.1",
      skills: ["llm-evaluation","golden-dataset-curation","golden-dataset-management","golden-dataset-validation","add-golden"],
      agents: ["data-pipeline-engineer"],
      commands: ["add-golden"],
      hooks: 0, color: "#6366f1", required: false },

    { name: "ork-frontend", description: "Frontend Patterns — PWA, view-transitions, scroll-animations, responsive, dashboard, performance, render, lazy-loading, image-optimization, core-web-vitals, vite", fullDescription: "Frontend Patterns — PWA, view-transitions, scroll-animations, responsive, dashboard, performance, render, lazy-loading, image-optimization, core-web-vitals, vite", category: "frontend", version: "5.7.1",
      skills: ["pwa-patterns","view-transitions","scroll-driven-animations","responsive-patterns","dashboard-patterns","performance-optimization","render-optimization","lazy-loading-patterns","image-optimization","core-web-vitals","vite-advanced","recharts-patterns"],
      agents: ["frontend-ui-developer","performance-engineer"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-git", description: "Git/GitHub patterns — git-workflow, git-recovery-command, create-pr, fix-issue, issue-progress-tracking, stacked-prs", fullDescription: "Git/GitHub patterns — git-workflow, git-recovery-command, create-pr, fix-issue, issue-progress-tracking, stacked-prs", category: "development", version: "5.7.1",
      skills: ["git-workflow","git-recovery-command","create-pr","fix-issue","issue-progress-tracking","stacked-prs"],
      agents: ["git-operations-engineer"],
      commands: ["create-pr","fix-issue","git-recovery-command"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-langgraph", description: "LangGraph & Agent Orchestration — state, routing, parallel, checkpoints, functional, supervisor, human-in-loop, multi-agent, agent-loops, frameworks, temporal", fullDescription: "LangGraph & Agent Orchestration — state, routing, parallel, checkpoints, functional, supervisor, human-in-loop, multi-agent, agent-loops, frameworks, temporal", category: "ai", version: "5.7.1",
      skills: ["langgraph-state","langgraph-routing","langgraph-parallel","langgraph-checkpoints","langgraph-functional","langgraph-supervisor","langgraph-human-in-loop","multi-agent-orchestration","agent-loops","alternative-agent-frameworks","temporal-io"],
      agents: ["workflow-architect"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-llm", description: "LLM Patterns — function-calling, prompt-engineering, streaming, testing, safety, caching, fine-tuning, vision, audio, inference, ollama", fullDescription: "LLM Patterns — function-calling, prompt-engineering, streaming, testing, safety, caching, fine-tuning, vision, audio, inference, ollama", category: "ai", version: "5.7.1",
      skills: ["function-calling","prompt-engineering-suite","llm-streaming","llm-testing","llm-safety-patterns","prompt-caching","fine-tuning-customization","vision-language-models","audio-language-models","high-performance-inference","ollama-local"],
      agents: ["llm-integrator","prompt-engineer","multimodal-specialist"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-mcp", description: "MCP Integration — mcp-server-building, mcp-advanced-patterns, mcp-security-hardening, agent-browser, browser-content-capture", fullDescription: "MCP Integration — mcp-server-building, mcp-advanced-patterns, mcp-security-hardening, agent-browser, browser-content-capture", category: "development", version: "5.7.1",
      skills: ["mcp-server-building","mcp-advanced-patterns","mcp-security-hardening","agent-browser","browser-content-capture"],
      agents: [],
      commands: ["agent-browser","browser-content-capture"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-memory-fabric", description: "Memory orchestration - parallel query, cross-reference boosting", fullDescription: "Orchestration layer that merges results from graph and mem0 memory with deduplication and cross-reference boosting. Dispatches queries to both memory backends in parallel.", category: "development", version: "5.7.1",
      skills: ["memory-fabric"],
      agents: [],
      commands: [],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-memory-graph", description: "Knowledge graph memory - remember, recall, load-context", fullDescription: "Zero-config knowledge graph memory that always works. Store decisions, patterns, and context as graph entities. Recall by semantic search. Auto-load relevant context at session start.", category: "development", version: "5.7.1",
      skills: ["remember","memory"],
      agents: [],
      commands: ["remember","recall","load-context"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-memory-mem0", description: "Mem0 cloud memory - semantic search, cross-session sync", fullDescription: "Optional cloud memory layer using Mem0 API. Provides semantic search across sessions, automatic sync of decisions and patterns. Requires MEM0_API_KEY environment variable.", category: "development", version: "5.7.1",
      skills: ["mem0-memory"],
      agents: [],
      commands: ["mem0-sync"],
      hooks: 0, color: "#8b5cf6", required: false },

    { name: "ork-product", description: "Product Management agents — product-strategist, business-case-builder, prioritization-analyst, market-intelligence", fullDescription: "Product Management agents — product-strategist, business-case-builder, prioritization-analyst, market-intelligence", category: "product", version: "5.7.1",
      skills: ["product-strategy-frameworks","prioritization-frameworks","business-case-analysis","market-analysis-patterns","requirements-engineering","okr-kpi-patterns"],
      agents: ["product-strategist","business-case-builder","prioritization-analyst","market-intelligence","requirements-translator","metrics-architect"],
      commands: [],
      hooks: 0, color: "#a855f7", required: false },

    { name: "ork-rag", description: "RAG & Retrieval — retrieval, embeddings, contextual, HyDE, reranking, query-decomposition, agentic-rag, multimodal-rag, pgvector-search, semantic-caching", fullDescription: "RAG & Retrieval — retrieval, embeddings, contextual, HyDE, reranking, query-decomposition, agentic-rag, multimodal-rag, pgvector-search, semantic-caching", category: "ai", version: "5.7.1",
      skills: ["rag-retrieval","embeddings","contextual-retrieval","hyde-retrieval","reranking-patterns","query-decomposition","agentic-rag-patterns","multimodal-rag","pgvector-search","semantic-caching"],
      agents: ["data-pipeline-engineer","multimodal-specialist"],
      commands: [],
      hooks: 0, color: "#06b6d4", required: false },

    { name: "ork-react-core", description: "React Core patterns — react-server-components-framework, form-state-patterns, zustand-patterns, tanstack-query-advanced, react-aria-patterns, type-safety-validation", fullDescription: "React Core patterns — react-server-components-framework, form-state-patterns, zustand-patterns, tanstack-query-advanced, react-aria-patterns, type-safety-validation", category: "frontend", version: "5.7.1",
      skills: ["react-server-components-framework","form-state-patterns","zustand-patterns","tanstack-query-advanced","react-aria-patterns","type-safety-validation"],
      agents: ["frontend-ui-developer"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-security", description: "Security patterns — owasp-top-10, auth-patterns, input-validation, defense-in-depth, security-scanning, advanced-guardrails", fullDescription: "Security patterns — owasp-top-10, auth-patterns, input-validation, defense-in-depth, security-scanning, advanced-guardrails", category: "security", version: "5.7.1",
      skills: ["owasp-top-10","auth-patterns","input-validation","defense-in-depth","security-scanning","advanced-guardrails"],
      agents: ["security-auditor","security-layer-auditor","ai-safety-auditor"],
      commands: [],
      hooks: 0, color: "#ef4444", required: false },

    { name: "ork-testing", description: "Testing — unit, integration, property-based, e2e, webapp, MSW, VCR, contract, test-data, standards, pytest", fullDescription: "Testing — unit, integration, property-based, e2e, webapp, MSW, VCR, contract, test-data, standards, pytest", category: "testing", version: "5.7.1",
      skills: ["unit-testing","integration-testing","property-based-testing","test-data-management","test-standards-enforcer","pytest-advanced","e2e-testing","webapp-testing","msw-mocking","vcr-http-recording","contract-testing"],
      agents: [],
      commands: ["run-tests"],
      hooks: 0, color: "#22c55e", required: false },

    { name: "ork-ui-design", description: "UI & Design patterns — design-system-starter, shadcn-patterns, radix-primitives, motion-animation-patterns, i18n-date-patterns", fullDescription: "UI & Design patterns — design-system-starter, shadcn-patterns, radix-primitives, motion-animation-patterns, i18n-date-patterns", category: "frontend", version: "5.7.1",
      skills: ["design-system-starter","shadcn-patterns","radix-primitives","motion-animation-patterns","i18n-date-patterns","user-research-methods","persona-journey-mapping"],
      agents: ["frontend-ui-developer","rapid-ui-designer","ux-researcher"],
      commands: [],
      hooks: 0, color: "#ec4899", required: false },

    { name: "ork-video", description: "Video & Demo Production — demo-producer, remotion, manim, terminal-recording, storyboarding, narration, HeyGen avatars, audio mixing", fullDescription: "Video & Demo Production — demo-producer, remotion, manim, terminal-recording, storyboarding, narration, HeyGen avatars, audio mixing", category: "development", version: "5.7.1",
      skills: ["demo-producer","terminal-demo-generator","remotion-composer","manim-visualizer","video-storyboarding","video-pacing","narration-scripting","elevenlabs-narration","content-type-recipes","scene-intro-cards","hook-formulas","callout-positioning","heygen-avatars","thumbnail-first-frame","ascii-visualizer","audio-mixing-patterns","music-sfx-selection"],
      agents: ["demo-producer"],
      commands: ["demo-producer","remotion-composer"],
      hooks: 0, color: "#8b5cf6", required: false }
  ],

  agents: [
    { name: "accessibility-specialist", description: "Accessibility expert who audits and implements WCAG 2.2 compliance, screen reader compatibility, and keyboard navigation patterns. Focuses on inclusive design, ARIA patterns, and automated a11y testing. Auto Mode keywords - accessibility, a11y, WCAG, screen reader, keyboard navigation, ARIA, inclusive design, contrast, focus management", plugins: ["ork-accessibility"], model: "inherit", tools: [], skills: [] },
    { name: "ai-safety-auditor", description: "AI safety and security auditor for LLM systems. Red teaming, prompt injection, jailbreak testing, guardrail validation, OWASP LLM compliance. Use for safety audit, security audit, red team, guardrails, jailbreak, prompt injection, OWASP LLM, vulnerabilities, penetration testing, mcp security, tool poisoning.", plugins: ["ork-security"], model: "opus", tools: [], skills: [] },
    { name: "backend-system-architect", description: "Backend architect who designs REST/GraphQL APIs, database schemas, microservice boundaries, and distributed systems. Focuses on scalability, security, performance optimization, and clean architecture patterns. Activates for API design, database schema, microservice, backend architecture, REST, GraphQL, distributed systems, endpoint, route, model, migration, authentication, authorization, JWT, OAuth, rate limiting, middleware, service layer, repository pattern, dependency injection", plugins: ["ork-api","ork-async","ork-backend-patterns"], model: "opus", tools: [], skills: [] },
    { name: "business-case-builder", description: "Business analyst who builds ROI projections, cost-benefit analyses, risk assessments, and investment justifications to support product decisions with financial rationale. Activates for ROI, cost-benefit, risk assessment, investment justification, business case, budget, revenue impact, cost analysis, financial, payback period, NPV, IRR, TCO, revenue projection", plugins: ["ork-product"], model: "inherit", tools: [], skills: [] },
    { name: "ci-cd-engineer", description: "CI/CD specialist who designs and implements GitHub Actions workflows, GitLab CI pipelines, and automated deployment strategies. Focuses on build optimization, caching, matrix testing, and security scanning integration. Auto Mode keywords - CI/CD, pipeline, GitHub Actions, GitLab CI, workflow, build, deploy, artifact, cache, matrix testing, release automation", plugins: ["ork-devops"], model: "inherit", tools: [], skills: [] },
    { name: "code-quality-reviewer", description: "Quality assurance expert who reviews code for bugs, security vulnerabilities, performance issues, and compliance with best practices. Runs linting, type checking, ensures test coverage, and validates architectural patterns. Auto Mode keywords: test, review, quality, lint, security, coverage, audit, validate, CI, pipeline, check, verify, type-check", plugins: ["ork-workflows"], model: "inherit", tools: [], skills: [] },
    { name: "data-pipeline-engineer", description: "Data pipeline specialist who generates embeddings, implements chunking strategies, manages vector indexes, and transforms raw data for AI consumption. Ensures data quality and optimizes batch processing for production scale. Activates for embeddings, chunking, vector index, data pipeline, batch processing, ETL, regenerate embeddings, cache warming, data transformation, data quality, vector rebuild, embedding cache", plugins: ["ork-evaluation","ork-rag"], model: "inherit", tools: [], skills: [] },
    { name: "database-engineer", description: "PostgreSQL specialist who designs schemas, creates migrations, optimizes queries, and configures pgvector/full-text search. Uses pg-aiguide MCP for best practices and produces Alembic migrations with proper constraints and indexes. Auto Mode keywords: database, schema, migration, PostgreSQL, pgvector, SQL, Alembic, index, constraint", plugins: ["ork-database"], model: "inherit", tools: [], skills: [] },
    { name: "debug-investigator", description: "Debug specialist who performs systematic root cause analysis on bugs, errors, exceptions, crashes, and failures. Uses scientific method to isolate issues, traces execution paths, analyzes logs and stack traces. Use when investigating broken functionality, debugging regressions, or analyzing flaky tests.", plugins: ["ork-core"], model: "inherit", tools: [], skills: [] },
    { name: "demo-producer", description: "Universal demo video producer that creates polished marketing videos for any content - skills, agents, plugins, tutorials, CLI tools, or code walkthroughs. Uses VHS terminal recording and Remotion composition. Activates for demo, video, marketing, showcase, terminal recording, VHS, remotion, tutorial, screencast", plugins: ["ork-video"], model: "sonnet", tools: [], skills: [] },
    { name: "deployment-manager", description: "Release and deployment specialist who manages production releases, rollback procedures, feature flags, and blue-green deployments. Focuses on zero-downtime deployments and incident response. Auto Mode keywords - deployment, release, rollback, blue-green, canary, feature flag, zero-downtime, production, rollout, incident", plugins: ["ork-devops"], model: "inherit", tools: [], skills: [] },
    { name: "documentation-specialist", description: "Technical writing and documentation expert. API docs, READMEs, technical guides, ADRs, changelogs, OpenAPI specs. Use for documentation, readme, api-docs, technical-writing, adr, changelog, openapi, swagger, doc-generation.", plugins: ["ork-core"], model: "inherit", tools: [], skills: [] },
    { name: "event-driven-architect", description: "Event-driven architecture specialist who designs event sourcing systems, message queue topologies, and CQRS patterns. Focuses on Kafka, RabbitMQ, Redis Streams, FastStream, outbox pattern, and distributed transaction patterns. Auto Mode keywords - event sourcing, message queue, Kafka, RabbitMQ, pub/sub, CQRS, event-driven, async, saga, event store, outbox, CDC, Debezium", plugins: ["ork-backend-patterns"], model: "opus", tools: [], skills: [] },
    { name: "frontend-ui-developer", description: "Frontend developer who builds React 19/TypeScript components with optimistic updates, concurrent features, Zod-validated APIs, exhaustive type safety, and modern 2026 patterns. Activates for React, TypeScript, component, UI, frontend, optimistic updates, Zod, concurrent, TSX, hook, TanStack, Suspense, skeleton, form, validation, mutation, lazy loading, view transitions, scroll animations, PWA, charts, dashboard", plugins: ["ork-react-core","ork-ui-design","ork-frontend"], model: "inherit", tools: [], skills: [] },
    { name: "git-operations-engineer", description: "Git operations specialist who manages branches, commits, rebases, merges, stacked PRs, and recovery operations. Ensures clean commit history and proper branching workflows. Auto Mode keywords - git, branch, commit, rebase, merge, stacked, recovery, reflog, cherry-pick, worktree, squash, reset", plugins: ["ork-git"], model: "inherit", tools: [], skills: [] },
    { name: "infrastructure-architect", description: "Infrastructure as Code specialist who designs Terraform modules, Kubernetes manifests, and cloud architecture. Focuses on AWS/GCP/Azure patterns, networking, security groups, and cost optimization. Auto Mode keywords - infrastructure, Terraform, Kubernetes, AWS, GCP, Azure, VPC, EKS, RDS, cloud architecture, IaC", plugins: ["ork-devops"], model: "opus", tools: [], skills: [] },
    { name: "llm-integrator", description: "LLM integration specialist who connects to OpenAI/Anthropic/Ollama APIs, designs prompt templates, implements function calling and streaming, and optimizes token costs with caching strategies. Activates for LLM, OpenAI, Anthropic, Ollama, prompt, function calling, streaming, token keywords.", plugins: ["ork-llm"], model: "inherit", tools: [], skills: [] },
    { name: "market-intelligence", description: "Market research specialist who analyzes competitive landscapes, identifies market trends, sizes opportunities (TAM/SAM/SOM), and surfaces threats/opportunities to inform product strategy. Activates for market research, competitor, TAM, SAM, SOM, market size, competitive landscape keywords.", plugins: ["ork-product"], model: "inherit", tools: [], skills: [] },
    { name: "metrics-architect", description: "Metrics specialist who designs OKRs, KPIs, success criteria, and instrumentation plans to measure product outcomes and validate hypotheses. Activates for OKR, KPI, metrics, success criteria, instrumentation keywords.", plugins: ["ork-product"], model: "opus", tools: [], skills: [] },
    { name: "monitoring-engineer", description: "Observability and monitoring specialist. Prometheus metrics, Grafana dashboards, alerting rules, distributed tracing, log aggregation, SLOs/SLIs. Use for monitoring, prometheus, grafana, alerting, tracing, opentelemetry, metrics, observability, logs, slo, sli.", plugins: ["ork-devops","ork-ai-observability"], model: "inherit", tools: [], skills: [] },
    { name: "multimodal-specialist", description: "Vision, audio, and video processing specialist who integrates GPT-5, Claude 4.5, Gemini 3, and Grok 4 for image analysis, transcription, and multimodal RAG. Activates for vision, image, audio, video, multimodal, whisper, tts, transcription, speech-to-text, document vision, OCR, captioning, CLIP, visual keywords.", plugins: ["ork-llm","ork-rag"], model: "inherit", tools: [], skills: [] },
    { name: "performance-engineer", description: "Performance engineer who optimizes Core Web Vitals, analyzes bundles, profiles render performance, and sets up RUM. Activates for performance, Core Web Vitals, LCP, INP, CLS, bundle size, Lighthouse, optimization, slow, latency, profiling, metrics, RUM, bundle, chunk, splitting, speed", plugins: ["ork-frontend"], model: "inherit", tools: [], skills: [] },
    { name: "prioritization-analyst", description: "Prioritization specialist who scores features using RICE/ICE/WSJF frameworks, analyzes opportunity costs, manages backlog ranking, and recommends what to build next based on value and effort. Activates for RICE, ICE, WSJF, prioritization, backlog, opportunity cost keywords.", plugins: ["ork-product"], model: "inherit", tools: [], skills: [] },
    { name: "product-strategist", description: "Product strategy specialist who validates value propositions, aligns features with business goals, evaluates build/buy/partner decisions, and recommends go/no-go with strategic rationale. Activates for product strategy, value proposition, build/buy/partner, go/no-go", plugins: ["ork-product"], model: "inherit", tools: [], skills: [] },
    { name: "prompt-engineer", description: "Expert prompt designer and optimizer. Chain-of-thought, few-shot learning, structured outputs, prompt versioning, A/B testing, cost optimization. Use for prompts, prompt-engineering, cot, few-shot, prompt design, prompt optimization, structured-output, a-b-testing, cost-optimization, prompt-testing, evaluation.", plugins: ["ork-llm"], model: "inherit", tools: [], skills: [] },
    { name: "python-performance-engineer", description: "Python performance specialist who profiles, optimizes, and benchmarks Python applications. Focuses on memory optimization, async performance, database query optimization, caching strategies, and load testing. Activates for performance, profiling, memory leak, slow query, optimization, bottleneck, benchmark, latency, throughput, cProfile, memory_profiler, scalability, connection pool, cache, N+1", plugins: ["ork-async"], model: "opus", tools: [], skills: [] },
    { name: "rapid-ui-designer", description: "UI/UX designer specializing in rapid prototyping with Tailwind CSS. Creates design systems, component specifications, responsive layouts, and accessibility-compliant mockups that bridge design and implementation. Activates for UI, UX, prototype, Tailwind, design system, component, mockup", plugins: ["ork-ui-design"], model: "inherit", tools: [], skills: [] },
    { name: "release-engineer", description: "Release and versioning specialist who manages GitHub releases, milestones, changelogs, and semantic versioning. Handles release automation and project tracking. Auto Mode keywords - release, milestone, changelog, tag, version, semver, sprint, roadmap", plugins: ["ork-devops"], model: "inherit", tools: [], skills: [] },
    { name: "requirements-translator", description: "Requirements specialist who transforms ambiguous ideas into clear PRDs, user stories with acceptance criteria, and scoped specifications ready for engineering handoff. Activates for PRD, user story, acceptance criteria, requirements, specification", plugins: ["ork-product"], model: "inherit", tools: [], skills: [] },
    { name: "security-auditor", description: "Security specialist who scans for vulnerabilities, audits dependencies, checks OWASP Top 10 compliance, and identifies secrets/credentials in code. Returns actionable findings with severity and remediation steps. Auto Mode keywords - security, vulnerability, CVE, audit, OWASP, injection, XSS, CSRF, secrets, credentials, npm audit, pip-audit, bandit", plugins: ["ork-security"], model: "opus", tools: [], skills: [] },
    { name: "security-layer-auditor", description: "Security layer auditor who verifies defense-in-depth implementation across 8 security layers, from edge to storage, ensuring comprehensive protection. Auto Mode keywords - security layer, defense-in-depth, security audit, 8 layers", plugins: ["ork-security"], model: "opus", tools: [], skills: [] },
    { name: "system-design-reviewer", description: "System design reviewer who evaluates implementation plans against scale, data, security, UX, and coherence criteria before code is written. Auto Mode keywords: system design, architecture review, scale, security review, implementation plan", plugins: ["ork-core"], model: "opus", tools: [], skills: [] },
    { name: "test-generator", description: "Test specialist who analyzes code coverage gaps, generates unit/integration tests, and creates test fixtures. Uses MSW for API mocking and VCR.py for HTTP recording. Produces runnable tests with meaningful assertions. Activates for test, coverage, unit test, integration test, MSW, VCR, fixture", plugins: ["ork-testing"], model: "inherit", tools: [], skills: [] },
    { name: "ux-researcher", description: "User research specialist who creates personas, maps user journeys, validates design decisions, and ensures features solve real user problems through data-driven insights and behavioral analysis. Auto-activates for user research, persona, user journey, usability, user testing, insights", plugins: ["ork-ui-design"], model: "inherit", tools: [], skills: [] },
    { name: "workflow-architect", description: "Multi-agent workflow specialist who designs LangGraph pipelines, implements supervisor-worker patterns, manages state and checkpointing, and orchestrates RAG retrieval flows for complex AI systems. Auto-activates for LangGraph, workflow, supervisor, state, checkpoint, RAG, multi-agent", plugins: ["ork-langgraph"], model: "opus", tools: [], skills: [] }
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
    { id: "Memory", skill: "memory", command: "/ork:memory", hook: "Search, load, sync, visualize your knowledge", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#06b6d4", thumbnail: "thumbnails/Memory.png", thumbnailCdn: "", relatedPlugin: "ork-memory-graph", tags: ["memory","landscape","tri-terminal"] },

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

/**
 * OrchestKit Shared Data Layer
 * Single source of truth for all playground pages.
 * Uses window global (not ES modules) for file:// protocol compatibility.
 *
 * Updated for v6.0.0 two-tier plugin architecture.
 */
window.ORCHESTKIT_DATA = {
  version: "6.0.0",

  // Totals for the full ork plugin (superset)
  totals: {
    plugins: 2,
    skills: 194,      // Total unique skills (ork has all)
    agents: 36,       // Shared across both plugins
    hooks: 117,       // Shared across both plugins
    commands: 22,     // User-invocable skills (shared)
    compositions: 14  // Demo compositions for gallery
  },

  // Navigation pages for index
  pages: [
    { id: "wizard", label: "Setup Wizard", href: "setup-wizard.html", icon: "&#x2728;", description: "Interactive plugin recommendation wizard" },
    { id: "explorer", label: "Marketplace Explorer", href: "marketplace-explorer.html", icon: "&#x1f50d;", description: "Browse all plugins and agents" },
    { id: "gallery", label: "Demo Gallery", href: "demo-gallery.html", icon: "&#x1f3ac;", description: "Browse skill demo videos and compositions" }
  ],

  plugins: [
    {
      name: "orkl",
      description: "Universal toolkit — 119 skills, 36 agents, 117 hooks. Language-agnostic, works for any stack.",
      fullDescription: "The universal OrchestKit toolkit. Includes all workflow skills (implement, explore, verify, review-pr, commit), all memory skills (remember, memory, mem0, fabric), product/UX skills, accessibility, video production, and all 36 specialized agents. Language-agnostic — works for any tech stack.",
      category: "development",
      version: "6.0.0",
      skillCount: 119,
      agentCount: 36,
      hooks: 117,
      commandCount: 22,
      color: "#8b5cf6",
      required: false,
      recommended: true,
      // Sample skills for display (full list has 119)
      skills: ["implement", "explore", "verify", "review-pr", "commit", "remember", "memory", "mem0-memory", "memory-fabric", "assess", "brainstorming", "doctor", "create-pr", "fix-issue", "demo-producer", "wcag-compliance", "a11y-testing", "clean-architecture", "domain-driven-design", "owasp-top-10"],
      // All 36 agents (shared with ork)
      agents: ["accessibility-specialist", "ai-safety-auditor", "backend-system-architect", "business-case-builder", "ci-cd-engineer", "code-quality-reviewer", "data-pipeline-engineer", "database-engineer", "debug-investigator", "demo-producer", "deployment-manager", "documentation-specialist", "event-driven-architect", "frontend-ui-developer", "git-operations-engineer", "infrastructure-architect", "llm-integrator", "market-intelligence", "metrics-architect", "monitoring-engineer", "multimodal-specialist", "performance-engineer", "prioritization-analyst", "product-strategist", "prompt-engineer", "python-performance-engineer", "rapid-ui-designer", "release-engineer", "requirements-translator", "security-auditor", "security-layer-auditor", "system-design-reviewer", "test-generator", "ux-researcher", "web-research-analyst", "workflow-architect"],
      // User-invocable commands (22 total, shared with ork)
      commands: ["implement", "explore", "verify", "review-pr", "commit", "remember", "memory", "assess", "assess-complexity", "brainstorming", "doctor", "feedback", "create-pr", "fix-issue", "git-recovery-command", "worktree-coordination", "demo-producer", "help", "configure", "add-golden", "skill-evolution", "competitive-monitoring"]
    },
    {
      name: "ork",
      description: "Full specialized toolkit — 195 skills, 36 agents, 117 hooks. Adds Python, React, LLM/RAG patterns.",
      fullDescription: "The complete OrchestKit toolkit. Everything in orkl PLUS specialized patterns for Python (FastAPI, SQLAlchemy, Celery), React (RSC, TanStack, Zustand), LLM integration (function calling, streaming, fine-tuning), RAG retrieval, LangGraph workflows, and MCP server patterns.",
      category: "development",
      version: "6.0.0",
      skillCount: 195,
      agentCount: 36,
      hooks: 117,
      commandCount: 22,
      color: "#06b6d4",
      required: false,
      recommended: false,
      // Sample skills for display - includes orkl + specialized (full list has 195)
      skills: ["implement", "explore", "verify", "review-pr", "commit", "remember", "memory", "fastapi-advanced", "sqlalchemy-2-async", "celery-advanced", "pytest-advanced", "asyncio-advanced", "react-server-components-framework", "tanstack-query-advanced", "zustand-patterns", "function-calling", "llm-streaming", "prompt-engineering-suite", "rag-retrieval", "embeddings", "contextual-retrieval", "pgvector-search", "langgraph-patterns", "mcp-server-patterns"],
      // All 36 agents (shared with orkl)
      agents: ["accessibility-specialist", "ai-safety-auditor", "backend-system-architect", "business-case-builder", "ci-cd-engineer", "code-quality-reviewer", "data-pipeline-engineer", "database-engineer", "debug-investigator", "demo-producer", "deployment-manager", "documentation-specialist", "event-driven-architect", "frontend-ui-developer", "git-operations-engineer", "infrastructure-architect", "llm-integrator", "market-intelligence", "metrics-architect", "monitoring-engineer", "multimodal-specialist", "performance-engineer", "prioritization-analyst", "product-strategist", "prompt-engineer", "python-performance-engineer", "rapid-ui-designer", "release-engineer", "requirements-translator", "security-auditor", "security-layer-auditor", "system-design-reviewer", "test-generator", "ux-researcher", "web-research-analyst", "workflow-architect"],
      // User-invocable commands (22 total, shared with orkl)
      commands: ["implement", "explore", "verify", "review-pr", "commit", "remember", "memory", "assess", "assess-complexity", "brainstorming", "doctor", "feedback", "create-pr", "fix-issue", "git-recovery-command", "worktree-coordination", "demo-producer", "help", "configure", "add-golden", "skill-evolution", "competitive-monitoring"]
    }
  ],

  agents: [
    { name: "accessibility-specialist", description: "Accessibility expert who audits and implements WCAG 2.2 compliance, screen reader compatibility, and keyboard navigation patterns.", plugins: ["orkl", "ork"], model: "inherit", category: "frontend" },
    { name: "ai-safety-auditor", description: "AI safety and security auditor for LLM systems. Red teaming, prompt injection, jailbreak testing, guardrail validation.", plugins: ["orkl", "ork"], model: "opus", category: "security" },
    { name: "backend-system-architect", description: "Backend architect who designs REST/GraphQL APIs, database schemas, microservice boundaries, and distributed systems.", plugins: ["orkl", "ork"], model: "opus", category: "backend" },
    { name: "business-case-builder", description: "Business analyst who builds ROI projections, cost-benefit analyses, and investment justifications.", plugins: ["orkl", "ork"], model: "inherit", category: "product" },
    { name: "ci-cd-engineer", description: "CI/CD specialist who designs GitHub Actions workflows and automated deployment strategies.", plugins: ["orkl", "ork"], model: "inherit", category: "devops" },
    { name: "code-quality-reviewer", description: "Quality assurance expert who reviews code for bugs, security vulnerabilities, and performance issues.", plugins: ["orkl", "ork"], model: "inherit", category: "testing" },
    { name: "data-pipeline-engineer", description: "Data pipeline specialist who generates embeddings, implements chunking strategies, and manages vector indexes.", plugins: ["orkl", "ork"], model: "inherit", category: "data" },
    { name: "database-engineer", description: "PostgreSQL specialist who designs schemas, creates migrations, and optimizes queries.", plugins: ["orkl", "ork"], model: "inherit", category: "backend" },
    { name: "debug-investigator", description: "Debug specialist who performs systematic root cause analysis on bugs and errors.", plugins: ["orkl", "ork"], model: "inherit", category: "testing" },
    { name: "demo-producer", description: "Universal demo video producer for polished marketing videos using VHS and Remotion.", plugins: ["orkl", "ork"], model: "sonnet", category: "development" },
    { name: "deployment-manager", description: "Release specialist who manages production deployments, rollbacks, and feature flags.", plugins: ["orkl", "ork"], model: "inherit", category: "devops" },
    { name: "documentation-specialist", description: "Technical writing expert for API docs, READMEs, ADRs, and changelogs.", plugins: ["orkl", "ork"], model: "inherit", category: "development" },
    { name: "event-driven-architect", description: "Event-driven architecture specialist for Kafka, RabbitMQ, CQRS, and saga patterns.", plugins: ["orkl", "ork"], model: "opus", category: "backend" },
    { name: "frontend-ui-developer", description: "Frontend developer for React 19/TypeScript with optimistic updates and modern patterns.", plugins: ["orkl", "ork"], model: "inherit", category: "frontend" },
    { name: "git-operations-engineer", description: "Git specialist for branches, rebases, stacked PRs, and recovery operations.", plugins: ["orkl", "ork"], model: "inherit", category: "development" },
    { name: "infrastructure-architect", description: "IaC specialist for Terraform, Kubernetes, and cloud architecture.", plugins: ["orkl", "ork"], model: "opus", category: "devops" },
    { name: "llm-integrator", description: "LLM integration specialist for OpenAI/Anthropic APIs, prompt templates, and streaming.", plugins: ["orkl", "ork"], model: "inherit", category: "ai" },
    { name: "market-intelligence", description: "Market research specialist for competitive analysis and TAM/SAM/SOM sizing.", plugins: ["orkl", "ork"], model: "inherit", category: "product" },
    { name: "metrics-architect", description: "Metrics specialist for OKRs, KPIs, and instrumentation plans.", plugins: ["orkl", "ork"], model: "opus", category: "product" },
    { name: "monitoring-engineer", description: "Observability specialist for Prometheus, Grafana, and distributed tracing.", plugins: ["orkl", "ork"], model: "inherit", category: "devops" },
    { name: "multimodal-specialist", description: "Vision and audio processing specialist for multimodal AI integration.", plugins: ["orkl", "ork"], model: "inherit", category: "ai" },
    { name: "performance-engineer", description: "Performance engineer for Core Web Vitals, bundle analysis, and render optimization.", plugins: ["orkl", "ork"], model: "inherit", category: "frontend" },
    { name: "prioritization-analyst", description: "Prioritization specialist using RICE/ICE/WSJF frameworks.", plugins: ["orkl", "ork"], model: "inherit", category: "product" },
    { name: "product-strategist", description: "Product strategy specialist for value propositions and go/no-go decisions.", plugins: ["orkl", "ork"], model: "inherit", category: "product" },
    { name: "prompt-engineer", description: "Expert prompt designer for chain-of-thought, few-shot, and structured outputs.", plugins: ["orkl", "ork"], model: "inherit", category: "ai" },
    { name: "python-performance-engineer", description: "Python performance specialist for profiling, async optimization, and caching.", plugins: ["orkl", "ork"], model: "opus", category: "backend" },
    { name: "rapid-ui-designer", description: "UI/UX designer for Tailwind prototyping and design systems.", plugins: ["orkl", "ork"], model: "inherit", category: "frontend" },
    { name: "release-engineer", description: "Release specialist for GitHub releases, milestones, and semantic versioning.", plugins: ["orkl", "ork"], model: "inherit", category: "devops" },
    { name: "requirements-translator", description: "Requirements specialist for PRDs and user stories with acceptance criteria.", plugins: ["orkl", "ork"], model: "inherit", category: "product" },
    { name: "security-auditor", description: "Security specialist for vulnerability scanning and OWASP compliance.", plugins: ["orkl", "ork"], model: "opus", category: "security" },
    { name: "security-layer-auditor", description: "Security auditor for defense-in-depth across 8 layers.", plugins: ["orkl", "ork"], model: "opus", category: "security" },
    { name: "system-design-reviewer", description: "System design reviewer for architecture evaluation.", plugins: ["orkl", "ork"], model: "opus", category: "development" },
    { name: "test-generator", description: "Test specialist for coverage analysis and test fixture generation.", plugins: ["orkl", "ork"], model: "inherit", category: "testing" },
    { name: "ux-researcher", description: "User research specialist for personas and journey mapping.", plugins: ["orkl", "ork"], model: "inherit", category: "frontend" },
    { name: "web-research-analyst", description: "Web research specialist for browser automation and competitive intelligence.", plugins: ["orkl", "ork"], model: "inherit", category: "research" },
    { name: "workflow-architect", description: "Multi-agent workflow specialist for LangGraph and supervisor patterns.", plugins: ["orkl", "ork"], model: "opus", category: "ai" }
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
    data:        { color: "#6366f1", label: "Data" },
    research:    { color: "#14b8a6", label: "Research" }
  },

  // Skills summary for the two-tier system
  skillsSummary: {
    "orkl": {
      workflows: ["implement", "explore", "verify", "review-pr", "commit", "doctor", "feedback", "worktree-coordination"],
      memory: ["remember", "memory", "mem0-memory", "memory-fabric"],
      product: ["assess", "assess-complexity", "brainstorming", "requirements-engineering", "prioritization-frameworks"],
      git: ["create-pr", "fix-issue", "git-recovery-command", "stacked-prs"],
      video: ["demo-producer", "video-storyboarding", "remotion-composer"],
      accessibility: ["wcag-compliance", "a11y-testing", "focus-management"],
      devops: ["devops-deployment", "observability-monitoring", "github-operations"]
    },
    "ork": {
      includesAllOrkLite: true,
      python: ["fastapi-advanced", "sqlalchemy-2-async", "celery-advanced", "pytest-advanced", "asyncio-advanced"],
      react: ["react-server-components-framework", "tanstack-query-advanced", "zustand-patterns", "form-state-patterns"],
      llm: ["function-calling", "llm-streaming", "prompt-engineering-suite", "fine-tuning-customization"],
      rag: ["rag-retrieval", "embeddings", "contextual-retrieval", "pgvector-search", "semantic-caching"],
      backend: ["clean-architecture", "domain-driven-design", "cqrs-patterns", "event-sourcing", "saga-patterns"]
    }
  },

  // Demo compositions (updated plugin references)
  compositions: [
    { id: "Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#8b5cf6", relatedPlugin: "orkl", tags: ["core","landscape","tri-terminal"] },
    { id: "Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#22c55e", relatedPlugin: "orkl", tags: ["core","landscape","tri-terminal"] },
    { id: "Commit", skill: "commit", command: "/ork:commit", hook: "Conventional commits in seconds", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", relatedPlugin: "orkl", tags: ["core","landscape","tri-terminal"] },
    { id: "Explore", skill: "explore", command: "/ork:explore", hook: "Understand codebases in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", relatedPlugin: "orkl", tags: ["core","landscape","tri-terminal"] },
    { id: "Remember", skill: "remember", command: "/ork:remember", hook: "Build your team's knowledge base", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#8b5cf6", relatedPlugin: "orkl", tags: ["memory","landscape","tri-terminal"] },
    { id: "Memory", skill: "memory", command: "/ork:memory", hook: "Search, load, sync, visualize your knowledge", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#06b6d4", relatedPlugin: "orkl", tags: ["memory","landscape","tri-terminal"] },
    { id: "ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#f97316", relatedPlugin: "orkl", tags: ["review","landscape","tri-terminal"] },
    { id: "CreatePR", skill: "create-pr", command: "/ork:create-pr", hook: "PRs that pass review the first time", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#22c55e", relatedPlugin: "orkl", tags: ["review","landscape","tri-terminal"] },
    { id: "FixIssue", skill: "fix-issue", command: "/ork:fix-issue", hook: "From bug report to merged fix in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#ef4444", relatedPlugin: "orkl", tags: ["review","landscape","tri-terminal"] },
    { id: "Doctor", skill: "doctor", command: "/ork:doctor", hook: "Health diagnostics for OrchestKit systems", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#ef4444", relatedPlugin: "orkl", tags: ["devops","landscape","tri-terminal"] },
    { id: "Configure", skill: "configure", command: "/ork:configure", hook: "Your AI toolkit, your rules", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#f59e0b", relatedPlugin: "orkl", tags: ["devops","landscape","tri-terminal"] },
    { id: "Brainstorming", skill: "brainstorming", command: "/ork:brainstorming", hook: "Generate ideas in parallel. 4 specialists.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#f59e0b", relatedPlugin: "orkl", tags: ["ai","landscape","tri-terminal"] },
    { id: "Assess", skill: "assess", command: "/ork:assess", hook: "Evaluate quality across 6 dimensions", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#22c55e", relatedPlugin: "orkl", tags: ["ai","landscape","tri-terminal"] },
    { id: "DemoProducer", skill: "demo-producer", command: "/ork:demo-producer", hook: "Professional demos in minutes, not days", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#ec4899", relatedPlugin: "orkl", tags: ["advanced","landscape","tri-terminal"] }
  ]
};

# Marketplace Plugin Architecture Research

## Executive Summary

**Current State:** Single monolithic plugin (`ork`) with 159 skills, 34 agents, 144 hooks  
**Recommended:** Split into 14 focused plugins + 2 optional (16 total)  
**Rationale:** Better modularity, faster adoption, clearer value proposition, reduced context bloat. AI/LLM split into 5 focused plugins (RAG, LangGraph, LLM Core, Observability, plus separate Data & Eval) instead of one 27-skill monolith.

---

## Research Findings

### 1. Claude Code Plugin Best Practices

Based on marketplace analysis and Claude Code documentation:

**✅ Separate Plugins Are Preferred When:**
- Distributing through marketplace
- Sharing functionality across teams/projects
- Need version control per domain
- Want users to install only what they need
- Skills are logically grouped by domain

**❌ Monolithic Plugin Works When:**
- Single-project customization
- Personal/experimental configuration
- Tightly coupled functionality
- All-or-nothing installation model

### 2. Reference Implementation Analysis

The `dev-utils-marketplace` demonstrates the modular approach:
- **15 focused plugins** organized by domain
- Each plugin: 5-20 skills, clear purpose
- Independent versioning and updates
- Users install only needed domains

**Key Insight:** Users prefer installing `ork-ai`, `ork-backend`, `ork-frontend` separately rather than one 159-skill monolith.

---

## Current Structure Analysis

### Skill Distribution (159 total)

| Domain | Count | Key Skills |
|--------|-------|------------|
| **AI/LLM** | 27 | RAG, embeddings, LangGraph, agents, caching, observability |
| **Data Engineering** | 6 | pgvector-search, golden-dataset-* (3), test-data-management, embeddings |
| **Evaluation** | 4 | llm-evaluation, golden-dataset-curation, golden-dataset-management, golden-dataset-validation |
| **Product** | 0 | (Product agents only, no standalone skills) |
| **Backend** | 19 | FastAPI, SQLAlchemy, asyncio, connection pooling, idempotency |
| **Frontend** | 23 | React 19, design systems, animations, performance, PWA |
| **Testing** | 10 | Unit, integration, E2E, mocking, property-based |
| **Security** | 5 | OWASP, auth, validation, defense-in-depth, scanning |
| **DevOps** | 10 | CI/CD, observability, migrations, versioning, releases |
| **Git/GitHub** | 6 | Workflow, PRs, milestones, stacked PRs, recovery |
| **Quality** | 4 | Quality gates, reviews (golden datasets moved to evaluation) |
| **Context** | 6 | Compression, engineering, brainstorming, planning |
| **Event-Driven** | 3 | Event sourcing, message queues, outbox |
| **Database** | 3 | Alembic, zero-downtime, versioning |
| **Accessibility** | 3 | WCAG, focus management, React ARIA |
| **MCP** | 2 | Advanced patterns, server building |
| **Workflows** | 13 | Git, PR, implementation, exploration, HUD |
| **Other** | 21 | ADR, ascii-visualizer, best-practices, etc. |

### Agent Distribution (34 total)

| Domain | Count | Agents |
|--------|-------|--------|
| **Backend** | 6 | backend-system-architect, database-engineer, event-driven-architect, etc. |
| **Frontend** | 5 | frontend-ui-developer, performance-engineer, accessibility-specialist, etc. |
| **AI/ML** | 5 | llm-integrator, workflow-architect, ai-safety-auditor, prompt-engineer, multimodal-specialist |
| **Data Engineering** | 1 | data-pipeline-engineer |
| **Product** | 4 | product-strategist, business-case-builder, prioritization-analyst, market-intelligence |
| **Testing** | 2 | test-generator, (e2e-specialist merged) |
| **DevOps** | 3 | infrastructure-architect, ci-cd-engineer, deployment-manager |
| **Quality** | 3 | code-quality-reviewer, (quality-engineer merged) |
| **Other** | 9 | Various specialized agents (metrics-architect, requirements-translator, etc.) |

### Hook Distribution (144 total)

| Category | Count | Purpose |
|----------|-------|---------|
| **Lifecycle** | 17 | Session start/end, initialization |
| **PreTool** | 33 | Validation before tool execution |
| **PostTool** | 22 | Logging, metrics after execution |
| **Permission** | 4 | Auto-approval for safe operations |
| **Stop** | 11 | Conversation end handlers |
| **Setup** | 7 | Initialization and maintenance |
| **Other** | 50 | Notification, skill, subagent hooks |

---

## Proposed Plugin Architecture

### Option A: Domain-Based Split (Recommended)

**14 Core Plugins + 2 Optional:**

1. **`ork-core`** (Foundation)
   - Skills: 15 (best-practices, brainstorming, context-*, quality-gates, etc.)
   - Agents: 2 (general-purpose)
   - Hooks: 20 (lifecycle, setup, coordination)
   - **Purpose:** Essential infrastructure, always installed

2. **`ork-ai`** (AI/LLM)
   - Skills: 27 (RAG, embeddings, LangGraph, agents, caching, observability)
   - Agents: 5 (llm-integrator, workflow-architect, ai-safety-auditor, etc.)
   - Hooks: 8 (AI-specific lifecycle hooks)
   - **Purpose:** AI/ML development patterns

9. **`ork-backend`** (Backend)
   - Skills: 19 (FastAPI, SQLAlchemy, asyncio, connection pooling, etc.)
   - Agents: 6 (backend-system-architect, database-engineer, etc.)
   - Hooks: 15 (backend validation, API hooks)
   - **Purpose:** Backend development patterns

10. **`ork-frontend`** (Frontend)
   - Skills: 23 (React 19, design systems, animations, performance, PWA)
   - Agents: 5 (frontend-ui-developer, performance-engineer, etc.)
   - Hooks: 12 (frontend validation, build hooks)
   - **Purpose:** Frontend development patterns

11. **`ork-testing`** (Testing)
   - Skills: 10 (unit, integration, E2E, mocking, property-based)
   - Agents: 4 (test-engineer, e2e-specialist, etc.)
   - Hooks: 10 (test execution, coverage hooks)
   - **Purpose:** Testing frameworks and patterns

12. **`ork-security`** (Security)
   - Skills: 5 (OWASP, auth, validation, defense-in-depth, scanning)
   - Agents: 1 (security-auditor)
   - Hooks: 18 (security validation, secret detection)
   - **Purpose:** Security best practices

13. **`ork-devops`** (DevOps)
   - Skills: 10 (CI/CD, observability, migrations, versioning, releases)
   - Agents: 3 (infrastructure-architect, etc.)
   - Hooks: 12 (deployment, monitoring hooks)
   - **Purpose:** DevOps and infrastructure

14. **`ork-git`** (Git/GitHub)
   - Skills: 6 (workflow, PRs, milestones, stacked PRs, recovery)
   - Agents: 0
   - Hooks: 25 (git validation, branch protection, commit hooks)
   - **Purpose:** Git workflow automation

**Optional Add-ons:**

15. **`ork-memory`** (Memory Management)
   - Skills: 3 (mem0-memory, mem0-sync, memory-fabric)
   - Agents: 0
   - Hooks: 8 (memory lifecycle hooks)
   - **Purpose:** Cross-session memory (optional)

16. **`ork-workflows`** (Workflows)
    - Skills: 13 (implementation, exploration, verify, fix-issue, etc.)
    - Agents: 0
    - Hooks: 5 (workflow orchestration)
    - **Purpose:** High-level workflow commands

### Option B: Size-Based Split

**Smaller, more granular plugins (12-15 plugins):**
- Split AI into: `ork-rag`, `ork-langgraph`, `ork-agents`
- Split Backend into: `ork-fastapi`, `ork-database`, `ork-async`
- Split Frontend into: `ork-react`, `ork-performance`, `ork-ui`

**Pros:** More granular control  
**Cons:** More plugins to manage, potential dependency complexity

### Option C: Hybrid Approach (Recommended)

**Core + Domain Plugins:**

- **`ork-core`**: Always installed, foundation (15 skills, 2 agents, 20 hooks)
- **Domain plugins**: Install as needed (ork-ai, ork-backend, ork-frontend, etc.)
- **Optional plugins**: Advanced features (ork-memory, ork-workflows)

**Installation Model:**
```bash
# Minimal install
/plugin install ork-core

# Full-stack developer
/plugin install ork-core ork-backend ork-frontend ork-testing

# AI/ML developer (RAG focus)
/plugin install ork-core ork-rag ork-llm-core ork-backend ork-testing

# AI/ML developer (LangGraph focus)
/plugin install ork-core ork-langgraph ork-llm-core ork-ai-observability ork-backend

# Data engineer
/plugin install ork-core ork-data ork-eval ork-backend

# Product manager
/plugin install ork-core ork-product

# DevOps engineer
/plugin install ork-core ork-devops ork-security ork-git
```

---

## Implementation Strategy

### Phase 1: Preparation (Week 1)

1. **Audit Dependencies**
   - Map skill dependencies (which skills reference others)
   - Identify shared hooks (used by multiple domains)
   - Document agent-skill relationships

2. **Create Plugin Structure**
   ```
   plugins/
   ├── ork-core/
   │   ├── .claude/
   │   │   ├── skills/
   │   │   ├── agents/
   │   │   └── hooks/
   │   └── plugin.json
   ├── ork-ai/
   ├── ork-backend/
   ├── ork-frontend/
   └── ...
   ```

3. **Update Marketplace Schema**
   - Verify `.claude-plugin/marketplace.json` supports multiple plugins
   - Add plugin dependency metadata if needed

### Phase 2: Core Plugin (Week 2)

1. **Extract `ork-core`**
   - Move foundation skills (15)
   - Move essential agents (2)
   - Move lifecycle/setup hooks (20)
   - Test standalone installation

2. **Update Documentation**
   - Migration guide for existing users
   - Installation instructions per plugin

### Phase 3: Domain Plugins (Weeks 3-5)

1. **Extract Domain Plugins** (one per week)
   - Week 3: `ork-ai`
   - Week 4: `ork-backend`
   - Week 5: `ork-frontend`

2. **Handle Dependencies**
   - Core skills referenced by domains → keep in core or duplicate
   - Shared hooks → move to core or create shared package

### Phase 4: Migration & Testing (Week 6)

1. **Update Marketplace**
   - Add all plugins to `.claude-plugin/marketplace.json`
   - Test installation of each plugin
   - Test plugin combinations

2. **User Migration**
   - Provide migration script: `ork-monolith` → `ork-core + ork-*`
   - Update README with new installation model
   - Deprecate monolithic `ork` plugin (with migration path)

### Phase 5: Documentation & Launch (Week 7)

1. **Documentation**
   - Plugin comparison matrix
   - Installation guide per use case
   - FAQ for plugin selection

2. **Launch**
   - Release all plugins simultaneously
   - Announce migration path
   - Monitor adoption metrics

---

## Technical Considerations

### 1. Skill Dependencies

**Problem:** Some skills reference others (e.g., `api-design-framework` references `auth-patterns`)

**Solutions:**
- **Option A:** Keep shared skills in `ork-core`
- **Option B:** Document dependencies, require both plugins
- **Option C:** Duplicate minimal shared content (not recommended)

**Recommendation:** Option A - move commonly referenced skills to core

### 2. Hook Sharing

**Problem:** Some hooks are used across domains (e.g., `file-guard.sh`)

**Solutions:**
- **Option A:** Keep shared hooks in `ork-core`
- **Option B:** Duplicate hooks in each plugin (not recommended)
- **Option C:** Create `ork-hooks` plugin (adds complexity)

**Recommendation:** Option A - essential hooks in core

### 3. Agent-Skill Relationships

**Problem:** Agents reference specific skills in their frontmatter

**Solutions:**
- **Option A:** Agents only reference skills in same plugin
- **Option B:** Agents can reference skills from other installed plugins
- **Option C:** Create agent variants per plugin

**Recommendation:** Option B - Claude Code supports cross-plugin skill references

### 4. Version Management

**Challenge:** Independent versioning per plugin

**Solution:**
- Use semantic versioning per plugin
- Document compatibility matrix
- Core plugin version drives major compatibility

### 5. Namespace Conflicts

**Current:** Skills use flat names (`api-design-framework`)  
**With Plugins:** Skills are namespaced (`ork-backend:api-design-framework`)

**Impact:** Minimal - Claude Code handles namespacing automatically

---

## Migration Path for Users

### Current Users (Monolithic)

```bash
# Current installation
/plugin install ork

# Migration (automatic via script - installs all plugins)
/plugin install ork-core ork-rag ork-langgraph ork-llm-core ork-ai-observability ork-data ork-eval ork-product ork-backend ork-frontend ork-testing ork-security ork-devops ork-git

# Or minimal (core + most common)
/plugin install ork-core ork-backend ork-frontend ork-testing

# Or AI-focused minimal
/plugin install ork-core ork-rag ork-llm-core ork-backend
```

### New Users

```bash
# Start with core
/plugin install ork-core

# Add domains as needed
/plugin install ork-backend
/plugin install ork-frontend
```

### Migration Script

Create `bin/migrate-to-plugins.sh`:
```bash
#!/usr/bin/env bash
# Migrates from monolithic ork to modular plugins

echo "Migrating from ork (monolithic) to modular plugins..."
echo "This will install all 14 core plugins + 2 optional"

# Uninstall monolithic
/plugin uninstall ork

# Install all modular plugins (full feature set)
/plugin install ork-core ork-rag ork-langgraph ork-llm-core ork-ai-observability ork-data ork-eval ork-product ork-backend ork-frontend ork-testing ork-security ork-devops ork-git ork-memory ork-workflows
```

---

## Benefits Analysis

### User Benefits

| Benefit | Impact |
|---------|--------|
| **Faster Installation** | Install only needed domains (50-70% faster) |
| **Reduced Context** | Smaller system prompts per plugin (30-50% reduction) |
| **Clearer Value** | Understand what each plugin provides |
| **Gradual Adoption** | Start with core, add domains incrementally |
| **Better Performance** | Less context = faster responses |

### Maintainer Benefits

| Benefit | Impact |
|---------|--------|
| **Independent Versioning** | Update AI patterns without touching backend |
| **Focused Development** | Work on one domain without affecting others |
| **Easier Testing** | Test plugins in isolation |
| **Clearer Ownership** | Each plugin has clear scope |

### Marketplace Benefits

| Benefit | Impact |
|---------|--------|
| **Better Discovery** | Users find plugins by domain |
| **Higher Adoption** | Lower barrier to entry (start with core) |
| **More Installations** | Multiple plugin installs per user |
| **Better Metrics** | Track adoption per domain |

---

## Risks & Mitigations

### Risk 1: User Confusion

**Risk:** Users don't know which plugins to install

**Mitigation:**
- Clear documentation with use-case examples
- "Quick Start" guide recommending core + 2-3 domains
- Migration script for existing users

### Risk 2: Dependency Management

**Risk:** Skills in different plugins reference each other

**Mitigation:**
- Audit dependencies before split
- Keep commonly referenced skills in core
- Document cross-plugin dependencies

### Risk 3: Version Compatibility

**Risk:** Plugin versions get out of sync

**Mitigation:**
- Compatibility matrix in README
- Core plugin version as compatibility anchor
- Automated testing for plugin combinations

### Risk 4: Maintenance Overhead

**Risk:** More plugins = more maintenance

**Mitigation:**
- Shared CI/CD pipeline
- Automated testing across plugins
- Clear ownership per plugin

---

## Recommendation

**✅ Proceed with Option A: Domain-Based Split (Revised)**

1. **Create `ork-core`** (foundation, always installed)
2. **Split AI/LLM into 5 focused plugins:**
   - `ork-rag` (RAG & retrieval patterns)
   - `ork-langgraph` (LangGraph & multi-agent)
   - `ork-llm-core` (core LLM integration)
   - `ork-ai-observability` (cost tracking, tracing)
   - Plus separate `ork-data` (data engineering) and `ork-eval` (evaluation)
3. **Create 7 domain plugins** (product, backend, frontend, testing, security, devops, git)
4. **Create 2 optional plugins** (memory, workflows)
5. **Maintain backward compatibility** (migration path for monolithic users)

**Total:** 14 core plugins + 2 optional = 16 plugins

**Timeline:** 7-8 weeks (extra week for AI/LLM split complexity)  
**Effort:** Medium-High (requires careful dependency mapping, especially for AI skills)  
**Impact:** High (better UX, faster adoption, clearer value, reduced AI/LLM context bloat)

---

## Next Steps

1. **Review this document** with team
2. **Audit dependencies** (skill → skill, agent → skill, hook → skill)
3. **Create proof-of-concept** (extract `ork-core` first)
4. **Test installation** of core plugin standalone
5. **Iterate** based on feedback

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-21  
**Author:** Research Analysis

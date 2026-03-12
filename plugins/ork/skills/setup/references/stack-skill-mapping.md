# Stack-to-Skill Mapping

Maps detected technologies to recommended OrchestKit skills.

## Language/Framework Mapping

| Detected | Recommended Skills |
|----------|--------------------|
| Python | `python-backend`, `async-jobs`, `database-patterns` |
| FastAPI | `api-design`, `testing-unit`, `testing-integration` |
| React | `react-server-components-framework`, `ui-components`, `responsive-patterns` |
| Next.js | `react-server-components-framework`, `performance`, `vite-advanced` |
| Zustand | `zustand-patterns` |
| SQLAlchemy/Alembic | `database-patterns` |
| Docker/K8s | `devops-deployment`, `distributed-systems` |
| Terraform | `devops-deployment` |
| GitHub Actions | `devops-deployment` |
| LLM/AI deps | `llm-integration`, `rag-retrieval`, `langgraph`, `mcp-patterns` |
| Test frameworks | `testing-unit`, `testing-e2e`, `testing-integration`, `golden-dataset` |
| Security concerns | `security-patterns` |

**All stacks get**: `explore`, `implement`, `verify`, `commit`, `review-pr`, `fix-issue`, `doctor`, `remember`, `brainstorm`, `help`

## MCP Recommendation Matrix

| MCP | When to Recommend | Install Effort |
|-----|-------------------|---------------|
| **Context7** | Always — eliminates doc hallucination | Zero (cloud, free) |
| **Memory** | Always — knowledge graph persistence | Low (local npx) |
| **Sequential Thinking** | If using Sonnet/Haiku subagents | Low (local npx) |
| **Tavily** | If web-research-workflow relevant | Medium (needs API key, free tier) |
| **NotebookLM** | If many docs/READMEs for team RAG | Medium (Google auth) |
| **Agentation** | If frontend UI work detected | Medium (npm install) |
| **Phoenix/Langfuse** | If LLM observability desired | Medium (Docker, optional) |

Present as toggles with impact labels. Show install commands for selected MCPs.

## Custom Skill Suggestions

Based on pattern detection from Phase 1 scan:

```
Detected patterns that could become custom skills:
  47 API routes   → Create "api-endpoint" skill
  83 React comps  → Create "component" skill
  8 deploy steps  → Create "deploy-checklist" skill

To create any of these: see CONTRIBUTING-SKILLS.md
```

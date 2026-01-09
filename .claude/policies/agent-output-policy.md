# Agent Output Policy

**Version**: 1.0
**Effective**: 2025-12-29
**Applies to**: All Claude Code subagents and skills

---

## 4-Tier Persistence Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT OUTPUT TIERS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TIER 1: EPHEMERAL (Default)                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Return analysis inline to orchestrator                          │   │
│  │ • DO NOT write files                                              │   │
│  │ • Lifespan: Single response                                       │   │
│  │ • Use for: Brainstorm agents, analysis, recommendations          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  TIER 2: SESSION (Memory MCP)                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • mcp__memory__create_entities() for conversation state           │   │
│  │ • Lifespan: ~1 hour (conversation-scoped)                         │   │
│  │ • Use for: "What did I decide 10 min ago?"                        │   │
│  │ • WARNING: Does NOT reliably survive context closure!             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  TIER 3: PATTERNS (Context Files)                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Location: .claude/context/patterns/{feature}.md                 │   │
│  │ • Max size: 1000 lines per file                                   │   │
│  │ • Lifespan: 90 days (auto-archive if unused)                      │   │
│  │ • Use for: Reusable code templates, implementation patterns       │   │
│  │ • Requires: Explicit user request OR extracted from implementation│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  TIER 4: DECISIONS (session/state.json (Context Protocol 2.0))                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Location: .claude/context/session/state.json (Context Protocol 2.0)                   │   │
│  │ • Max size: 2000 lines total                                      │   │
│  │ • Lifespan: Permanent                                             │   │
│  │ • Use for: Architecture decisions, "Why did we choose X?"         │   │
│  │ • Format: agent_decisions.{agent_name}                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Creation Rules

### ALLOWED File Outputs

| Location | When | Max Size | Content Type |
|----------|------|----------|--------------|
| `.claude/context/patterns/` | Extracting reusable patterns | 1000 lines | Code templates, integration patterns |
| `.claude/context/session/state.json (Context Protocol 2.0)` | Recording decisions | 2000 lines | Architectural decisions with rationale |
| `docs/issues/{num}/` | AFTER PR merge | 200 lines | Final architecture summary |

### FORBIDDEN File Outputs

❌ **Never create these files:**

```
# During implementation (these become stale immediately)
.claude/context/architecture-analysis-*.md
.claude/context/implementation-plan-*.md
.claude/context/decision-log-*.md
.claude/context/role-comm-*.md

# Ad-hoc analysis files
.claude/context/*-review.md
.claude/context/*-strategy.md
.claude/context/*-plan.md

# Files outside designated locations
docs/*.md (except docs/issues/{num}/)
*.md in root directories
```

---

## Agent Prompt Directive

**Add to all agent prompts:**

```markdown
## OUTPUT POLICY (MANDATORY)

🚫 **DO NOT create files** unless explicitly instructed.

Output rules:
1. Return all analysis as TEXT in your response
2. Use code blocks for examples
3. Use ASCII art for diagrams
4. Keep output under 1000 words

If you need to persist information:
- Session state → Memory MCP (mcp__memory__create_entities)
- Reusable patterns → Request user approval first
- Decisions → Update session/state.json (Context Protocol 2.0) agent_decisions section
```

---

## Enforcement Mechanisms

### 1. Pre-Commit Hook (Recommended)

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check session/state.json (Context Protocol 2.0) size
CONTEXT_LINES=$(wc -l < .claude/context/session/state.json (Context Protocol 2.0) 2>/dev/null || echo 0)
if [ "$CONTEXT_LINES" -gt 2000 ]; then
  echo "❌ session/state.json (Context Protocol 2.0) exceeds 2000 lines ($CONTEXT_LINES)"
  echo "Archive old decisions to docs/decisions/"
  exit 1
fi

# Check for forbidden file patterns
FORBIDDEN_FILES=$(git diff --cached --name-only | grep -E "\.claude/context/(architecture|implementation|decision|role-comm)" || true)
if [ -n "$FORBIDDEN_FILES" ]; then
  echo "❌ Forbidden files detected:"
  echo "$FORBIDDEN_FILES"
  echo "Use patterns/ for reusable code, session/state.json (Context Protocol 2.0) for decisions"
  exit 1
fi
```

### 2. Pattern File Size Check

```bash
# Check pattern files don't exceed 1000 lines
for file in .claude/context/patterns/*.md; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt 1000 ]; then
    echo "❌ $file exceeds 1000 lines ($lines)"
    exit 1
  fi
done
```

---

## Migration Checklist

When cleaning up existing files:

- [ ] Move valuable patterns to `.claude/context/patterns/`
- [ ] Extract decisions to `session/state.json (Context Protocol 2.0)`
- [ ] Delete ad-hoc analysis files
- [ ] Verify pattern files under 1000 lines
- [ ] Update agent prompts with output policy

---

## Quick Reference

```
┌────────────────────────────────────────────────────────────┐
│                    AGENT OUTPUT DECISION TREE              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Is this analysis/brainstorming?                          │
│  └─ YES → Return inline (Tier 1) ✅                       │
│                                                            │
│  Is this conversation state I need later?                  │
│  └─ YES → Memory MCP (Tier 2) ✅                          │
│                                                            │
│  Is this a reusable code pattern?                          │
│  └─ YES → patterns/{feature}.md (Tier 3) ✅               │
│           • Max 1000 lines                                 │
│           • Requires user approval                         │
│                                                            │
│  Is this an architectural decision?                        │
│  └─ YES → session/state.json (Context Protocol 2.0) (Tier 4) ✅                 │
│                                                            │
│  Everything else → DO NOT CREATE FILES ❌                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

*Policy created based on brainstorming session 2025-12-29*
*Addresses: Agent file pollution, inter-agent communication, context persistence*

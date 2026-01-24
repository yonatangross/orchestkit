# CC 2.1.19 Improvement Opportunities for OrchestKit

## Status: DRAFT - Brainstorming in Progress

---

## Already Leveraging (✅)

- Task Management (2.1.16) - TaskCreate/TaskUpdate in skills
- `additionalContext` (2.1.9) - Hooks inject context
- `auto:N` MCP syntax (2.1.9) - MCP thresholds
- `context_window.used_percentage` (2.1.6) - HUD statusline
- Setup hooks (2.1.10) - `--init`, `--maintenance`
- `user-invocable` skills (2.1.3) - 22 skills
- Wildcard permissions (2.1.0) - `Bash(npm *)` patterns
- Sub-agent context forking (2.1.0) - `context: fork`

---

## Not Leveraging Yet

### Tier 1: High Impact

| Feature | Version | Opportunity |
|---------|---------|-------------|
| Indexed arguments | 2.1.19 | `$ARGUMENTS[0]` for cleaner arg parsing |
| Skill-specific hooks | 2.1.0 | PreToolUse/PostToolUse per skill |
| `plansDirectory` | 2.1.9 | Store plans in `.claude/plans` |
| `agent_type` in SessionStart | 2.1.2 | Customize behavior per agent |
| Keyboard shortcuts | 2.1.18 | Power-user keybindings |

### Tier 2: Medium Impact

| Feature | Version | Opportunity |
|---------|---------|-------------|
| `showTurnDuration` | 2.1.7 | HUD config option |
| Large outputs to disk | 2.1.2 | Subagent result handling |
| Plugin SHA pinning | 2.1.14 | Version stability guide |
| Nested skill discovery | 2.1.6 | Domain-based reorganization |

---

## Deeper Opportunities (Thinking Beyond Obvious)

### 1. Skill-Specific Hooks Could Enable:

```yaml
# brainstorming/SKILL.md
hooks:
  - event: PreToolUse
    tool: Task
    handler: validate-agent-selection.ts
    # Validates selected agents match topic before spawning

  - event: PostToolUse
    tool: Task
    handler: collect-agent-results.ts
    # Auto-synthesizes results as agents complete
```

**What this enables:**
- Automatic validation of agent selection
- Result collection and synthesis
- Failure detection and retry
- Progress aggregation

### 2. Workflow Chaining

Skills calling other skills automatically:

```
/brainstorming auth
  → Phase 4 completes
  → Auto-invokes: /remember --success "auth design"
  → Auto-suggests: "Run /implement auth?"
```

### 3. Smart Context Management

```yaml
# Skill can request context compaction if needed
context:
  mode: fork
  auto_compact_threshold: 80%  # Compact if >80% before spawning agents
  preserve_sections: [identity, decisions]
```

### 4. Result Streaming from Background Agents

Currently: "Task running in background: abc123"
Could be: "security-auditor: Scanning 12 files... 3 issues found so far"

### 5. Automatic Skill Suggestions

After `/explore authentication`:
```
Exploration complete. Suggested next steps:
- /brainstorming "improve auth flow" (based on findings)
- /implement "add MFA support" (gap identified)
- /remember "auth uses JWT with Redis sessions"
```

### 6. Agent Result Caching

```yaml
# explore/SKILL.md
caching:
  enabled: true
  key: "${topic}-${git_branch}"
  ttl: 1h
  # Re-use recent exploration results instead of re-running agents
```

### 7. Conditional Agent Spawning

```python
# Dynamic based on topic analysis
if "security" in topics:
    agents.append("security-auditor")
if "performance" in topics:
    agents.append("performance-engineer")
if len(agents) > 5:
    agents = prioritize_top_5(agents, topic_weights)
```

### 8. Cross-Skill Memory

```yaml
# Skills share learned patterns
memory:
  read_from: [explore, brainstorming, implement]
  write_to: knowledge-graph
  auto_extract_patterns: true
```

### 9. Failure Recovery

```yaml
# If agent fails, auto-retry with alternative
retry:
  max_attempts: 2
  on_failure:
    - try_alternative_agent: true
    - fallback_to_manual: true
  alternatives:
    security-auditor: [security-layer-auditor, code-quality-reviewer]
```

### 10. Progress Dashboard

```
/brainstorming auth

┌─────────────────────────────────────────────┐
│ Brainstorm: auth                            │
├─────────────────────────────────────────────┤
│ [✓] Topic analysis       (security, backend)│
│ [✓] Memory check         (3 prior decisions)│
│ [◐] Agent research       3/4 complete       │
│     ├─ workflow-architect    ✓ done         │
│     ├─ security-auditor      ✓ done         │
│     ├─ backend-architect     ✓ done         │
│     └─ frontend-developer    ◐ running...   │
│ [ ] Synthesis                               │
│ [ ] Design presentation                     │
└─────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Foundation (Now)
1. ✅ Task Management mandatory in skills
2. ✅ Dynamic agent selection in brainstorming
3. Skill-specific hooks for validation

### Phase 2: Experience (Next)
4. Progress streaming from background agents
5. Automatic skill suggestions after completion
6. Result caching for repeated queries

### Phase 3: Intelligence (Future)
7. Cross-skill memory and pattern extraction
8. Failure recovery with alternatives
9. Workflow chaining
10. Context-aware compaction

---

## Questions to Answer

1. Can skill-specific hooks access agent results in PostToolUse?
2. Can we stream partial results from background tasks?
3. Can skills invoke other skills programmatically?
4. Can we customize the "Task running in background" message?
5. Can hooks modify Task tool prompts before execution?

---

## Advanced Patterns (Going Deeper)

### 11. SUMMARY Instruction for Meaningful Completion

**Problem**: When a subagent completes, user sees generic "Task completed" message.

**Solution**: Add explicit SUMMARY instruction to every subagent prompt:

```python
Task(
  subagent_type="security-auditor",
  prompt="""Security audit for authentication changes.

  ... detailed instructions ...

  SUMMARY: When done, output a 1-line summary in this EXACT format:
  "RESULT: [PASS|WARN|FAIL] - [count] findings: [brief description]"
  Example: "RESULT: WARN - 3 findings: hardcoded secret, missing rate limit, weak hash"
  """,
  run_in_background=True
)
```

**Impact**: Task completion shows: `security-auditor: RESULT: WARN - 3 findings: hardcoded secret, missing rate limit, weak hash`

### 12. Meta-Orchestration: Skills That Compose Skills

```yaml
# full-stack-feature/SKILL.md
---
name: full-stack-feature
orchestrates:
  sequential:
    - skill: brainstorming
      args: "${ARGUMENTS[0]}"
      gate: "user_approves_design"
    - skill: implement
      args: "${brainstorming.selected_design}"
    - skill: verify
      args: "--comprehensive"
  on_success:
    - skill: create-pr
    - skill: remember
      args: "--success ${ARGUMENTS[0]}"
---
```

**This enables**: `/full-stack-feature user profiles` → auto-chains brainstorming → implement → verify → create-pr

### 13. Agent Capability Composition

Rather than picking ONE agent, compose capabilities:

```python
# For complex topics, spawn a "composite" analysis
Task(
  subagent_type="backend-system-architect",
  prompt="""
  You are analyzing: ${topic}

  ALSO incorporate perspectives from:
  - security-auditor: Check for vulnerabilities
  - performance-engineer: Check for bottlenecks

  Read these agent definitions and include their perspectives:
  - agents/security-auditor.md
  - agents/performance-engineer.md
  """,
  run_in_background=True
)
```

**Result**: One agent, multi-perspective analysis (saves context vs spawning 3 agents).

### 14. Observability Layer with PostToolUse Hooks

```typescript
// hooks/src/posttool/agent-metrics-collector.ts
export function collectAgentMetrics(input: HookInput): HookResult {
  if (input.tool_name === "Task" && input.tool_result) {
    const metrics = {
      agent_type: input.tool_input.subagent_type,
      duration_ms: Date.now() - input.start_time,
      tokens_used: input.tool_result.tokens,
      outcome: detectOutcome(input.tool_result.output),
    };

    appendMetrics(".claude/feedback/agent-metrics.json", metrics);

    // Trigger calibration if outcome detected
    if (metrics.outcome) {
      calibrateAgent(metrics.agent_type, metrics.outcome);
    }
  }
  return { continue: true };
}
```

**This enables**: Learn which agents succeed/fail for which topics.

### 15. Dynamic Task Splitting Based on Complexity

```python
# In skill, after initial analysis:
complexity = analyze_topic_complexity(topic)

if complexity == "simple":
    # Single agent, no background
    Task(subagent_type="backend-system-architect", run_in_background=False)
elif complexity == "moderate":
    # 2-3 agents, background
    # Launch in parallel...
elif complexity == "complex":
    # Create explicit task breakdown
    TaskCreate(subject="Phase 1: Understand current state")
    TaskCreate(subject="Phase 2: Design options", addBlockedBy=["1"])
    TaskCreate(subject="Phase 3: Deep dive selected option", addBlockedBy=["2"])
    # Launch agents per phase, gated
```

### 16. Real-Time Progress via activeForm Updates

**Current**: `activeForm` is static - set once at TaskCreate.

**Enhancement**: Update `activeForm` dynamically as work progresses:

```python
# Phase 1
TaskUpdate(taskId="1", status="in_progress", activeForm="Searching 127 files...")

# As progress continues
TaskUpdate(taskId="1", activeForm="Found 12 matches, analyzing...")

# Near completion
TaskUpdate(taskId="1", activeForm="Synthesizing 12 findings...")

# Done
TaskUpdate(taskId="1", status="completed")
```

**User sees**: Dynamic progress like "Searching 127 files..." → "Synthesizing 12 findings..."

### 17. Indexed Arguments for Multi-Parameter Skills

**CC 2.1.19 Feature**: `$ARGUMENTS[0]`, `$ARGUMENTS[1]`, etc.

```yaml
# compare/SKILL.md
---
name: compare
description: Compare two approaches, files, or designs
---

# Compare Skill

Compare `$ARGUMENTS[0]` vs `$ARGUMENTS[1]`:

```python
Task(
  subagent_type="backend-system-architect",
  prompt=f"Compare approaches: {$ARGUMENTS[0]} vs {$ARGUMENTS[1]}"
)
```

**Usage**: `/compare "REST API" "GraphQL"` → First arg is REST, second is GraphQL

### 18. Skill Templates with Inheritance

```yaml
# _base-parallel-skill.md
---
_template: true
context: fork
allowedTools: [Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [recall]
---

# Base Parallel Skill Pattern

## CRITICAL: Task Management
[Standard task management section...]

## Phase 1: Memory Check
[Standard memory search...]
```

```yaml
# my-skill/SKILL.md
---
extends: _base-parallel-skill
name: my-skill
# Only define what's different
---
```

### 19. Conditional Tool Permissions Based on Topic

```yaml
# In skill frontmatter
allowedTools:
  default: [Read, Grep, Glob, Task]
  if_security: [Read, Grep, Glob, Task, Bash(npm audit*), Bash(pip-audit*)]
  if_database: [Read, Grep, Glob, Task, Bash(psql*), Bash(alembic*)]
```

**Hook detects topic, injects additional permissions dynamically.**

### 20. Knowledge Graph Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│ Skill Execution Flow with Knowledge Graph                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  /brainstorming auth                                         │
│       │                                                      │
│       ├─► mcp__memory__search_nodes("auth")                  │
│       │   └─► Returns: 3 prior decisions, 2 patterns         │
│       │                                                      │
│       ├─► Agents research (informed by prior decisions)      │
│       │                                                      │
│       ├─► User selects Option B                              │
│       │                                                      │
│       └─► AUTO: mcp__memory__create_node({                   │
│               name: "auth-design-2026-01",                   │
│               type: "decision",                              │
│               content: "Selected JWT + Redis for auth",      │
│               relations: [{to: "auth", type: "implements"}]  │
│           })                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Hook auto-saves decisions to knowledge graph on skill completion.**

---

## Immediate Action Items

### Now (This Session)

1. **Add SUMMARY instruction** to all subagent prompts in skills
2. **Implement indexed arguments** in `/compare`, `/fix-issue` skills
3. **Add dynamic activeForm** updates to brainstorming phases

### Next Sprint

4. **Create skill-specific PostToolUse hooks** for result collection
5. **Implement agent metrics collection** for calibration
6. **Add auto-suggest next skill** after skill completion

### Future

7. **Meta-orchestration skills** that chain other skills
8. **Capability composition** for complex analyses
9. **Template inheritance** for skill DRY-ness

---

## Validation Experiments

### Experiment 1: SUMMARY Instruction Effectiveness
```bash
# Test: Does the SUMMARY instruction actually appear in task completion?
# Run: /brainstorming security with SUMMARY instruction added
# Measure: User-visible completion message quality
```

### Experiment 2: Dynamic activeForm
```bash
# Test: Can activeForm be updated mid-task?
# Run: Skill that calls TaskUpdate with changing activeForm
# Measure: Does CLI show updated progress text?
```

### Experiment 3: Indexed Arguments
```bash
# Test: Does $ARGUMENTS[0] work in skill prompts?
# Run: /compare "option A" "option B"
# Measure: Are arguments correctly split?
```

---

*Created: 2026-01-24*
*Status: Draft - needs validation against CC 2.1.19 capabilities*
*Updated: 2026-01-24 - Added 10 advanced patterns (11-20)*

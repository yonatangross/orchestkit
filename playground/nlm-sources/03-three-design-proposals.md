# Three Design Proposals for OrchestKit Collaboration

This document presents the three design proposals that emerged from brainstorming 22 ideas across 7 themes. Each proposal addresses a different aspect of how agents, skills, and hooks can collaborate better.

## Design A: The Bridge Layer

**Problem**: Generic agents don't know your project. Every time an agent spawns, it rediscovers your stack from scratch.

**Solution**: A bridge between the setup wizard's knowledge and the hook system.

### Components

**1. Stack Profile File** (`.claude/stack-profile.json`)
The setup wizard's Phase 1-2 scan results, persisted as a structured file. Contains languages, frameworks, database choices, architectural patterns, and anti-patterns specific to your project.

**2. Setup CC Infrastructure Scan** (Phase 1b)
Extend the setup wizard to scan Claude Code's own configuration — custom agents in `.claude/agents/`, user skills, path-scoped rules in `.claude/rules/`, memory graph entity count, MCP server configurations. This data feeds the readiness score.

**3. Context Packs** (`.claude/context-packs/`)
Pre-assembled context bundles for different agent types. Instead of the stager doing regex matching at spawn time, context packs are pre-built during setup:
- `backend-pack.json` — API patterns, database conventions, migration rules
- `frontend-pack.json` — Component patterns, state management, testing approach
- `security-pack.json` — Auth patterns, input validation, OWASP checklist

**4. Living Agent Brief**
The stager reads the agent's `.md` frontmatter (`skills`, `tools`, `context`) and matches it against the stack profile to select the right context pack. This closes the gap where agents currently start without knowing their own capabilities relative to the project.

### Implementation Effort: Medium
- Stack profile: 2 days (extend setup wizard Phase 2)
- Infrastructure scan: 1 day (new Phase 1b)
- Context packs: 3 days (new directory + stager integration)
- Living brief: 2 days (frontmatter reading in SubagentStart)

### Risk: Low
All changes are additive — nothing breaks if stack profile doesn't exist.

---

## Design B: Structured Handoffs

**Problem**: Agents can't share work products. Handoff files are written but never read. Agent output is truncated to 200 characters.

**Solution**: A typed blackboard system where agents publish structured artifacts that other agents can consume.

### Components

**1. Typed Artifact Blackboard** (`.claude/blackboard/`)
Replace the current handoff directory with a typed artifact store:
```
.claude/blackboard/
  api-schema/      # API contracts from backend-system-architect
  component-tree/  # UI structure from frontend-ui-developer
  test-plan/       # Coverage strategy from test-generator
  security-findings/ # Vulnerabilities from security-auditor
```

Each artifact has a type, producer agent, timestamp, confidence score, and structured content (not truncated).

**2. Agent Capability Manifests**
Add `provides:` and `requires:` to agent frontmatter:
```yaml
name: frontend-ui-developer
provides: [component-tree, style-system, ui-tests]
requires: [api-schema]
```

The stager reads these manifests and pre-loads required artifacts from the blackboard before the agent starts.

**3. Agent Handoff Bus**
Instead of writing files that no one reads, the SubagentStop hooks publish to the blackboard AND notify the next agent via systemMessage. The current feedback-loop already determines downstream agents — it just needs to include the artifact content in the notification.

**4. Session Knowledge Graph**
Persistent knowledge graph entries created during a session. Instead of truncating output to 200 chars, extract structured decisions and persist them as graph entities that survive session boundaries.

### Implementation Effort: High
- Blackboard directory + read/write: 3 days
- Capability manifests: 2 days (frontmatter extension + stager)
- Handoff bus: 2 days (connect SubagentStop → SubagentStart)
- Session graph: 3 days (entity extraction + persistence)

### Risk: Medium
Requires schema agreement between hooks. If artifacts are malformed, downstream agents get corrupted context.

---

## Design C: Skill Pipelines + Hook Intelligence

**Problem**: Hooks are reactive (fire on events) but not intelligent (don't learn from patterns). Pipelines exist but are hardcoded and disable themselves during Agent Teams.

**Solution**: Make hooks learn from agent behavior and let users define custom pipelines.

### Components

**1. Pipeline YAML Loader**
Move pipeline definitions from TypeScript to user-editable YAML:
```yaml
# .claude/pipelines/deploy-review.yaml
name: Deploy Review Pipeline
steps:
  - agent: security-auditor
    provides: [security-report]
  - agent: test-generator
    requires: [security-report]
    provides: [test-results]
  - agent: deployment-manager
    requires: [security-report, test-results]
```

The existing `multi-agent-coordinator.ts` already has the execution engine — it just needs a YAML front-end instead of hardcoded definitions.

**2. Model Velocity Calibrator**
Track agent performance metrics across sessions:
- Tokens consumed per agent type
- Time to completion
- Success/failure rates
- Common error patterns

Store in `.claude/hooks/metrics/velocity.json`. Use data to:
- Suggest model routing (Haiku for fast tasks, Opus for complex)
- Predict pipeline completion time
- Flag agents that consistently fail

**3. Error Pattern Router**
Aggregate errors across sessions. If `test-generator` fails on React tests 3 times, automatically:
- Add "common failure: React test imports" to its systemMessage
- Suggest alternative agent or approach
- Surface pattern to the user via `/ork:doctor`

**4. Skill Chain Anticipator**
When a user invokes a skill, predict what they'll need next:
- `/ork:implement` → likely needs `/ork:verify` → then `/ork:commit`
- `/ork:fix-issue` → likely needs test-generator → then code-quality-reviewer

Pre-warm context for anticipated agents by loading relevant artifacts early.

**5. Quality Regression Detector**
Persist quality baselines per project. If code-quality-reviewer scores decline across sessions, alert the user. Track:
- Lint score trends
- Test coverage changes
- Security finding counts
- Agent output quality scores

### Implementation Effort: High
- YAML loader: 2 days (parser + schema validation)
- Velocity calibrator: 3 days (metrics collection + storage)
- Error router: 2 days (pattern aggregation + injection)
- Chain anticipator: 3 days (prediction model + pre-warming)
- Quality detector: 2 days (baseline storage + trend analysis)

### Risk: Medium
Metrics storage grows over time. Need cleanup/rotation strategy. Prediction accuracy depends on usage volume.

---

## Implementation Roadmap

### v7.1 (Quick Wins — 1-2 weeks)
1. Fix Agent Teams kill switch — remove `isAgentTeamsActive()` guards or make them conditional
2. Connect handoff reader — make `subagent-context-stager` read from `.claude/context/handoffs/`
3. Persist setup scan results to `.claude/stack-profile.json`
4. Read agent frontmatter in SubagentStart hooks

### v7.2 (Foundation — 2-4 weeks)
5. Implement blackboard directory with typed artifacts
6. Add `provides:/requires:` to agent frontmatter
7. Pipeline YAML loader (move 5 pipelines to YAML)
8. Agent velocity metrics (basic timing + success/failure)

### v8.0 (Intelligence — 4-8 weeks)
9. Error pattern router
10. Quality regression detector
11. Skill chain anticipator
12. Org-level agent registry
13. Template agents for common stacks

## Comparison Matrix

| Dimension | Design A (Bridge) | Design B (Handoffs) | Design C (Pipelines) |
|-----------|-------------------|---------------------|----------------------|
| Effort | Medium (8 days) | High (10 days) | High (12 days) |
| Impact | High | Very High | Very High |
| Risk | Low | Medium | Medium |
| Quick wins | 3 items | 1 item | 2 items |
| Dependencies | None | Design A | Design A + B |
| User-facing | Setup wizard | Agent quality | Metrics dashboard |

**Recommended approach**: Start with Design A (bridge layer), then B (handoffs), then C (intelligence). Each builds on the previous. The v7.1 quick wins from all three designs can ship together.

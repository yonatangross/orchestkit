# Readiness Scoring

Computes a composite readiness score (0-10) from 6 dimensions.

## Dimensions

| Dimension | Weight | Calculation |
|-----------|--------|-------------|
| **Stack Coverage** | 25% | matched_skills / relevant_skills_for_detected_stack |
| **Hook Protection** | 20% | hooks_active / total_hooks (from /ork:doctor logic) |
| **MCP Enhancement** | 15% | installed_mcps / recommended_mcps |
| **Memory Depth** | 15% | entity_count from `mcp__memory__search_nodes` (target: 50+) |
| **Custom Skills** | 15% | custom_skills_created / suggested_customs |
| **Agent Utilization** | 10% | 1.0 if agents accessible, 0.5 if no MCPs limit capability |

## Score Presentation

```
OrchestKit Readiness Score: 7.2 / 10  (stable channel, v7.0.0)

  Stack Coverage  ████████░░  9/10  Python + React fully covered
  Hook Protection ████████░░  8/10  107 hooks active
  MCP Enhancement ██████░░░░  6/10  2/3 recommended MCPs active
  Memory Depth    ████░░░░░░  4/10  12 entities (target: 50+)
  Custom Skills   ██░░░░░░░░  2/10  0/3 suggested skills created
  Agent Utilization ████████░░  8/10  30 agents available

  Top improvement: Add /ork:remember patterns → +1.5 points
```

## Memory Integration

Store the score for tracking over time:

```python
mcp__memory__create_entities(entities=[{
  "name": "OrchestKit Setup Score",
  "entityType": "metric",
  "observations": [
    "Score: 7.2/10 on 2026-02-26",
    "Stack: Python + React + Next.js",
    "Gap: Memory depth (12/50 entities), Custom skills (0/3)"
  ]
}])
```

## Improvement Plan Template

Generate prioritized, **runnable** recommendations in 3 tiers:

- **P0 (do now)**: Seed knowledge graph with `/ork:remember` patterns
- **P1 (this week)**: Configure recommended MCPs, create custom skills for repeated patterns
- **P2 (ongoing)**: Run `/ork:explore architecture`, rescan with `/ork:setup --rescan` in 2 weeks

Save plan to memory as entity type "plan".

# Agent Model Routing

## Overview

OrchestKit assigns each agent a model tier (opus, sonnet, haiku) based on task complexity, security sensitivity, and cost efficiency. This document tracks the current distribution and rationale.

## Current Distribution (v7.0.0)

| Model | Count | Percentage |
|-------|-------|------------|
| Opus | 6 | 16% |
| Sonnet | 19 | 50% |
| Haiku | 13 | 34% |
| **Total** | **38** | 100% |

## Routing Criteria

1. **Security sensitivity**: Opus for safety-critical agents (security auditors, system design review)
2. **Write access**: Agents with Write/Edit tools need Sonnet+ for accuracy
3. **Tool complexity**: 10+ tools → Sonnet, <8 tools → Haiku eligible
4. **Task complexity**: Research/analysis/metrics → Haiku, implementation/architecture → Sonnet

## Per-Agent Assignment

### Tier 4: Safety-Critical (Opus) — 6 agents

These agents handle security, safety, and architectural decisions where errors have high blast radius.

| Agent | Rationale |
|-------|-----------|
| ai-safety-auditor | Safety-critical decisions, must catch subtle vulnerabilities |
| event-driven-architect | Complex distributed system design, consistency guarantees |
| security-auditor | Security review requires maximum reasoning depth |
| security-layer-auditor | Defense-in-depth analysis, multi-layer threat modeling |
| system-design-reviewer | Architecture review, trade-off analysis across systems |
| workflow-architect | Orchestration design, multi-agent coordination patterns |

### Tier 3: Complex Architecture (Sonnet) — 19 agents

These agents perform complex reasoning, code generation, or architecture work where quality must be high.

| Agent | Rationale |
|-------|-----------|
| accessibility-specialist | Standards-based A11y, WCAG compliance checking |
| backend-system-architect | System design, API architecture |
| ci-cd-engineer | Pipeline design, deployment strategies |
| code-quality-reviewer | Code review requires nuanced judgment |
| database-engineer | Schema design, query optimization |
| debug-investigator | Root cause analysis across complex systems |
| demo-producer | Polished user-facing artifact creation |
| frontend-performance-engineer | Performance optimization, bundle analysis |
| frontend-ui-developer | UI implementation, component architecture |
| infrastructure-architect | Cloud architecture, IaC patterns |
| llm-integrator | LLM API integration, prompt engineering |
| multimodal-specialist | Cross-modal content analysis |
| product-strategist | Strategic product decisions |
| prompt-engineer | Prompt optimization requires subtle reasoning |
| python-performance-engineer | Performance profiling, optimization |
| requirements-translator | Business→technical requirements translation |
| test-generator | Test code generation with edge case coverage |
| ui-feedback | Structured UI analysis and recommendations |
| web-research-analyst | Research synthesis, source evaluation |

### Tier 2: Data-Driven (Haiku) — 13 agents

These agents perform structured, pattern-based work where Haiku's 90.8% PinchBench score (vs Sonnet's 92.7%) is an acceptable tradeoff for 73% cost reduction.

| Agent | Rationale |
|-------|-----------|
| business-case-builder | Template-based financial analysis |
| data-pipeline-engineer | Structured ETL design patterns |
| deployment-manager | Deployment checklist execution |
| documentation-specialist | Structured documentation generation |
| eval-runner | Data-driven evaluation execution |
| git-operations-engineer | Standard git workflow operations |
| market-intelligence | Research aggregation, structured analysis |
| metrics-architect | Standard metrics and dashboard patterns |
| monitoring-engineer | Observability pattern application |
| prioritization-analyst | Scoring-based prioritization |
| rapid-ui-designer | Template-driven UI scaffolding |
| release-engineer | Release process execution |
| ux-researcher | Structured UX heuristic evaluation |

## Quality Benchmarks

Based on PinchBench (February 2026):

| Model | Score | Cost/Invocation | Cost-Quality Ratio |
|-------|-------|-----------------|-------------------|
| Opus 4.6 | 90.6% | $0.4200 | 1.0x (baseline) |
| Sonnet 4.5 | 92.7% | $0.0840 | 5.1x better |
| Haiku 4.5 | 90.8% | $0.0224 | 18.8x better |

Key insight: Haiku 4.5 nearly matches Opus 4.6 on PinchBench (within 0.2 points) while costing 18.8x less per invocation.

## Version History

| Release | Sonnet | Opus | Haiku | Change |
|---------|--------|------|-------|--------|
| v6.7.1 | 26 | 6 | 6 | Baseline distribution |
| v7.0.0 | 19 | 6 | 13 | Shifted 7 Tier 2 agents to Haiku based on PinchBench analysis |

## Cost Impact

| Metric | v6.7.1 | v7.0.0 | Delta |
|--------|--------|--------|-------|
| Session cost (10 agents) | $48.38 | $42.22 | -12.7% |
| Annual cost (20 sessions/mo) | $11,612 | $10,134 | -$1,478/yr |

## References

- [PinchBench Analysis](./.claude/agent-routing-analysis-feb2026.md)
- [Agent Source Files](src/agents/)
- [Version Compatibility](src/skills/doctor/references/version-compatibility.md)

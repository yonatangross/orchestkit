---
name: product-frameworks
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Product management frameworks for business cases, market analysis, strategy, prioritization, OKRs/KPIs, personas, requirements, and user research. Use when building ROI projections, competitive analysis, RICE scoring, OKR trees, user personas, PRDs, or usability testing plans.
tags: [product, strategy, business-case, market-analysis, prioritization, okr, kpi, persona, requirements, user-research, rice, prd]
context: fork
agent: product-strategist
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Product Frameworks

Comprehensive product management frameworks covering business analysis, market intelligence, strategy, prioritization, metrics, personas, requirements, and user research. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Business & Market](#business--market) | 4 | HIGH | ROI/NPV/IRR calculations, TCO analysis, TAM/SAM/SOM sizing, competitive landscape |
| [Strategy & Prioritization](#strategy--prioritization) | 4 | HIGH | Value proposition canvas, go/no-go gates, RICE scoring, WSJF ranking |
| [Metrics & OKRs](#metrics--okrs) | 4 | HIGH | OKR writing, KPI trees, leading/lagging indicators, instrumentation |
| [Research & Requirements](#research--requirements) | 4 | HIGH | User personas, journey maps, interview guides, PRDs |

**Total: 16 rules across 4 categories**

## Quick Start

```markdown
## ROI Quick Calculation
ROI = (Net Benefits - Total Costs) / Total Costs x 100%

## RICE Prioritization
RICE Score = (Reach x Impact x Confidence) / Effort

## OKR Structure
Objective: Qualitative, inspiring goal
  KR1: Quantitative measure (from X to Y)
  KR2: Quantitative measure (from X to Y)

## User Story Format
As a [persona], I want [goal], so that [benefit].
```

## Business & Market

Financial analysis and market intelligence frameworks for investment decisions.

- **`business-roi`** -- ROI, NPV, IRR, payback period calculations with Python examples
- **`business-cost-benefit`** -- TCO analysis, build vs buy comparison, sensitivity analysis
- **`market-tam-sam-som`** -- TAM/SAM/SOM market sizing with top-down and bottom-up methods
- **`market-competitive`** -- Porter's Five Forces, SWOT, competitive landscape mapping

## Strategy & Prioritization

Strategic decision frameworks and quantitative prioritization methods.

- **`strategy-value-prop`** -- Value Proposition Canvas, JTBD framework, fit assessment
- **`strategy-go-no-go`** -- Stage gate criteria, scoring template, decision thresholds
- **`prioritize-rice`** -- RICE scoring with reach, impact, confidence, effort scales
- **`prioritize-wsjf`** -- WSJF cost of delay, time criticality, MoSCoW method

## Metrics & OKRs

Goal-setting and measurement frameworks for metrics-driven teams.

- **`metrics-okr`** -- OKR structure, writing objectives and key results, examples
- **`metrics-kpi-trees`** -- Revenue and product health KPI trees, North Star metric
- **`metrics-leading-lagging`** -- Leading vs lagging indicators, balanced dashboards
- **`metrics-instrumentation`** -- Metric definition template, event naming, alerting

## Research & Requirements

User research methods and requirements documentation patterns.

- **`research-personas`** -- User persona template, empathy maps, persona examples
- **`research-journey-mapping`** -- Customer journey maps, service blueprints, experience curves
- **`research-user-interviews`** -- Interview guides, usability testing, surveys, card sorting
- **`research-requirements-prd`** -- PRD template, user stories, acceptance criteria, INVEST

## Related Skills

- `assess` - Assess project complexity and risks
- `brainstorming` - Generate product ideas and features

**Version:** 2.0.0 (February 2026)

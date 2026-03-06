# Output Templates

Structured JSON output formats for consistent product deliverables. Each template shows the required structure with 1-2 example entries. Agents and skills producing these artifacts should conform to these schemas.

## PRD Output

From requirements translation workflows.

```json
{
  "prd": {
    "title": "Feature Name",
    "version": "1.0",
    "author": "PM Name",
    "status": "draft",
    "last_updated": "2026-03-01"
  },
  "problem_statement": "One-paragraph description of the user problem being solved.",
  "solution": "High-level solution approach.",
  "scope": {
    "in": ["User authentication via SSO", "Role-based access control"],
    "out": ["Custom SAML provider", "Mobile biometric auth"]
  },
  "user_stories": [
    {
      "id": "US-001",
      "persona": "Team Admin",
      "story": "As a team admin, I want to invite members via email, so that onboarding is self-service.",
      "acceptance_criteria": [
        "Invite email sent within 30 seconds",
        "Invited user can set password on first visit",
        "Admin sees pending/accepted status"
      ],
      "priority": "must-have"
    }
  ],
  "edge_cases": ["User invited to multiple teams simultaneously", "Expired invite link reuse"],
  "non_functional": {
    "performance": "Invite flow completes in < 2s p95",
    "security": "Invite tokens expire after 72 hours",
    "accessibility": "WCAG 2.1 AA"
  },
  "github_issues_to_create": [
    { "title": "Implement SSO invite flow", "labels": ["feature", "auth"], "estimate": "3d" }
  ]
}
```

## Business Case Output

From business case analysis workflows.

```json
{
  "investment_summary": {
    "total_investment": "$150,000",
    "expected_return": "$450,000",
    "payback_period": "8 months",
    "roi": "200%",
    "confidence": "medium"
  },
  "cost_breakdown": [
    { "category": "Engineering", "amount": "$100,000", "type": "one-time" },
    { "category": "Infrastructure", "amount": "$2,000/mo", "type": "recurring" }
  ],
  "benefit_projection": [
    { "benefit": "Support ticket reduction", "annual_value": "$180,000", "confidence": "high" },
    { "benefit": "Upsell conversion lift", "annual_value": "$270,000", "confidence": "medium" }
  ],
  "sensitivity_analysis": {
    "conservative": { "roi": "80%", "payback": "14 months" },
    "base": { "roi": "200%", "payback": "8 months" },
    "optimistic": { "roi": "350%", "payback": "5 months" }
  },
  "risks": [
    { "risk": "Integration delays", "probability": "medium", "impact": "high", "mitigation": "Prototype first" }
  ],
  "recommendation": "Proceed with phased rollout. Break-even achieved under conservative scenario."
}
```

## Metrics Framework Output

From metrics architecture workflows.

```json
{
  "okrs": [
    {
      "objective": "Improve activation rate for new teams",
      "key_results": [
        { "kr": "Increase Day-7 activation from 40% to 60%", "owner": "Growth" },
        { "kr": "Reduce time-to-first-value from 3 days to 1 day", "owner": "Product" }
      ]
    }
  ],
  "kpis": {
    "leading": ["Daily signups", "Onboarding completion rate", "Feature adoption in week 1"],
    "lagging": ["Monthly revenue", "Net retention rate", "Customer lifetime value"]
  },
  "instrumentation_plan": [
    {
      "event": "onboarding_step_completed",
      "properties": ["step_name", "duration_seconds", "skipped"],
      "trigger": "User completes or skips an onboarding step"
    }
  ],
  "hypothesis_validation": {
    "hypothesis": "Guided onboarding increases Day-7 activation by 20%",
    "primary_metric": "day_7_activation_rate",
    "guardrail_metrics": ["support_ticket_volume", "onboarding_drop_off_rate"]
  },
  "guardrail_metrics": ["Page load time p95 < 2s", "Error rate < 0.1%", "Support tickets per 1000 users < 5"],
  "review_cadence": "Weekly metrics review, monthly OKR check-in, quarterly strategy review"
}
```

## Prioritization Report Output

From prioritization analysis workflows.

```json
{
  "scored_features": [
    {
      "feature": "AI-powered search",
      "reach": 8,
      "impact": 2.0,
      "confidence": 0.8,
      "effort": 3,
      "rice_score": 4.27,
      "notes": "Prototype tested with 5 users"
    },
    {
      "feature": "CSV bulk import",
      "reach": 4,
      "impact": 1.0,
      "confidence": 1.0,
      "effort": 1,
      "rice_score": 4.0,
      "notes": "Top support request"
    }
  ],
  "opportunity_cost_analysis": [
    { "if_delayed": "AI-powered search", "cost_per_month": "$25,000 in lost conversions" }
  ],
  "dependencies": [
    { "feature": "AI-powered search", "depends_on": ["Search indexing upgrade"] }
  ],
  "trade_offs_for_human": [
    {
      "decision": "AI search vs bulk import first",
      "option_a": { "pros": ["Higher RICE", "Competitive differentiator"], "cons": ["3x effort", "Dependency risk"] },
      "option_b": { "pros": ["Quick win", "No dependencies"], "cons": ["Lower strategic value"] },
      "recommendation": "Human decides based on Q2 OKR alignment"
    }
  ],
  "recommended_sequence": ["CSV bulk import", "Search indexing upgrade", "AI-powered search"]
}
```

## Research Report Output

From user research workflows.

```json
{
  "personas": [
    {
      "name": "Alex the Admin",
      "role": "IT Administrator",
      "goals": ["Reduce onboarding time", "Maintain security compliance"],
      "pain_points": ["Manual user provisioning", "No audit trail"],
      "behaviors": ["Checks admin dashboard daily", "Prefers CLI over GUI"],
      "quotes": ["I spend 2 hours a week just adding new users."]
    }
  ],
  "journey_map": [
    {
      "stage": "Onboarding",
      "steps": [
        {
          "action": "Receives invite email",
          "thinking": "Is this legitimate?",
          "feeling": "cautious",
          "pain_points": ["Generic email looks like spam"],
          "opportunities": ["Branded email with admin's name"]
        }
      ]
    }
  ],
  "user_stories": [
    "As an IT admin, I want SCIM provisioning, so that user accounts sync automatically."
  ],
  "metrics": {
    "task_success_rate": "85%",
    "time_on_task": "4.2 minutes",
    "satisfaction_score": "3.8/5"
  },
  "recommendations": [
    { "priority": "high", "finding": "Onboarding email mistaken for spam", "action": "Add company branding and admin name" }
  ]
}
```

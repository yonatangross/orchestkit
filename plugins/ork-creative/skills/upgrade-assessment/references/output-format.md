# Output Format

The upgrade assessment produces a structured JSON report with the following schema.

## JSON Report Schema

```json
{
  "assessment": {
    "id": "upgrade-assessment-{timestamp}",
    "scope": "full|model-only|cc-only|ork-only",
    "timestamp": "2026-02-06T12:00:00Z"
  },
  "environment": {
    "current": {
      "model": "claude-sonnet-4-6",
      "ccVersion": "2.1.32",
      "orkVersion": "6.0.0",
      "hooks": 121,
      "skills": 199,
      "agents": 36
    },
    "target": {
      "model": "claude-opus-4-6",
      "ccVersion": "2.1.33",
      "orkVersion": "6.1.0"
    }
  },
  "scores": {
    "overall": 7.4,
    "dimensions": {
      "modelCompatibility": { "score": 8, "weight": 0.25, "weighted": 2.0 },
      "hookCompatibility": { "score": 9, "weight": 0.20, "weighted": 1.8 },
      "skillCoverage": { "score": 7, "weight": 0.15, "weighted": 1.05 },
      "agentReadiness": { "score": 7, "weight": 0.15, "weighted": 1.05 },
      "memoryArchitecture": { "score": 6, "weight": 0.10, "weighted": 0.6 },
      "cicdPipeline": { "score": 6, "weight": 0.15, "weighted": 0.9 }
    }
  },
  "findings": [
    {
      "severity": "CRITICAL",
      "dimension": "modelCompatibility",
      "description": "Hardcoded model ID 'claude-sonnet-4' in 3 agent files",
      "files": ["src/agents/code-reviewer.md", "src/agents/architect.md"],
      "recommendation": "Update model field to 'claude-opus-4-6' or use 'sonnet' alias"
    },
    {
      "severity": "WARNING",
      "dimension": "skillCoverage",
      "description": "Context window references assume 200K tokens, Opus 4.6 supports 1M",
      "files": ["src/skills/context-engineering/SKILL.md"],
      "recommendation": "Update token budget calculations for 1M context window"
    }
  ],
  "recommendations": [
    {
      "priority": "P0",
      "action": "Update hardcoded model references",
      "effort": "low",
      "files": ["src/agents/*.md"],
      "steps": [
        "Grep for 'claude-sonnet-4' and 'claude-opus-4' in src/",
        "Replace with target model ID or use alias",
        "Run npm run test:agents to validate"
      ]
    },
    {
      "priority": "P2",
      "action": "Update context budget calculations",
      "effort": "medium",
      "files": ["src/skills/context-engineering/SKILL.md"],
      "steps": [
        "Update MAX_CONTEXT values for new model",
        "Adjust compression triggers if context window changed",
        "Update documentation examples"
      ]
    }
  ],
  "summary": {
    "readiness": "Low Risk",
    "overallScore": 7.4,
    "blockers": 0,
    "criticalItems": 1,
    "totalFindings": 5,
    "estimatedEffort": "4-6 hours"
  }
}
```

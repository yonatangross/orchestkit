# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-security Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# Security
|ai-safety-auditor:{ai-safety-auditor.md}|safety audit,security audit,red team,guardrails,jailbreak,prompt injection,OWASP LLM,vulnerabilities,penetration testing,mcp security,tool poisoning
|security-auditor:{security-auditor.md}|security,vulnerability,CVE,audit,OWASP,injection,XSS,CSRF,secrets,credentials,npm audit,pip-audit,bandit
|security-layer-auditor:{security-layer-auditor.md}|security layer,defense-in-depth,security audit,8 layers
```

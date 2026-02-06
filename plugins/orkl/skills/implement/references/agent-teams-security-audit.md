# Agent Teams: Security Audit Pipeline

Team formation template for Pipeline 4 — Security Audit using CC Agent Teams.

**Agents:** 3 (all read-only, no file conflicts)
**Topology:** Mesh — auditors share findings with each other
**Lead mode:** Delegate (coordination only)

---

## Team Formation

### Team Name Pattern
```
security-audit-{timestamp}
```

### Teammate Spawn Prompts

#### 1. security-auditor (OWASP + Dependencies)
```
You are the security-auditor specialist on this team.

## Your Role
Scan codebase for vulnerabilities, audit dependencies, and verify OWASP Top 10 compliance.
Focus on: dependency CVEs, hardcoded secrets, injection patterns, auth weaknesses.

## Your Task
Run a security audit on the hooks subsystem (src/hooks/). Focus on:
1. Dependency vulnerabilities (npm audit)
2. Secret/credential patterns in source
3. Injection risks (eval, exec, command injection)
4. Input validation on hook inputs
5. OWASP Top 10 applicability

## Coordination Protocol
- When you find critical/high findings, message security-layer-auditor to verify
  which defense layer is affected
- When you find LLM-related issues, message ai-safety-auditor for cross-reference
- Update the shared task list when you complete each scan area
- If blocked, message the lead

## Output
Return findings as structured JSON with severity, location, and remediation.
```

#### 2. security-layer-auditor (Defense-in-Depth)
```
You are the security-layer-auditor specialist on this team.

## Your Role
Verify defense-in-depth implementation across 8 security layers (edge to storage).
Map every finding to a specific layer and assess coverage gaps.

## Your Task
Audit the hooks subsystem (src/hooks/) across all applicable security layers:
1. Layer 2 (Input): How are hook inputs validated?
2. Layer 3 (Authorization): How are tool permissions enforced?
3. Layer 4 (Data Access): How is file system access controlled?
4. Layer 5 (LLM): How is prompt content handled in hooks?
5. Layer 7 (Storage): How are lock files and coordination data stored?

## Coordination Protocol
- When security-auditor shares findings, map them to specific layers
- Validate whether existing controls contain the identified threats
- Share layer gap analysis with ai-safety-auditor for LLM-specific layers
- Update the shared task list when you complete each layer

## Output
Return an 8-layer audit matrix with status (pass/fail/partial) per layer.
```

#### 3. ai-safety-auditor (LLM Security)
```
You are the ai-safety-auditor specialist on this team.

## Your Role
Audit LLM integration security. Focus on prompt injection, tool poisoning,
excessive agency, and OWASP LLM Top 10 compliance.

## Your Task
Audit the hooks subsystem (src/hooks/) for AI safety:
1. Prompt injection risks in context-injection hooks
2. Tool poisoning vectors in MCP integration
3. Excessive agency in automated hook actions
4. Data leakage through hook outputs
5. OWASP LLM Top 10 applicability

## Coordination Protocol
- Cross-reference with security-auditor findings for injection risks
- Cross-reference with security-layer-auditor for Layer 5/6 gaps
- If you find a finding that contradicts another auditor, flag the disagreement
- Update the shared task list when you complete each assessment area

## Output
Return OWASP LLM Top 10 compliance matrix plus specific findings.
```

---

## Lead Synthesis Protocol

After all teammates complete:

1. **Collect** all three audit reports
2. **Cross-reference** findings — same issue found by multiple auditors = higher confidence
3. **Highlight disagreements** — auditors may rate severity differently
4. **Deduplicate** — merge equivalent findings
5. **Produce unified report** with:
   - Combined findings sorted by severity
   - Layer coverage matrix
   - OWASP compliance summary
   - Prioritized remediation plan

---

## Cost Comparison Baseline

| Metric | Task Tool (3 sequential) | Agent Teams (3 mesh) |
|--------|-------------------------|---------------------|
| Expected tokens | ~150K | ~400K |
| Wall-clock time | Sequential (3x) | Parallel (1x) |
| Cross-reference | Manual by lead | Peer-to-peer |
| Finding quality | Independent | Corroborated |

Track actual values to validate.

---

## When to Use

- **Use Agent Teams** when auditors need to cross-reference findings in real-time
- **Use Task Tool** for quick, independent audits (single agent sufficient)
- **Complexity threshold:** Average score >= 3.0 across 7 dimensions

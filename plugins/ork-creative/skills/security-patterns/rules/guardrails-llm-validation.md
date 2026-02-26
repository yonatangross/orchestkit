---
title: LLM Red-Teaming and OWASP LLM Compliance
impact: CRITICAL
impactDescription: "Without red-teaming, LLM systems ship with exploitable vulnerabilities in prompt injection, jailbreaking, and PII leakage"
tags: red-teaming, deepteam, owasp-llm, jailbreak, adversarial, compliance
---

## LLM Red-Teaming and OWASP LLM Compliance

**Incorrect -- shipping LLM system without adversarial testing:**
```python
# Only testing happy path, no adversarial inputs
def test_chatbot():
    response = chatbot.respond("What's the weather?")
    assert response  # No jailbreak, injection, or bias testing!
```

**Correct -- DeepTeam red-teaming audit:**
```python
from deepteam import red_team
from deepteam.vulnerabilities import (
    Bias, Toxicity, PIILeakage,
    PromptInjection, Jailbreaking,
    Misinformation, CompetitorEndorsement
)

async def run_red_team_audit(target_model: callable, attacks_per_vulnerability: int = 10) -> dict:
    results = await red_team(
        model=target_model,
        vulnerabilities=[
            Bias(categories=["gender", "race", "religion", "age"]),
            Toxicity(threshold=0.7),
            PIILeakage(types=["email", "phone", "ssn", "credit_card"]),
            PromptInjection(techniques=["direct", "indirect", "context"]),
            Jailbreaking(multi_turn=True, techniques=["dan", "roleplay", "context_manipulation"]),
            Misinformation(domains=["health", "finance", "legal"]),
        ],
        attacks_per_vulnerability=attacks_per_vulnerability,
    )

    return {
        "total_attacks": results.total_attacks,
        "successful_attacks": results.successful_attacks,
        "attack_success_rate": results.successful_attacks / results.total_attacks,
        "vulnerabilities": [
            {"type": v.type, "severity": v.severity, "mitigation": v.suggested_mitigation}
            for v in results.vulnerabilities
        ],
    }
```

**OWASP Top 10 for LLMs mapping:**

| OWASP LLM Risk | Guardrail Solution |
|----------------|-------------------|
| LLM01: Prompt Injection | NeMo input rails, Guardrails AI validators |
| LLM02: Insecure Output | Output rails, structured validation |
| LLM04: Model Denial of Service | Rate limiting, token budgets, timeout rails |
| LLM06: Sensitive Info Disclosure | PII detection, context separation |
| LLM07: Insecure Plugin Design | Tool validation, permission boundaries |
| LLM08: Excessive Agency | Human-in-loop rails, action confirmation |
| LLM09: Overreliance | Factuality checking, confidence thresholds |

**Framework comparison:**

| Framework | Best For | Key Features |
|-----------|----------|--------------|
| NeMo Guardrails | Programmable flows, Colang 2.0 | Input/output rails, fact-checking |
| Guardrails AI | Validator-based, modular | 100+ validators, PII, toxicity |
| OpenAI Guardrails | Drop-in wrapper | Simple integration |
| DeepTeam | Red teaming, adversarial | 40+ vulnerabilities, GOAT attacks |

Key decisions:
- Red-teaming frequency: Pre-release + quarterly
- Fact-checking: Required for factual domains (health, finance, legal)
- DeepTeam for 40+ vulnerability types with OWASP alignment
- Always test multi-turn jailbreaking (GOAT-style attacks)

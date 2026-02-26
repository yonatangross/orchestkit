---
title: Deploy NeMo Guardrails and Guardrails AI to defend against prompt injection and toxicity
impact: CRITICAL
impactDescription: "Production LLM systems without guardrails are vulnerable to prompt injection, toxicity, and hallucination attacks"
tags: nemo, guardrails, colang, safety, rails, validators, toxicity, pii
---

## NeMo Guardrails and Guardrails AI

**Incorrect -- returning raw LLM output without validation:**
```python
# No input sanitization, no output validation
user_input = request.json["message"]
response = llm.generate(user_input)  # Prompt injection risk!
return response  # Raw, unvalidated output!
```

**Correct -- NeMo Guardrails with Guardrails AI integration:**
```yaml
# config.yml
models:
  - type: main
    engine: openai
    model: gpt-5.2

rails:
  config:
    guardrails_ai:
      validators:
        - name: toxic_language
          parameters:
            threshold: 0.5
            validation_method: "sentence"
        - name: guardrails_pii
          parameters:
            entities: ["phone_number", "email", "ssn", "credit_card"]
        - name: restricttotopic
          parameters:
            valid_topics: ["technology", "support"]

  input:
    flows:
      - guardrailsai check input $validator="guardrails_pii"
  output:
    flows:
      - guardrailsai check output $validator="toxic_language"
      - guardrailsai check output $validator="restricttotopic"
```

**Correct -- Colang 2.0 fact-checking rails:**
```text
define flow answer question with facts
  """Enable fact-checking for RAG responses."""
  user ...
  $answer = execute rag()
  $check_facts = True
  bot $answer

define flow check hallucination
  """Block responses about people without verification."""
  user ask about people
  $check_hallucination = True
  bot respond about people
```

**Correct -- Guardrails AI validators in Python:**
```python
from guardrails import Guard
from guardrails.hub import ToxicLanguage, DetectPII, RestrictToTopic, ValidLength

guard = Guard().use_many(
    ToxicLanguage(threshold=0.5, on_fail="filter"),
    DetectPII(pii_entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "SSN"], on_fail="fix"),
    RestrictToTopic(valid_topics=["technology", "support"], on_fail="refrain"),
    ValidLength(min=10, max=500, on_fail="reask"),
)

# Always validate BOTH input and output
input_result = input_guard.validate(user_input)
if not input_result.validation_passed:
    return "Invalid input"

llm_output = llm.generate(input_result.validated_output)
output_result = guard(llm_api=openai.chat.completions.create, model="gpt-5.2",
                      messages=[{"role": "user", "content": user_input}])

if output_result.validation_passed:
    return output_result.validated_output
```

Key decisions:
- NeMo for programmable flows (Colang 2.0), Guardrails AI for validators
- Toxicity threshold: 0.5 for content apps, 0.3 for children's apps
- PII handling: Redact for logs, block for outputs
- Topic restriction: Allowlist preferred over blocklist
- Always validate both input AND output
- Never use single validation layer

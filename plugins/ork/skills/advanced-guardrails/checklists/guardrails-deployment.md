# Guardrails Deployment Checklist

Pre-deployment validation for LLM guardrails.

## Input Validation

- [ ] Input sanitization enabled (remove injection patterns)
- [ ] PII detection configured for input
- [ ] Topic restriction defined (allowlist/blocklist)
- [ ] Input length limits set
- [ ] Encoding detection (base64, unicode tricks)

## Output Validation

- [ ] Toxicity detection enabled (threshold: 0.5 for general, 0.3 for sensitive)
- [ ] PII redaction enabled for output
- [ ] Hallucination detection configured
- [ ] Output length limits set
- [ ] Topic restriction enforced on output

## NeMo Guardrails (if using)

- [ ] `config.yml` properly configured
- [ ] Input flows defined
- [ ] Output flows defined
- [ ] Colang rails written and tested
- [ ] Fact-checking enabled for factual domains

## Guardrails AI (if using)

- [ ] Validators installed from Hub
- [ ] `on_fail` actions configured (filter/fix/reask/refrain)
- [ ] Guard chain ordered correctly
- [ ] Validator thresholds tuned

## Red Teaming

- [ ] Prompt injection tests passed
- [ ] Jailbreak tests passed (DAN, roleplay, context manipulation)
- [ ] Multi-turn attack tests passed (GOAT-style)
- [ ] Encoding bypass tests passed
- [ ] PII extraction tests passed

## OWASP LLM Top 10 Coverage

- [ ] LLM01: Prompt Injection - Input rails + sanitization
- [ ] LLM02: Insecure Output - Output validation + sanitization
- [ ] LLM04: Model DoS - Rate limiting + token budgets
- [ ] LLM06: Sensitive Info - PII detection + context separation
- [ ] LLM07: Insecure Plugin - Tool validation
- [ ] LLM08: Excessive Agency - Human-in-loop rails
- [ ] LLM09: Overreliance - Factuality checking

## Performance

- [ ] Guardrail latency acceptable (<100ms for sync)
- [ ] Async validation for non-blocking operations
- [ ] Caching configured for repeated validations
- [ ] Fallback behavior defined for guardrail failures

## Monitoring

- [ ] Guardrail violations logged
- [ ] False positive rate tracked
- [ ] Red team results documented
- [ ] Regular review schedule defined

## Documentation

- [ ] Guardrail configuration documented
- [ ] Bypass procedures documented (for authorized use)
- [ ] Incident response procedures defined
- [ ] Update/maintenance procedures documented

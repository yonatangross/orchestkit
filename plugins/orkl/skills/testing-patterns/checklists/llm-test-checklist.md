# LLM Testing Checklist

## Test Environment Setup

- [ ] Install DeepEval: `pip install deepeval`
- [ ] Install RAGAS: `pip install ragas`
- [ ] Configure VCR.py for API recording
- [ ] Set up golden dataset fixtures
- [ ] Configure mock LLM for unit tests
- [ ] Set API keys for integration tests (not hardcoded!)

## Test Coverage Checklist

### Unit Tests

- [ ] Mock LLM responses for deterministic tests
- [ ] Test structured output schema validation
- [ ] Test timeout handling
- [ ] Test error handling (API errors, rate limits)
- [ ] Test input validation
- [ ] Test output parsing

### Integration Tests

- [ ] Test against recorded responses (VCR.py)
- [ ] Test with golden dataset
- [ ] Test quality gates
- [ ] Test retry logic
- [ ] Test fallback behavior

### Quality Tests

- [ ] Answer relevancy (DeepEval/RAGAS)
- [ ] Faithfulness to context
- [ ] Hallucination detection
- [ ] Contextual precision/recall
- [ ] Custom criteria (G-Eval)

## Edge Cases to Test

For every LLM integration, test:

- [ ] **Empty inputs:** Empty strings, None values
- [ ] **Very long inputs:** Truncation behavior
- [ ] **Timeouts:** Fail-open behavior
- [ ] **Partial responses:** Incomplete outputs
- [ ] **Invalid schema:** Validation failures
- [ ] **Division by zero:** Empty list averaging
- [ ] **Nested nulls:** Parent exists, child is None
- [ ] **Unicode:** Non-ASCII characters
- [ ] **Injection:** Prompt injection attempts

## Quality Metrics Checklist

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| Answer Relevancy | ≥ 0.7 | Response addresses question |
| Faithfulness | ≥ 0.8 | Output matches context |
| Hallucination | ≤ 0.3 | No fabricated facts |
| Context Precision | ≥ 0.7 | Retrieved contexts relevant |
| Context Recall | ≥ 0.7 | All relevant contexts retrieved |

## CI/CD Checklist

- [ ] LLM tests use mocks or VCR (no live API calls)
- [ ] API keys not exposed in logs
- [ ] Timeout configured for all LLM calls
- [ ] Quality gate tests run on PR
- [ ] Golden dataset regression tests run on merge

## Golden Dataset Requirements

- [ ] Minimum 50 test cases for statistical significance
- [ ] Cover all major use cases
- [ ] Include edge cases
- [ ] Include expected failures
- [ ] Version controlled
- [ ] Updated when behavior changes intentionally

## Review Checklist

Before PR:

- [ ] All LLM calls are mocked in unit tests
- [ ] VCR cassettes recorded for integration tests
- [ ] Timeout handling tested
- [ ] Error scenarios covered
- [ ] Schema validation tested
- [ ] Quality metrics meet thresholds
- [ ] No hardcoded API keys

## Anti-Patterns to Avoid

- [ ] Testing against live LLM APIs in CI
- [ ] Using random seeds (non-deterministic)
- [ ] No timeout handling
- [ ] Single metric evaluation
- [ ] Hardcoded API keys in tests
- [ ] Ignoring rate limits
- [ ] Not testing error paths

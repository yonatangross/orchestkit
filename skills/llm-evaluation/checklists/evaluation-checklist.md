# LLM Evaluation Checklist

## Evaluation Design

- [ ] Define clear evaluation objectives
- [ ] Select appropriate metrics for use case
- [ ] Set realistic thresholds (not too high!)
- [ ] Choose judge model different from evaluated model
- [ ] Prepare diverse test dataset (50+ cases minimum)

## Metric Selection

### RAG Pipelines

- [ ] Faithfulness (answer grounded in context)
- [ ] Context Precision (relevant contexts retrieved)
- [ ] Context Recall (all relevant contexts retrieved)
- [ ] Answer Relevancy (answer addresses question)

### Generative Tasks

- [ ] Coherence
- [ ] Helpfulness
- [ ] Relevance
- [ ] Accuracy/Factuality

### Domain-Specific

- [ ] Safety (medical, legal)
- [ ] Actionability
- [ ] Compliance

## Dataset Requirements

- [ ] Minimum 50 test cases for statistical significance
- [ ] Diverse inputs (edge cases, typical cases)
- [ ] Ground truth available for key metrics
- [ ] No data leakage from training set
- [ ] Representative of production distribution

## Evaluation Process

- [ ] Use multiple evaluation dimensions (3-5)
- [ ] Calculate confidence intervals
- [ ] Compare against baseline
- [ ] Track metrics over time
- [ ] Document evaluation methodology

## Quality Gate Setup

- [ ] Define threshold for each metric
- [ ] Set overall pass/fail criteria
- [ ] Configure retry logic for failures
- [ ] Implement feedback generation
- [ ] Log all evaluations for analysis

## Statistical Rigor

- [ ] Calculate confidence intervals (95%)
- [ ] Report sample size
- [ ] Use appropriate statistical tests
- [ ] Account for multiple comparisons
- [ ] Document limitations

## Observability Integration

- [ ] Log scores to Langfuse/LangSmith
- [ ] Track score distributions
- [ ] Set up alerting for score drops
- [ ] Create dashboards for monitoring
- [ ] Store evaluation artifacts

## Common Pitfalls to Avoid

- [ ] Using same model as judge and evaluated
- [ ] Single dimension evaluation
- [ ] Threshold too high (> 0.9)
- [ ] Small sample size (< 50)
- [ ] No baseline comparison
- [ ] Ignoring confidence intervals
- [ ] Not tracking over time

## Review Checklist

Before deployment:

- [ ] Evaluation methodology documented
- [ ] Thresholds justified and realistic
- [ ] Statistical significance achieved
- [ ] Edge cases tested
- [ ] Comparison to baseline complete
- [ ] Observability configured
- [ ] Quality gates integrated

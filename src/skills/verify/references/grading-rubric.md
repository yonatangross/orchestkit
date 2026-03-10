# Verification Grading Rubric

0-10 scoring criteria for each verification dimension.

## Score Levels

| Range | Level | Description |
|-------|-------|-------------|
| 0-3 | Poor | Critical issues, blocks merge |
| 4-6 | Adequate | Functional but needs improvement |
| 7-9 | Good | Ready for merge, minor suggestions |
| 10 | Excellent | Exemplary, reference quality |

---

## Dimension Rubrics

<!-- Weights from canonical source: ../references/quality-model.md — keep in sync -->

### Correctness (Weight: 14%)

| Score | Criteria |
|-------|----------|
| 10 | All functional requirements met, edge cases handled, zero regressions |
| 8-9 | Core requirements met, most edge cases handled |
| 6-7 | Core paths work, some edge cases missing |
| 4-5 | Partial functionality, notable gaps |
| 1-3 | Broken core paths |
| 0 | Does not run |

### Maintainability (Weight: 14%)

| Score | Criteria |
|-------|----------|
| 10 | Zero lint errors/warnings, strict types, exemplary patterns, low complexity |
| 8-9 | Zero errors, < 5 warnings, minimal `any`, good patterns |
| 6-7 | 1-3 errors, some warnings, acceptable patterns |
| 4-5 | 4-10 errors, pattern issues, needs refactoring |
| 1-3 | Many errors, poor patterns, high complexity |
| 0 | Lint/type check fails to run |

### Performance (Weight: 11%)

| Score | Criteria |
|-------|----------|
| 10 | p99 within budget, zero N+1, optimal caching, efficient resource usage |
| 8-9 | Good latency, no N+1, reasonable caching |
| 6-7 | Acceptable latency, minor inefficiencies |
| 4-5 | Notable bottlenecks, missing caching |
| 1-3 | Severe bottlenecks, resource leaks |
| 0 | Unresponsive or crashes under load |

### Security (Weight: 18%)

| Score | Criteria |
|-------|----------|
| 10 | No vulnerabilities, all OWASP compliant, secure by design |
| 8-9 | No critical/high, all OWASP, excellent practices |
| 6-7 | No critical, 1-2 high, most OWASP compliant |
| 4-5 | No critical, 3-5 high, some gaps |
| 1-3 | 1+ critical or many high vulnerabilities |
| 0 | Multiple critical, secrets exposed |

### Scalability (Weight: 9%)

| Score | Criteria |
|-------|----------|
| 10 | Horizontal scaling ready, stateless design, efficient data patterns |
| 8-9 | Good scaling patterns, minor bottlenecks |
| 6-7 | Scales for current needs, some concerns |
| 4-5 | Will hit limits soon, needs rework |
| 1-3 | Single-instance only, monolithic state |
| 0 | Cannot handle production load |

### Testability (Weight: 12%)

| Score | Criteria |
|-------|----------|
| 10 | >= 90% coverage, meaningful assertions, edge cases, no flaky tests |
| 8-9 | >= 80% coverage, good assertions, critical paths |
| 6-7 | >= 70% coverage (target), basic assertions |
| 4-5 | 50-69% coverage |
| 1-3 | 30-49% coverage |
| 0 | < 30% coverage or tests fail to run |

### Compliance (Weight: 12%)

| Score | Criteria |
|-------|----------|
| 10 | Perfect REST/UI contracts, RFC 9457 errors, full Zod, WCAG AA |
| 8-9 | Good conventions, proper validation, accessibility |
| 6-7 | Acceptable patterns, minor inconsistencies |
| 4-5 | Several convention violations |
| 1-3 | Poor API/UI design, missing validation |
| 0 | Broken contracts or inaccessible |

### Visual (Weight: 10%)

| Score | Criteria |
|-------|----------|
| 10 | Pixel-perfect layout, full a11y, complete content, responsive |
| 8-9 | Good layout, minor visual issues, WCAG AA |
| 6-7 | Acceptable layout, some a11y gaps |
| 4-5 | Layout issues, missing content, a11y problems |
| 1-3 | Broken layout, major content missing |
| 0 | Page fails to render |

> **Note**: Visual weight is 0.00 for API-only projects — redistributed proportionally. See [Quality Model](quality-model.md).

---

## Grade Interpretation

<!-- Canonical source: quality-model.md — keep in sync -->

| Composite | Grade | Verdict |
|-----------|-------|---------|
| 9.0-10.0 | A+ | EXCELLENT |
| 8.0-8.9 | A | READY FOR MERGE |
| 7.0-7.9 | B | READY FOR MERGE |
| 6.0-6.9 | C | IMPROVEMENTS RECOMMENDED |
| 5.0-5.9 | D | IMPROVEMENTS RECOMMENDED |
| 0.0-4.9 | F | BLOCKED |

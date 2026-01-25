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

### Code Quality (Weight: 20%)

| Score | Criteria |
|-------|----------|
| 10 | Zero lint errors/warnings, strict types, exemplary patterns |
| 8-9 | Zero errors, < 5 warnings, minimal `any`, good patterns |
| 6-7 | 1-3 errors, some warnings, acceptable patterns |
| 4-5 | 4-10 errors, pattern issues, needs refactoring |
| 1-3 | Many errors, poor patterns, high complexity |
| 0 | Lint/type check fails to run |

### Security (Weight: 25%)

| Score | Criteria |
|-------|----------|
| 10 | No vulnerabilities, all OWASP compliant, secure by design |
| 8-9 | No critical/high, all OWASP, excellent practices |
| 6-7 | No critical, 1-2 high, most OWASP compliant |
| 4-5 | No critical, 3-5 high, some gaps |
| 1-3 | 1+ critical or many high vulnerabilities |
| 0 | Multiple critical, secrets exposed |

### Test Coverage (Weight: 20%)

| Score | Criteria |
|-------|----------|
| 10 | >= 90% coverage, meaningful assertions, edge cases |
| 8-9 | >= 80% coverage, good assertions, critical paths |
| 6-7 | >= 70% coverage (target), basic assertions |
| 4-5 | 50-69% coverage |
| 1-3 | 30-49% coverage |
| 0 | < 30% coverage or tests fail to run |

### API Compliance (Weight: 20%)

| Score | Criteria |
|-------|----------|
| 10 | Perfect REST, RFC 9457 errors, documented, no N+1 |
| 8-9 | Good REST, proper validation, timeout protection |
| 6-7 | Acceptable API, minor inconsistencies |
| 4-5 | Several convention violations |
| 1-3 | Poor API design, missing validation |
| 0 | Broken or insecure endpoints |

### UI Compliance (Weight: 15%)

| Score | Criteria |
|-------|----------|
| 10 | React 19 APIs, full Zod, WCAG AAA, exhaustive types |
| 8-9 | Modern patterns, good validation, WCAG AA |
| 6-7 | Acceptable patterns, some validation |
| 4-5 | Dated patterns, missing validation |
| 1-3 | Poor practices, accessibility issues |
| 0 | Broken or inaccessible components |

---

## Grade Interpretation

| Composite | Grade | Verdict |
|-----------|-------|---------|
| 9.0-10.0 | A+ | Ship it |
| 8.0-8.9 | A | Ready for merge |
| 7.0-7.9 | B | Minor improvements optional |
| 6.0-6.9 | C | Consider improvements |
| 5.0-5.9 | D | Improvements recommended |
| < 5.0 | F | Do not merge |

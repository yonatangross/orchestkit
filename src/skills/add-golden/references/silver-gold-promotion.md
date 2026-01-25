# Silver-Gold Promotion System

## Two-Tier Overview

| Tier | Score Range | Description |
|------|-------------|-------------|
| Gold | >= 0.75 | Verified high-quality, production-ready |
| Silver | 0.55-0.74 | Promising content, needs maturation |
| Reject | < 0.55 | Does not meet minimum quality |

## Silver Criteria (Score 0.55-0.74)

Documents qualify for silver when:
- Quality score between 0.55 and 0.74
- No high-severity bias issues (bias score <= 5)
- Passes basic schema validation
- Has actionable improvement suggestions

## Gold Criteria (Score >= 0.75)

Documents qualify for gold when:
- Quality score >= 0.75
- Bias score <= 2
- All required fields complete
- Verified by at least one review cycle

## Promotion Workflow

1. **Minimum Aging**: 7 days in silver tier
2. **Quality Reassessment**: Re-run quality analysis
3. **Bias Re-check**: Confirm bias score <= 2
4. **Usage Metrics**: Retrieval success rate >= 80%
5. **No Negative Feedback**: No reported issues

## Promotion Decision

| Reassessment Score | Bias Score | Action |
|--------------------|------------|--------|
| >= 0.75 | <= 2 | Promote to Gold |
| >= 0.75 | > 2 | Keep in Silver, fix bias |
| 0.55-0.74 | Any | Keep in Silver |
| < 0.55 | Any | Demote to Reject |

## Demotion Conditions

Documents are demoted from Gold to Silver when:
- Quality drops below 0.75 on reassessment
- New bias issues discovered (score > 2)
- Multiple retrieval failures reported
- Content becomes outdated (technology deprecated)

Documents are rejected when:
- Quality drops below 0.55
- Severe bias discovered (score > 6)
- Critical factual errors identified

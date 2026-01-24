# Bias Detection Guide

## Types of Bias

| Type | Description | Detection Prompt |
|------|-------------|------------------|
| Technology | Unfairly favors specific tools/frameworks | "Does this dismiss alternatives without justification?" |
| Recency | Only covers latest, ignores stable/LTS | "Are older but valid approaches mentioned?" |
| Complexity | Assumes knowledge without stating | "Are prerequisites clearly listed?" |
| Vendor | Promotes specific products | "Are open-source alternatives mentioned?" |
| Geographic | Assumes US/Western context | "Does this consider i18n and global users?" |

## Severity Scoring

| Severity | Score Range | Criteria |
|----------|-------------|----------|
| Low | 0-2 | Minor omissions, no significant impact |
| Medium | 3-5 | Noticeable bias, may mislead some users |
| High | 6-10 | Severe bias, actively harmful or exclusionary |

## Detection Prompts by Type

### Technology Bias
- "Which alternatives are NOT mentioned?"
- "Is the comparison fair and balanced?"
- "Are limitations of the favored tool discussed?"

### Recency Bias
- "Is the LTS version mentioned alongside latest?"
- "Are migration paths from older versions discussed?"

### Complexity Bias
- "What background knowledge is assumed?"
- "Would a beginner understand the prerequisites?"

### Vendor Bias
- "Are competing products given equal treatment?"
- "Is pricing/licensing discussed objectively?"

### Geographic Bias
- "Are examples US-centric?"
- "Is timezone/locale handling addressed?"

## Mitigation Strategies

| Bias Type | Mitigation |
|-----------|------------|
| Technology | Add "Alternatives" section |
| Recency | Include "Version Compatibility" note |
| Complexity | Add "Prerequisites" section |
| Vendor | Add "Open-Source Options" subsection |
| Geographic | Add i18n considerations |

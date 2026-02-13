# Competitive Analysis Guide

Framework for systematic competitor research.

## Competitor Categories

```
DIRECT COMPETITORS
└── Same problem, same solution approach
└── Example: Cursor vs GitHub Copilot

INDIRECT COMPETITORS
└── Same problem, different solution
└── Example: AI coding vs traditional IDE plugins

POTENTIAL COMPETITORS
└── Adjacent players who could enter
└── Example: Cloud providers adding AI tools
```

## Competitive Analysis Framework

### 1. Identify Competitors

```bash
# GitHub search for similar projects
gh search repos "langgraph workflow" --sort stars --limit 10

# Check related topics
gh api search/repositories?q=topic:ai-agents --jq '.items[].full_name'
```

### 2. Build Competitor Profiles

```markdown
## Competitor: [Name]

### Overview
- Founded: [Year]
- Funding: $[Amount]
- Team size: [N]
- Headquarters: [Location]

### Product
- Core offering: [Description]
- Target segment: [Who they serve]
- Pricing: [Model and range]
- Technology: [Key tech stack]

### Positioning
- Value proposition: [Their pitch]
- Key differentiators: [What they claim]
- Messaging: [How they talk about themselves]

### Strengths
- [Strength 1]
- [Strength 2]

### Weaknesses
- [Weakness 1]
- [Weakness 2]

### Market Presence
- GitHub stars: [N]
- Monthly growth: [%]
- Community activity: [Active/Moderate/Low]
```

### 3. Feature Comparison Matrix

| Feature | Us | Competitor A | Competitor B | Competitor C |
|---------|-----|--------------|--------------|--------------|
| Core capability 1 | ✅ | ✅ | ❌ | ✅ |
| Core capability 2 | ✅ | ❌ | ✅ | ⚠️ |
| Integration X | ✅ | ✅ | ✅ | ❌ |
| Pricing (entry) | $X | $Y | $Z | $W |
| Open source | ✅ | ❌ | ✅ | ❌ |

### 4. Positioning Map

```
                    EASE OF USE
                        │
           ┌────────────┼────────────┐
           │    Us      │    [B]     │
HIGH ──────┼────────────┼────────────┼────── LOW
POWER      │            │            │   POWER
           │    [A]     │    [C]     │
           └────────────┼────────────┘
                        │
                    COMPLEXITY
```

### 5. SWOT Analysis

```
           HELPFUL              HARMFUL
         ┌─────────────┬─────────────┐
INTERNAL │ STRENGTHS   │ WEAKNESSES  │
         │ • Our tech  │ • Resources │
         │ • Our team  │ • Gaps      │
         ├─────────────┼─────────────┤
EXTERNAL │ OPPORTUN.   │ THREATS     │
         │ • Market    │ • [Comp A]  │
         │ • Trends    │ • Risks     │
         └─────────────┴─────────────┘
```

## GitHub Signals to Track

```bash
# Star count and growth
gh api repos/owner/repo --jq '{stars: .stargazers_count}'

# Issue activity (community engagement)
gh api repos/owner/repo --jq '{open_issues: .open_issues_count}'

# Recent releases (shipping velocity)
gh release list --repo owner/repo --limit 5

# Contributor count
gh api repos/owner/repo/contributors --jq 'length'
```

## Update Frequency

| Signal | Check Frequency |
|--------|-----------------|
| Star growth | Weekly |
| Release notes | Per release |
| Pricing changes | Monthly |
| Feature launches | Per announcement |
| Full analysis | Quarterly |

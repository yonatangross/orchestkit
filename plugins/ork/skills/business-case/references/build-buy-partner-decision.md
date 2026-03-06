# Build vs Buy vs Partner Decision Framework

Systematic approach for evaluating capability acquisition options.

## Decision Matrix

| Factor | BUILD | BUY | PARTNER |
|--------|-------|-----|---------|
| **Core differentiator?** | ✅ Yes | ❌ No | ⚠️ Maybe |
| **Competitive advantage?** | ✅ Yes | ❌ No | ⚠️ Depends |
| **In-house expertise?** | ✅ Have | ❌ Lack | ⚠️ Some |
| **Time to market critical?** | ❌ Slow | ✅ Fast | ✅ Fast |
| **Budget constrained?** | ❌ Higher upfront | ✅ Lower upfront | ⚠️ Varies |
| **Long-term control needed?** | ✅ Full | ❌ Limited | ⚠️ Negotiated |
| **Customization required?** | ✅ Full | ⚠️ Limited | ⚠️ Depends |

## Scoring Template

```markdown
## Build vs Buy vs Partner: [Capability Name]

### Scoring (1-5 each dimension)

| Dimension | BUILD | BUY | PARTNER |
|-----------|-------|-----|---------|
| Strategic Importance | | | |
| Capability Maturity | | | |
| Time to Value | | | |
| Total Cost (3yr) | | | |
| Risk Level | | | |
| **TOTAL** | | | |

### Recommendation: [BUILD/BUY/PARTNER]

### Rationale:
[Explain the decision]

### Conditions:
- [ ] [Condition 1]
- [ ] [Condition 2]
```

## Cost Considerations

### BUILD Costs
- Development (engineering time)
- Opportunity cost (what else could be built)
- Maintenance (10-20% annual)
- Infrastructure
- Hiring/training

### BUY Costs
- License/subscription fees
- Integration development
- Vendor lock-in risk
- Customization limitations
- Annual price increases

### PARTNER Costs
- Revenue share
- Dependency risk
- Integration complexity
- Coordination overhead
- Brand association risk

## Decision Tree

```
Is this a core differentiator?
├── YES → BUILD (protects competitive advantage)
└── NO → Is there a mature solution available?
         ├── YES → BUY (fastest time to value)
         └── NO → Is there a strategic partner?
                  ├── YES → PARTNER (shared risk/reward)
                  └── NO → BUILD (must create capability)
```

## Red Flags by Option

### BUILD Red Flags
- No in-house expertise
- Underestimated complexity
- "We can do it better"
- Core expertise elsewhere

### BUY Red Flags
- Heavy customization needed
- Vendor lock-in concerns
- Poor vendor track record
- Integration nightmares

### PARTNER Red Flags
- Misaligned incentives
- Competitor partnerships
- Unclear value split
- Dependency on partner roadmap

## 2026 Best Practices

- Revisit decisions quarterly (market changes fast)
- Consider AI/ML tool availability before building
- Evaluate open-source alternatives
- Factor in security/compliance requirements
- Include exit strategy in evaluation

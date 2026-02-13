# Devil's Advocate Prompts

Challenge templates for assumption testing. Find hidden flaws before implementation.

## Hidden Assumptions

- "What if the core assumption that [X] is wrong?"
- "This assumes [dependency] will always be available. What if it fails?"
- "We're assuming users will [behavior]. What evidence supports this?"

## Failure Modes

- "What if this fails because the data volume exceeds expectations?"
- "The hidden flaw in this approach is [single point of failure]."
- "At 10x scale, what breaks first?"
- "What's the worst-case recovery scenario?"

## Simpler Alternatives

- "Could we solve 80% of this with a much simpler solution?"
- "What if we just used [existing tool] instead of building this?"
- "Is this complexity justified by the requirements?"

## Maintenance Burden

- "In 2 years, will anyone understand why this was built this way?"
- "What technical debt does this create?"
- "How many dependencies are we adding?"

## Scaling Concerns

- "What happens when [resource] becomes the bottleneck?"
- "This works for 100 users. Does it work for 100,000?"
- "What's the migration path when this outgrows itself?"

## Security Holes

- "What's the attack surface we're introducing?"
- "If an attacker had access to [component], what could they do?"
- "Are we trusting user input anywhere we shouldn't?"

## Challenge Template

```
DEVIL'S ADVOCATE for: [idea name]

1. ASSUMPTIONS: What must be true for this to work?
2. FAILURE: How could this fail catastrophically?
3. SIMPLER: What's the 10x simpler alternative?
4. SCALE: What breaks at 10x load?
5. MAINTENANCE: What's the 2-year cost?

Severity: [Critical|High|Medium|Low] per concern
```

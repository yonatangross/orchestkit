# Common Brainstorming Pitfalls

Avoid these mistakes during brainstorming sessions.

## Pitfall 1: Information Overload

```
❌ BAD:
"Before we start, I need to know:
1. What's your tech stack?
2. How many users?
3. What's the budget?
..."

✅ GOOD:
"What problem does this solve for your users?"
[Wait for answer, then ask next question]
```

**Why:** Asking many questions at once prevents conversation flow.

## Pitfall 2: Single Approach

```
❌ BAD:
"Here's the solution: Use Redis for caching..."

✅ GOOD:
"I see three approaches:
1. Redis (fast, but adds infrastructure)
2. In-memory (simple, but doesn't scale)
3. Database cache (integrated, but slower)
Which trade-offs matter most?"
```

**Why:** Single approach suggests you haven't explored alternatives.

## Pitfall 3: Over-Engineering

```
❌ BAD:
"Let's use microservices, Kubernetes, Redis, Kafka..."

✅ GOOD:
"For 100 users/day, a monolith with PostgreSQL is sufficient.
We can split services later if needed."
```

**Why:** YAGNI. Start simple, scale when necessary.

## Pitfall 4: Ignoring Existing Code

```
❌ BAD:
"Let's rebuild with completely different architecture..."

✅ GOOD:
[Read existing code first]
"I see you're using Express + PostgreSQL.
Let's extend that pattern..."
```

**Why:** Consistency > novelty. Use existing patterns unless compelling reason to change.

## Pitfall 5: Premature Convergence

```
❌ BAD:
[After generating 3 ideas]
"Option B is clearly best, let's go with that."

✅ GOOD:
[Generate 10+ ideas first]
[Fast-check feasibility]
[Rate systematically]
"After evaluating all options, Option B scores highest because..."
```

**Why:** Filtering too early misses potentially better alternatives.

## Pitfall 6: Skipping Devil's Advocate

```
❌ BAD:
"This approach looks great, let's implement it!"

✅ GOOD:
"Let me challenge this approach:
- What assumptions are we making?
- How could this fail?
- What's the maintenance burden?"
```

**Why:** Unchallenged ideas often have hidden flaws.

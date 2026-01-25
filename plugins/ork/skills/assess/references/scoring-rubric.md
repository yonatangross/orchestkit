# Scoring Rubric Reference

Detailed scoring guidelines for each quality dimension.

## Correctness (Weight: 0.20)

### Score 9-10: Excellent
- All functionality works as documented
- All edge cases handled gracefully
- Comprehensive error handling
- No known bugs
- Types are accurate and complete

### Score 7-8: Good
- Core functionality works correctly
- Most edge cases handled
- Good error handling
- Minor edge cases might be missing
- Types mostly accurate

### Score 5-6: Adequate
- Main happy path works
- Some edge cases unhandled
- Basic error handling
- Known minor bugs exist
- Some type inaccuracies

### Score 3-4: Poor
- Functionality partially works
- Many edge cases fail
- Minimal error handling
- Multiple bugs present
- Significant type issues

### Score 1-2: Critical
- Core functionality broken
- No edge case handling
- Errors cause crashes
- Critical bugs
- Types unreliable

### Score 0: Broken
- Does not function at all
- Cannot be used

---

## Maintainability (Weight: 0.20)

### Score 9-10: Excellent
- Crystal clear code, self-documenting
- Perfect naming conventions
- Single responsibility everywhere
- Cyclomatic complexity < 5
- Any developer can understand immediately

### Score 7-8: Good
- Clear code with minor clarifications needed
- Good naming, occasional ambiguity
- Mostly single responsibility
- Cyclomatic complexity < 10
- Reasonable onboarding time

### Score 5-6: Adequate
- Understandable with effort
- Mixed naming quality
- Some large functions
- Cyclomatic complexity < 15
- Requires context to understand

### Score 3-4: Poor
- Difficult to understand
- Poor naming choices
- Multiple responsibilities mixed
- Cyclomatic complexity 15-20
- Requires original author to explain

### Score 1-2: Critical
- Incomprehensible
- Meaningless names
- Massive functions
- Cyclomatic complexity > 20
- "Here be dragons"

### Score 0: Broken
- Cannot be maintained at all

---

## Performance (Weight: 0.15)

### Score 9-10: Excellent
- Optimal algorithm choices
- No unnecessary operations
- Proper caching
- Async where beneficial
- Measured and optimized

### Score 7-8: Good
- Good algorithm choices
- Minor inefficiencies
- Some caching
- Async used appropriately
- No major bottlenecks

### Score 5-6: Adequate
- Acceptable algorithms
- Some unnecessary operations
- Limited caching
- Missing async opportunities
- Noticeable but tolerable delays

### Score 3-4: Poor
- Suboptimal algorithms (O(n^2) in hot paths)
- Many unnecessary operations
- No caching strategy
- Blocking where should be async
- Noticeable performance issues

### Score 1-2: Critical
- Wrong algorithm choices
- Excessive operations
- Performance blockers
- User-impacting delays

### Score 0: Broken
- Unusable due to performance

---

## Security (Weight: 0.15)

### Score 9-10: Excellent
- All OWASP Top 10 addressed
- Input validation everywhere
- Proper authentication/authorization
- Secrets managed correctly
- Security reviewed

### Score 7-8: Good
- Most security concerns addressed
- Good input validation
- Proper auth patterns
- No obvious vulnerabilities
- Minor improvements possible

### Score 5-6: Adequate
- Basic security in place
- Some validation gaps
- Auth works but could be tighter
- No critical vulnerabilities
- Needs security review

### Score 3-4: Poor
- Security gaps present
- Missing input validation
- Auth issues
- Potential vulnerabilities
- Should not be in production

### Score 1-2: Critical
- Security vulnerabilities present
- No input validation
- Broken auth
- Active exploit potential

### Score 0: Broken
- Actively exploitable

---

## Scalability (Weight: 0.15)

### Score 9-10: Excellent
- Horizontally scalable
- Stateless design
- Proper queuing/caching
- Handles 10x growth easily
- Load tested

### Score 7-8: Good
- Mostly scalable
- Minimal state
- Some bottlenecks identified
- Handles 5x growth
- Scaling path clear

### Score 5-6: Adequate
- Scales with limitations
- Some state management
- Known bottlenecks
- Handles 2x growth
- Scaling requires work

### Score 3-4: Poor
- Limited scalability
- Stateful design
- Multiple bottlenecks
- Near capacity
- Scaling is a project

### Score 1-2: Critical
- Does not scale
- Single point of failure
- Already at capacity

### Score 0: Broken
- Cannot handle current load

---

## Testability (Weight: 0.15)

### Score 9-10: Excellent
- >90% coverage
- Meaningful assertions
- Edge cases tested
- Fast, deterministic tests
- Easy to add new tests

### Score 7-8: Good
- >80% coverage
- Good assertions
- Main paths tested
- Mostly fast tests
- Reasonable to add tests

### Score 5-6: Adequate
- >70% coverage
- Basic assertions
- Happy path tested
- Some slow tests
- Tests can be added

### Score 3-4: Poor
- >50% coverage
- Weak assertions
- Coverage gaps
- Flaky tests
- Hard to test

### Score 1-2: Critical
- <50% coverage
- Minimal assertions
- Critical paths untested
- Many flaky tests

### Score 0: Broken
- No tests or tests don't run

# Property-Based Testing Checklist

## Strategy Design
- [ ] Strategies generate valid domain objects
- [ ] Bounded strategies (avoid unbounded text/lists)
- [ ] Filter usage minimized (prefer direct generation)
- [ ] Custom composite strategies for domain types
- [ ] Strategies registered for `st.from_type()` usage

## Properties to Test
- [ ] **Roundtrip**: encode(decode(x)) == x
- [ ] **Idempotence**: f(f(x)) == f(x)
- [ ] **Invariants**: properties that hold for all inputs
- [ ] **Oracle**: compare against reference implementation
- [ ] **Commutativity**: f(a, b) == f(b, a) where applicable

## Profile Configuration
- [ ] `dev` profile: 10 examples, verbose
- [ ] `ci` profile: 100 examples, print_blob=True
- [ ] `thorough` profile: 1000 examples
- [ ] Environment variable loads correct profile

## Database Tests
- [ ] Limited examples (20-50)
- [ ] No example persistence (`database=None`)
- [ ] Nested transactions for rollback per example
- [ ] Isolated from other hypothesis tests

## Stateful Testing
- [ ] State machine for complex interactions
- [ ] Invariants check after each step
- [ ] Preconditions prevent invalid operations
- [ ] Bundles for data flow between rules

## Health Checks
- [ ] Health check failures investigated (not just suppressed)
- [ ] Slow data generation optimized
- [ ] Large data generation has reasonable bounds

## Debugging
- [ ] `note()` used instead of `print()` for debugging
- [ ] Failing examples saved for reproduction
- [ ] Shrinking produces minimal counterexamples

## Integration
- [ ] Works with pytest fixtures
- [ ] Compatible with pytest-xdist (if used)
- [ ] CI pipeline runs property tests
- [ ] Coverage reports include property tests

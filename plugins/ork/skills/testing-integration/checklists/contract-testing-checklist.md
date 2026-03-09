# Contract Testing Checklist

## Consumer Side

### Test Setup
- [ ] Pact consumer/provider names match across teams
- [ ] Pact directory configured (`./pacts`)
- [ ] Pact files generated after test run
- [ ] Tests verify actual client code (not mocked)

### Matchers
- [ ] `Like()` used for dynamic values (IDs, timestamps)
- [ ] `Term()` used for enums and patterns
- [ ] `EachLike()` used for arrays with minimum specified
- [ ] `Format()` used for standard formats (UUID, datetime)
- [ ] No exact values where structure matters

### Provider States
- [ ] States describe business scenarios (not implementation)
- [ ] States are documented for provider team
- [ ] Parameterized states for dynamic data
- [ ] Error states covered (404, 422, 401, 500)

### Test Coverage
- [ ] Happy path requests tested
- [ ] Error responses tested
- [ ] All HTTP methods used by consumer tested
- [ ] All query parameters tested
- [ ] All headers tested

## Provider Side

### State Handlers
- [ ] All consumer states implemented
- [ ] States are idempotent (safe to re-run)
- [ ] Database changes rolled back after tests
- [ ] No shared mutable state between tests

### Verification
- [ ] Provider states endpoint exposed (test env only)
- [ ] Verification publishes results to broker
- [ ] `enable_pending` used for new consumers
- [ ] Consumer version selectors configured correctly

### Test Isolation
- [ ] Test database used (not production)
- [ ] External services mocked/stubbed
- [ ] Each test starts with clean state

## Pact Broker

### Publishing
- [ ] Consumer pacts published on every CI run
- [ ] Git SHA used as consumer version
- [ ] Branch name tagged
- [ ] Pact files NOT committed to git

### Verification
- [ ] Provider verifies on every CI run
- [ ] `can-i-deploy` check before deployment
- [ ] Deployments recorded with `record-deployment`
- [ ] Webhooks trigger provider builds on pact change

### CI/CD Integration
- [ ] Consumer job publishes pacts
- [ ] Provider job verifies (depends on consumer)
- [ ] Deploy job checks `can-i-deploy`
- [ ] Post-deploy records deployment

## Security

- [ ] Broker token stored as CI secret
- [ ] Provider state endpoint not in production
- [ ] No sensitive data in pact files
- [ ] Authentication tested with mock tokens

## Team Coordination

- [ ] Provider team aware of new contracts
- [ ] Breaking changes communicated before merge
- [ ] Consumer version selectors agreed upon
- [ ] Pending pact policy documented

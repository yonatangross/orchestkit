# E2E Testing Checklist

Comprehensive checklist for planning, implementing, and maintaining E2E tests with Playwright.

## Pre-Implementation

### Test Planning
- [ ] Identify critical user journeys to test
- [ ] Map out happy paths and error scenarios
- [ ] Determine test data requirements
- [ ] Decide on mocking strategy (API, SSE, external services)
- [ ] Plan for visual regression testing needs
- [ ] Identify accessibility requirements (WCAG 2.1 AA)
- [ ] Estimate test execution time and CI impact

### Environment Setup
- [ ] Install Playwright (`npm install -D @playwright/test`)
- [ ] Install browser binaries (`npx playwright install`)
- [ ] Create `playwright.config.ts` with base URL and timeouts
- [ ] Configure test directory structure (`tests/e2e/`)
- [ ] Set up Page Object pattern structure
- [ ] Configure CI environment (GitHub Actions, GitLab CI, etc.)
- [ ] Set up test database/backend for integration tests

### Test Data Strategy
- [ ] Create fixtures for common test scenarios
- [ ] Set up database seeding scripts
- [ ] Plan API mocking approach (mock server vs route interception)
- [ ] Create reusable test data generators
- [ ] Handle authentication/authorization test cases
- [ ] Plan for cleanup between tests

## Test Implementation

### Page Objects
- [ ] Create base page class with common utilities
- [ ] Implement page object for each major page/component
- [ ] Use semantic locators (role, label, test-id)
- [ ] Avoid brittle CSS/XPath selectors
- [ ] Encapsulate complex interactions in helper methods
- [ ] Add TypeScript types for type safety
- [ ] Document page object APIs

### Test Structure
- [ ] Follow Arrange-Act-Assert (AAA) pattern
- [ ] Use descriptive test names (should/when/given format)
- [ ] Group related tests with `test.describe()`
- [ ] Set up common state in `beforeEach()`
- [ ] Clean up resources in `afterEach()`
- [ ] Use test fixtures for shared setup
- [ ] Keep tests independent (no test interdependencies)

### Assertions
- [ ] Use specific assertions (`toHaveText` vs `toBeTruthy`)
- [ ] Assert on user-visible behavior, not implementation
- [ ] Verify loading states appear and disappear
- [ ] Check error messages and validation feedback
- [ ] Validate success states and confirmations
- [ ] Test navigation and URL changes
- [ ] Verify data persistence across page loads

### API Interactions
- [ ] Mock external API calls for reliability
- [ ] Test real API endpoints in integration tests
- [ ] Handle async operations properly (promises, awaits)
- [ ] Test timeout scenarios
- [ ] Verify retry logic
- [ ] Test rate limiting behavior
- [ ] Mock SSE/WebSocket streams

### SSE/Real-Time Features
- [ ] Test SSE connection establishment
- [ ] Verify progress updates stream correctly
- [ ] Test reconnection on connection drop
- [ ] Handle SSE error events
- [ ] Test SSE completion and cleanup
- [ ] Verify UI updates from SSE events
- [ ] Test SSE with network throttling

### Error Handling
- [ ] Test form validation errors
- [ ] Test API error responses (400, 500, etc.)
- [ ] Test network failures
- [ ] Test timeout scenarios
- [ ] Verify error messages shown to user
- [ ] Test retry/recovery mechanisms
- [ ] Test graceful degradation

### Loading States
- [ ] Test loading spinners appear
- [ ] Verify skeleton screens render
- [ ] Test loading state timeouts
- [ ] Check loading states disappear on completion
- [ ] Test loading state cancellation
- [ ] Verify loading indicators are accessible

### Responsive Design
- [ ] Test on desktop viewports (1920x1080, 1366x768)
- [ ] Test on tablet viewports (768x1024, 1024x768)
- [ ] Test on mobile viewports (375x667, 414x896)
- [ ] Verify touch interactions on mobile
- [ ] Test responsive navigation menus
- [ ] Verify content reflow on viewport changes
- [ ] Test orientation changes (portrait/landscape)

### Accessibility
- [ ] Test keyboard navigation (Tab, Enter, Escape, arrows)
- [ ] Verify focus management (focus visible, focus traps)
- [ ] Test screen reader announcements (aria-live, role=status)
- [ ] Check ARIA labels and descriptions
- [ ] Test color contrast (use automated tools)
- [ ] Verify form labels and error associations
- [ ] Test with browser accessibility extensions
- [ ] Consider adding axe-core integration

### Visual Regression
- [ ] Identify components/pages for screenshot testing
- [ ] Set up baseline screenshots
- [ ] Configure pixel diff thresholds
- [ ] Test responsive breakpoints visually
- [ ] Test theme variations (light/dark mode)
- [ ] Test different locales (i18n)
- [ ] Update baselines when designs change

## Code Quality

### Test Maintainability
- [ ] Avoid test duplication (use helpers, fixtures)
- [ ] Use constants for magic strings/numbers
- [ ] Keep tests readable (avoid over-abstraction)
- [ ] Add comments for complex test logic
- [ ] Refactor brittle tests
- [ ] Remove flaky tests or fix root cause
- [ ] Review test coverage regularly

### Performance
- [ ] Run tests in parallel where possible
- [ ] Minimize test execution time (mock slow APIs)
- [ ] Use `test.describe.configure({ mode: 'parallel' })`
- [ ] Avoid unnecessary waits (`waitForTimeout`)
- [ ] Use strategic waits (`waitForSelector`, `waitForLoadState`)
- [ ] Optimize page load times (disable unnecessary assets)
- [ ] Profile slow tests and optimize

### Flakiness Prevention
- [ ] Use deterministic waits (waitFor* methods)
- [ ] Avoid race conditions (wait for element visibility)
- [ ] Handle timing issues (debounce, throttle)
- [ ] Retry flaky tests in CI (max 2 retries)
- [ ] Investigate and fix root cause of flakiness
- [ ] Use `test.slow()` for long-running tests
- [ ] Increase timeouts for legitimate slow operations

## CI/CD Integration

### Pipeline Configuration
- [ ] Add E2E test job to CI pipeline
- [ ] Run tests on every PR
- [ ] Block merge on test failures
- [ ] Run tests against staging environment
- [ ] Configure test parallelization in CI
- [ ] Set up test result reporting
- [ ] Archive test artifacts (videos, screenshots, traces)

### Environment Management
- [ ] Use Docker Compose for backend services
- [ ] Seed test database before test run
- [ ] Run migrations before tests
- [ ] Clean up test data after run
- [ ] Use environment variables for config
- [ ] Isolate test environments (per PR if possible)
- [ ] Monitor test environment health

### Monitoring & Reporting
- [ ] Generate HTML test reports
- [ ] Upload test artifacts to CI
- [ ] Send notifications on test failures
- [ ] Track test execution time trends
- [ ] Monitor test flakiness rates
- [ ] Set up dashboard for test metrics
- [ ] Alert on sustained test failures

## SkillForge-Specific

### Analysis Flow Tests
- [ ] Test URL submission with validation
- [ ] Test analysis progress SSE stream
- [ ] Verify agent status updates (8 agents)
- [ ] Test progress bar updates (0% to 100%)
- [ ] Test analysis completion detection
- [ ] Test artifact generation
- [ ] Test navigation to artifact view

### Agent Orchestration
- [ ] Verify supervisor assigns tasks
- [ ] Test worker agent execution
- [ ] Verify quality gate checks
- [ ] Test agent failure handling
- [ ] Test partial completion scenarios
- [ ] Verify agent status badges

### Artifact Display
- [ ] Test artifact metadata display
- [ ] Verify quality scores shown
- [ ] Test findings/recommendations rendering
- [ ] Test artifact search functionality
- [ ] Test section navigation (tabs)
- [ ] Test download artifact feature
- [ ] Test share/copy link feature

### Error Scenarios
- [ ] Test invalid URL submission
- [ ] Test network timeout during analysis
- [ ] Test SSE connection drop
- [ ] Test analysis cancellation
- [ ] Test concurrent analysis limit
- [ ] Test backend service unavailable
- [ ] Test rate limiting

### Performance Tests
- [ ] Test with large artifact (many findings)
- [ ] Test SSE with high event frequency
- [ ] Test concurrent analyses (multiple tabs)
- [ ] Test long-running analysis (timeout)
- [ ] Monitor memory leaks during SSE stream

## Maintenance

### Regular Tasks
- [ ] Review and update tests after feature changes
- [ ] Update page objects when UI changes
- [ ] Update test data when backend schema changes
- [ ] Refactor duplicate test code
- [ ] Remove obsolete tests
- [ ] Update dependencies (Playwright, browsers)
- [ ] Review test coverage and add missing tests

### When Tests Fail
- [ ] Check if failure is legitimate regression
- [ ] Review CI logs and screenshots
- [ ] Download and analyze trace files
- [ ] Reproduce locally with `--debug` flag
- [ ] Fix root cause (not just update assertions)
- [ ] Add regression test if bug found
- [ ] Update documentation if expected behavior changed

### Optimization
- [ ] Profile slow tests and optimize
- [ ] Reduce unnecessary API calls
- [ ] Optimize page object selectors
- [ ] Minimize test data setup
- [ ] Use test fixtures for common scenarios
- [ ] Run critical tests first (fail fast)
- [ ] Archive old test runs

## Documentation

### Test Documentation
- [ ] Document test structure in README
- [ ] Add comments for complex test logic
- [ ] Document page object APIs
- [ ] Create testing guide for contributors
- [ ] Document CI pipeline configuration
- [ ] Maintain test data documentation
- [ ] Document mocking strategies

### Knowledge Sharing
- [ ] Share test results in PR reviews
- [ ] Conduct test review sessions
- [ ] Create troubleshooting guide
- [ ] Document common test patterns
- [ ] Share CI optimization learnings
- [ ] Create onboarding guide for new contributors

## Quality Gates

### Before Committing
- [ ] All tests pass locally
- [ ] New tests added for new features
- [ ] No new flaky tests introduced
- [ ] Test execution time acceptable
- [ ] Code reviewed for maintainability
- [ ] Accessibility tests pass
- [ ] Visual regression tests updated

### Before Merging PR
- [ ] All CI tests pass
- [ ] No flaky test failures
- [ ] Test coverage maintained or improved
- [ ] Test artifacts reviewed (screenshots, videos)
- [ ] Performance impact assessed
- [ ] Breaking changes documented

### Before Production Deploy
- [ ] Full E2E suite passes on staging
- [ ] Performance tests pass
- [ ] Accessibility tests pass
- [ ] Visual regression tests reviewed
- [ ] Smoke tests identified for post-deploy
- [ ] Rollback plan documented

## Advanced Topics

### Cross-Browser Testing
- [ ] Test on Chromium (Chrome/Edge)
- [ ] Test on Firefox
- [ ] Test on WebKit (Safari)
- [ ] Handle browser-specific quirks
- [ ] Test with different browser versions

### Internationalization (i18n)
- [ ] Test with different locales
- [ ] Verify RTL languages (Arabic, Hebrew)
- [ ] Test date/time formatting
- [ ] Test currency formatting
- [ ] Verify translations loaded correctly

### Security Testing
- [ ] Test authentication flows
- [ ] Test authorization (role-based access)
- [ ] Test XSS prevention
- [ ] Test CSRF protection
- [ ] Test input sanitization
- [ ] Test secure headers (CSP, etc.)

### Performance Testing
- [ ] Measure page load time
- [ ] Test Core Web Vitals (LCP, FID, CLS)
- [ ] Test with network throttling
- [ ] Test with CPU throttling
- [ ] Monitor memory usage
- [ ] Test bundle size impact

## Success Metrics

- [ ] Test coverage > 80% for critical paths
- [ ] Test execution time < 10 minutes
- [ ] Test flakiness rate < 2%
- [ ] Zero P0 bugs in production from untested areas
- [ ] All critical user journeys tested
- [ ] 100% of new features have E2E tests
- [ ] Test results visible in every PR
- [ ] Tests block merge on failure

---

**Note:** This checklist is comprehensive but should be adapted to your project's specific needs. Not all items apply to every project. Prioritize based on risk, criticality, and available resources.

**SkillForge Priority:**
1. Analysis flow (URL → Progress → Artifact)
2. SSE real-time updates
3. Error handling and recovery
4. Agent orchestration visibility
5. Accessibility and responsive design

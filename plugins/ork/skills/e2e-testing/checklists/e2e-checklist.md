# E2E Testing Checklist

## Test Selection Checklist

Focus E2E tests on business-critical paths:

- [ ] **Authentication:** Signup, login, password reset, logout
- [ ] **Core Transaction:** Purchase, booking, submission, payment
- [ ] **Data Operations:** Create, update, delete critical entities
- [ ] **User Settings:** Profile update, preferences, notifications
- [ ] **Error Recovery:** Form validation, API errors, network issues

## Locator Strategy Checklist

- [ ] Use `getByRole()` as primary locator strategy
- [ ] Use `getByLabel()` for form inputs
- [ ] Use `getByPlaceholder()` when no label available
- [ ] Use `getByTestId()` only as last resort
- [ ] **AVOID** CSS selectors for user interactions
- [ ] **AVOID** XPath locators
- [ ] **AVOID** `page.click('[data-testid=...]')` - use `getByTestId` instead

## Test Implementation Checklist

For each test:

- [ ] Clear, descriptive test name
- [ ] Tests one user flow or scenario
- [ ] Uses semantic locators (getByRole, getByLabel)
- [ ] Waits for elements using Playwright's auto-wait
- [ ] No hardcoded `sleep()` or `wait()` calls
- [ ] Assertions use `expect()` with appropriate matchers
- [ ] Test can run in isolation (no dependencies on other tests)

## Page Object Checklist

For each page object:

- [ ] Locators defined in constructor
- [ ] Methods for user actions (login, submit, navigate)
- [ ] Assertion methods (expectError, expectSuccess)
- [ ] No direct `page.click()` calls - wrap in methods
- [ ] TypeScript types for all methods

## Configuration Checklist

- [ ] Set `baseURL` in config
- [ ] Configure browser(s) for testing
- [ ] Set up authentication state project
- [ ] Configure retries for CI (2-3 retries)
- [ ] Enable `failOnFlakyTests` in CI
- [ ] Set appropriate timeouts
- [ ] Configure screenshot on failure

## CI/CD Checklist

- [ ] Tests run in CI pipeline
- [ ] Artifacts (screenshots, traces) uploaded on failure
- [ ] Tests parallelized with sharding
- [ ] Auth state cached between runs
- [ ] Web server waits for ready signal

## Visual Regression Checklist

- [ ] Screenshots stored in version control
- [ ] Different screenshots per browser/platform
- [ ] Mobile viewports tested
- [ ] Dark mode tested (if applicable)
- [ ] Threshold set for acceptable diff

## Accessibility Checklist

- [ ] axe-core integrated for a11y testing
- [ ] Critical pages tested for violations
- [ ] Forms have proper labels
- [ ] Focus management tested
- [ ] Keyboard navigation tested

## Review Checklist

Before PR:

- [ ] All tests pass locally
- [ ] Tests are deterministic (no flakes)
- [ ] Locators follow semantic strategy
- [ ] No hardcoded waits
- [ ] Test files organized logically
- [ ] Page objects used for complex pages
- [ ] CI configuration updated if needed

## Anti-Patterns to Avoid

- [ ] Too many E2E tests (keep it focused)
- [ ] Testing non-critical paths
- [ ] Hard-coded waits (`await page.waitForTimeout()`)
- [ ] CSS/XPath selectors for interactions
- [ ] Tests that depend on each other
- [ ] Tests that modify global state
- [ ] Ignoring flaky test warnings

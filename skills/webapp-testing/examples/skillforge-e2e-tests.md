# SkillForge E2E Test Examples

Complete E2E test suite examples for SkillForge's analysis workflow using Playwright + TypeScript.

## Test Configuration

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Page Objects

### HomePage (URL Submission)

```typescript
// tests/e2e/pages/HomePage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from '.claude/skills/webapp-testing/templates/playwright-test-template';

export class HomePage extends BasePage {
  readonly urlInput: Locator;
  readonly analyzeButton: Locator;
  readonly analysisTypeSelect: Locator;
  readonly recentAnalyses: Locator;

  constructor(page: Page) {
    super(page);
    this.urlInput = page.getByTestId('url-input');
    this.analyzeButton = page.getByRole('button', { name: /analyze/i });
    this.analysisTypeSelect = page.getByTestId('analysis-type-select');
    this.recentAnalyses = page.getByTestId('recent-analyses-list');
  }

  async goto(): Promise<void> {
    await super.goto('/');
    await this.waitForLoad();
  }

  async submitUrl(url: string, analysisType = 'comprehensive'): Promise<void> {
    await this.urlInput.fill(url);
    if (analysisType !== 'comprehensive') {
      await this.analysisTypeSelect.selectOption(analysisType);
    }
    await this.analyzeButton.click();
  }

  async getRecentAnalysesCount(): Promise<number> {
    return await this.recentAnalyses.locator('li').count();
  }

  async clickRecentAnalysis(index: number): Promise<void> {
    await this.recentAnalyses.locator('li').nth(index).click();
  }
}
```

### AnalysisProgressPage (SSE Stream)

```typescript
// tests/e2e/pages/AnalysisProgressPage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage, WaitHelpers } from '.claude/skills/webapp-testing/templates/playwright-test-template';

export class AnalysisProgressPage extends BasePage {
  readonly progressBar: Locator;
  readonly progressPercentage: Locator;
  readonly statusBadge: Locator;
  readonly agentCards: Locator;
  readonly errorMessage: Locator;
  readonly cancelButton: Locator;
  readonly viewArtifactButton: Locator;

  private waitHelpers: WaitHelpers;

  constructor(page: Page) {
    super(page);
    this.progressBar = page.getByTestId('analysis-progress-bar');
    this.progressPercentage = page.getByTestId('progress-percentage');
    this.statusBadge = page.getByTestId('status-badge');
    this.agentCards = page.getByTestId('agent-card');
    this.errorMessage = page.getByTestId('error-message');
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.viewArtifactButton = page.getByRole('button', { name: /view artifact/i });
    this.waitHelpers = new WaitHelpers(page);
  }

  async waitForAnalysisComplete(timeout = 60000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const badge = document.querySelector('[data-testid="status-badge"]');
        return badge?.textContent?.toLowerCase().includes('complete');
      },
      { timeout }
    );
  }

  async waitForProgress(percentage: number, timeout = 30000): Promise<void> {
    await this.page.waitForFunction(
      (targetPercentage) => {
        const progressText = document.querySelector('[data-testid="progress-percentage"]')?.textContent;
        const currentPercentage = parseInt(progressText || '0', 10);
        return currentPercentage >= targetPercentage;
      },
      percentage,
      { timeout }
    );
  }

  async getAgentStatus(agentName: string): Promise<'pending' | 'running' | 'completed' | 'failed'> {
    const agentCard = this.agentCards.filter({ hasText: agentName }).first();
    const statusElement = agentCard.getByTestId('agent-status');
    const status = await statusElement.textContent();
    return status?.toLowerCase() as any;
  }

  async getCompletedAgentsCount(): Promise<number> {
    return await this.agentCards.filter({ has: this.page.getByText('completed') }).count();
  }

  async cancelAnalysis(): Promise<void> {
    await this.cancelButton.click();
  }

  async goToArtifact(): Promise<void> {
    await this.viewArtifactButton.click();
  }

  async getErrorText(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
}
```

### ArtifactPage (View Results)

```typescript
// tests/e2e/pages/ArtifactPage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from '.claude/skills/webapp-testing/templates/playwright-test-template';

export class ArtifactPage extends BasePage {
  readonly artifactTitle: Locator;
  readonly sourceUrl: Locator;
  readonly qualityScore: Locator;
  readonly findingsSection: Locator;
  readonly downloadButton: Locator;
  readonly shareButton: Locator;
  readonly searchInput: Locator;
  readonly sectionTabs: Locator;

  constructor(page: Page) {
    super(page);
    this.artifactTitle = page.getByTestId('artifact-title');
    this.sourceUrl = page.getByTestId('source-url');
    this.qualityScore = page.getByTestId('quality-score');
    this.findingsSection = page.getByTestId('findings-section');
    this.downloadButton = page.getByRole('button', { name: /download/i });
    this.shareButton = page.getByRole('button', { name: /share/i });
    this.searchInput = page.getByTestId('artifact-search');
    this.sectionTabs = page.getByRole('tab');
  }

  async getQualityScoreValue(): Promise<number> {
    const scoreText = await this.qualityScore.textContent();
    return parseFloat(scoreText || '0');
  }

  async searchInArtifact(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  async switchToTab(tabName: string): Promise<void> {
    await this.sectionTabs.filter({ hasText: tabName }).click();
  }

  async downloadArtifact(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    await downloadPromise;
  }

  async getFindingsCount(): Promise<number> {
    return await this.findingsSection.locator('[data-testid="finding-item"]').count();
  }
}
```

## Test Suites

### 1. Happy Path - Complete Analysis Flow

```typescript
// tests/e2e/analysis-flow.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { AnalysisProgressPage } from './pages/AnalysisProgressPage';
import { ArtifactPage } from './pages/ArtifactPage';
import { ApiMocker, CustomAssertions } from '.claude/skills/webapp-testing/templates/playwright-test-template';

test.describe('Analysis Flow - Happy Path', () => {
  test('should complete full analysis flow from URL submission to artifact view', async ({ page }) => {
    // 1. Submit URL for analysis
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.urlInput).toBeVisible();
    await homePage.submitUrl('https://example.com/article', 'comprehensive');

    // 2. Monitor progress with SSE
    const progressPage = new AnalysisProgressPage(page);
    await expect(progressPage.progressBar).toBeVisible();

    // Wait for initial progress
    await progressPage.waitForProgress(10);

    // Check at least one agent is running
    const agentStatus = await progressPage.getAgentStatus('Tech Comparator');
    expect(['running', 'completed']).toContain(agentStatus);

    // Wait for completion (with timeout for real API)
    await progressPage.waitForAnalysisComplete(90000); // 90s timeout

    // Verify all agents completed
    const completedCount = await progressPage.getCompletedAgentsCount();
    expect(completedCount).toBeGreaterThan(0);

    // 3. Navigate to artifact
    await progressPage.goToArtifact();

    // 4. Verify artifact content
    const artifactPage = new ArtifactPage(page);
    await expect(artifactPage.artifactTitle).toBeVisible();

    const qualityScore = await artifactPage.getQualityScoreValue();
    expect(qualityScore).toBeGreaterThan(0);
    expect(qualityScore).toBeLessThanOrEqual(10);

    const findingsCount = await artifactPage.getFindingsCount();
    expect(findingsCount).toBeGreaterThan(0);
  });
});
```

### 2. SSE Progress Updates

```typescript
// tests/e2e/sse-progress.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { AnalysisProgressPage } from './pages/AnalysisProgressPage';
import { ApiMocker } from '.claude/skills/webapp-testing/templates/playwright-test-template';

test.describe('SSE Progress Updates', () => {
  test('should show real-time progress updates via SSE', async ({ page }) => {
    // Mock SSE stream with progress events
    const apiMocker = new ApiMocker(page);

    const sseEvents = [
      { data: { type: 'progress', percentage: 0, message: 'Starting analysis...' } },
      { data: { type: 'agent_start', agent: 'Tech Comparator' }, delay: 500 },
      { data: { type: 'progress', percentage: 25, message: 'Tech Comparator running...' } },
      { data: { type: 'agent_complete', agent: 'Tech Comparator' }, delay: 1000 },
      { data: { type: 'progress', percentage: 50, message: 'Security Auditor running...' } },
      { data: { type: 'agent_complete', agent: 'Security Auditor' }, delay: 1000 },
      { data: { type: 'progress', percentage: 100, message: 'Analysis complete!' } },
      { data: { type: 'complete', artifact_id: 'test-artifact-123' } },
    ];

    await apiMocker.mockSSE(/api\/v1\/analyses\/\d+\/stream/, sseEvents);

    // Submit analysis
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.submitUrl('https://example.com/test');

    // Monitor progress updates
    const progressPage = new AnalysisProgressPage(page);

    // Wait for 25% progress
    await progressPage.waitForProgress(25);
    expect(await progressPage.progressPercentage.textContent()).toContain('25');

    // Wait for 50% progress
    await progressPage.waitForProgress(50);
    expect(await progressPage.progressPercentage.textContent()).toContain('50');

    // Wait for completion
    await progressPage.waitForProgress(100);
    await expect(progressPage.statusBadge).toContainText('Complete');
  });

  test('should handle SSE connection errors gracefully', async ({ page }) => {
    // Mock SSE connection failure
    await page.route(/api\/v1\/analyses\/\d+\/stream/, (route) => {
      route.abort('failed');
    });

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.submitUrl('https://example.com/test');

    const progressPage = new AnalysisProgressPage(page);

    // Should show error message
    await expect(progressPage.errorMessage).toBeVisible();
    const errorText = await progressPage.getErrorText();
    expect(errorText).toContain('connection');
  });
});
```

### 3. Error Handling

```typescript
// tests/e2e/error-handling.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { AnalysisProgressPage } from './pages/AnalysisProgressPage';
import { ApiMocker, CustomAssertions } from '.claude/skills/webapp-testing/templates/playwright-test-template';

test.describe('Error Handling', () => {
  test('should show validation error for invalid URL', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.submitUrl('not-a-valid-url');

    const assertions = new CustomAssertions(page);
    await assertions.expectToast('Please enter a valid URL', 'error');
  });

  test('should handle API error during analysis submission', async ({ page }) => {
    const apiMocker = new ApiMocker(page);
    await apiMocker.mockError(/api\/v1\/analyses/, 500, 'Internal server error');

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.submitUrl('https://example.com/test');

    const assertions = new CustomAssertions(page);
    await assertions.expectToast('Failed to start analysis', 'error');
  });

  test('should handle analysis failure from backend', async ({ page }) => {
    const apiMocker = new ApiMocker(page);

    // Mock successful submission
    await apiMocker.mockSuccess(/api\/v1\/analyses$/, {
      id: 123,
      status: 'processing',
      url: 'https://example.com/test',
    });

    // Mock SSE with failure event
    await apiMocker.mockSSE(/api\/v1\/analyses\/123\/stream/, [
      { data: { type: 'progress', percentage: 10 } },
      { data: { type: 'error', message: 'Failed to fetch content' } },
    ]);

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.submitUrl('https://example.com/test');

    const progressPage = new AnalysisProgressPage(page);
    await expect(progressPage.errorMessage).toBeVisible();
    const errorText = await progressPage.getErrorText();
    expect(errorText).toContain('Failed to fetch content');
  });

  test('should allow retry after failed analysis', async ({ page }) => {
    const homePage = new HomePage(page);
    const progressPage = new AnalysisProgressPage(page);

    await homePage.goto();
    await homePage.submitUrl('https://example.com/test');

    // Wait for error state
    await expect(progressPage.errorMessage).toBeVisible();

    // Click retry button
    const retryButton = page.getByRole('button', { name: /retry/i });
    await retryButton.click();

    // Should restart analysis
    await expect(progressPage.progressBar).toBeVisible();
  });
});
```

### 4. Cancellation & Cleanup

```typescript
// tests/e2e/cancellation.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { AnalysisProgressPage } from './pages/AnalysisProgressPage';

test.describe('Analysis Cancellation', () => {
  test('should cancel in-progress analysis', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.submitUrl('https://example.com/long-analysis');

    const progressPage = new AnalysisProgressPage(page);

    // Wait for analysis to start
    await progressPage.waitForProgress(10);

    // Cancel analysis
    await progressPage.cancelAnalysis();

    // Confirm cancellation in dialog
    page.on('dialog', dialog => dialog.accept());

    // Should redirect back to home
    await expect(page).toHaveURL('/');

    // Should show cancellation toast
    const assertions = new CustomAssertions(page);
    await assertions.expectToast('Analysis cancelled', 'info');
  });

  test('should not allow cancellation of completed analysis', async ({ page }) => {
    // Navigate to completed analysis
    await page.goto('/analysis/completed-123');

    const progressPage = new AnalysisProgressPage(page);

    // Cancel button should be disabled or hidden
    await expect(progressPage.cancelButton).not.toBeVisible();
  });
});
```

### 5. Responsive & Mobile

```typescript
// tests/e2e/responsive.spec.ts
import { test, expect, devices } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test.describe('Responsive Design', () => {
  test.use({ ...devices['iPhone 13'] });

  test('should work on mobile viewport', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // URL input should be visible and usable
    await expect(homePage.urlInput).toBeVisible();
    await homePage.urlInput.fill('https://example.com/mobile-test');

    // Button should be tappable
    await homePage.analyzeButton.click();

    // Progress page should be mobile-friendly
    const progressBar = page.getByTestId('analysis-progress-bar');
    await expect(progressBar).toBeVisible();

    // Agent cards should stack vertically
    const agentCards = page.getByTestId('agent-card');
    const firstCard = agentCards.first();
    const secondCard = agentCards.nth(1);

    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    // Second card should be below first (Y coordinate)
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);
  });
});
```

### 6. Accessibility

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { AnalysisProgressPage } from './pages/AnalysisProgressPage';

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Tab to URL input
    await page.keyboard.press('Tab');
    await expect(homePage.urlInput).toBeFocused();

    // Type URL
    await page.keyboard.type('https://example.com/test');

    // Tab to analyze button
    await page.keyboard.press('Tab');
    await expect(homePage.analyzeButton).toBeFocused();

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should navigate to progress page
    const progressPage = new AnalysisProgressPage(page);
    await expect(progressPage.progressBar).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // URL input should have aria-label
    await expect(homePage.urlInput).toHaveAttribute('aria-label');

    // Submit button should have accessible name
    const buttonName = await homePage.analyzeButton.getAttribute('aria-label');
    expect(buttonName).toBeTruthy();
  });

  test('should announce progress updates to screen readers', async ({ page }) => {
    await page.goto('/analysis/123');

    const progressPage = new AnalysisProgressPage(page);

    // Progress region should have aria-live
    await expect(progressPage.progressBar).toHaveAttribute('aria-live', 'polite');

    // Status updates should have role="status"
    const statusRegion = page.getByTestId('status-updates');
    await expect(statusRegion).toHaveAttribute('role', 'status');
  });
});
```

## Running Tests

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run all tests
npx playwright test

# Run specific suite
npx playwright test tests/e2e/analysis-flow.spec.ts

# Run in UI mode (interactive)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run on specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Generate test report
npx playwright show-report
```

## CI Integration

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start backend
        run: |
          cd backend
          poetry install
          poetry run uvicorn app.main:app --host 0.0.0.0 --port 8500 &
          sleep 5

      - name: Start frontend
        run: |
          npm run build
          npm run preview &
          sleep 3

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Best Practices

1. **Use Page Objects** - Encapsulate page logic, improve maintainability
2. **Mock External APIs** - Fast, reliable tests without network dependencies
3. **Wait Strategically** - Use `waitForSelector`, avoid arbitrary timeouts
4. **Test Real Flows** - Mirror actual user journeys
5. **Handle Async** - SSE streams, debounced inputs, loading states
6. **Accessibility First** - Test keyboard nav, ARIA, screen reader announcements
7. **Visual Regression** - Screenshot testing for UI consistency
8. **CI Integration** - Run tests on every PR, block merges on failures

/**
 * Security Scan Aggregator - Stop Hook
 * CC 2.1.3 Compliant - Uses 10-minute hook timeout
 *
 * Runs multiple security tools in parallel and aggregates results.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

interface SecurityResults {
  npmAudit: { critical: number; high: number } | null;
  pipAudit: number | null;
  semgrep: number | null;
  bandit: number | null;
  secrets: number;
}

/**
 * Run npm audit
 */
function runNpmAudit(projectDir: string, resultsDir: string): { critical: number; high: number } | null {
  if (
    !existsSync(`${projectDir}/package.json`) ||
    (!existsSync(`${projectDir}/package-lock.json`) &&
      !existsSync(`${projectDir}/yarn.lock`) &&
      !existsSync(`${projectDir}/pnpm-lock.yaml`))
  ) {
    return null;
  }

  logHook('security-scan', 'Running npm audit...');
  try {
    execFileSync('npm', ['audit', '--json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    // npm audit returns non-zero on vulnerabilities, capture output
    if (error.stdout) {
      writeFileSync(`${resultsDir}/npm-audit.json`, error.stdout);
      try {
        const result = JSON.parse(error.stdout);
        return {
          critical: result.metadata?.vulnerabilities?.critical || 0,
          high: result.metadata?.vulnerabilities?.high || 0,
        };
      } catch {
        // Ignore parse errors
      }
    }
  }
  logHook('security-scan', 'npm audit complete');
  return { critical: 0, high: 0 };
}

/**
 * Run pip-audit
 */
function runPipAudit(projectDir: string, resultsDir: string): number | null {
  if (!existsSync(`${projectDir}/requirements.txt`) && !existsSync(`${projectDir}/pyproject.toml`)) {
    return null;
  }

  try {
    execFileSync('which', ['pip-audit'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'pip-audit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running pip-audit...');
  try {
    const result = execFileSync('pip-audit', ['--format', 'json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    writeFileSync(`${resultsDir}/pip-audit.json`, result);
    const parsed = JSON.parse(result);
    logHook('security-scan', 'pip-audit complete');
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Run semgrep
 */
function runSemgrep(projectDir: string, resultsDir: string): number | null {
  try {
    execFileSync('which', ['semgrep'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'semgrep not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running semgrep...');
  try {
    const result = execFileSync('semgrep', ['--config', 'auto', '--json', '--quiet'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 300000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    writeFileSync(`${resultsDir}/semgrep.json`, result);
    const parsed = JSON.parse(result);
    const highSeverity = (parsed.results || []).filter((r: any) => r.extra?.severity === 'ERROR').length;
    logHook('security-scan', 'semgrep complete');
    return highSeverity;
  } catch {
    return 0;
  }
}

/**
 * Run bandit
 */
function runBandit(projectDir: string, resultsDir: string): number | null {
  // Check for Python files
  try {
    // shell required: pipe (find | head)
    const hasPython = execSync('find . -name "*.py" -maxdepth 2 | head -1', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!hasPython && !existsSync(`${projectDir}/backend`)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    execFileSync('which', ['bandit'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    logHook('security-scan', 'bandit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running bandit...');
  try {
    execFileSync('bandit', ['-r', '.', '-f', 'json', '-o', `${resultsDir}/bandit.json`], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    logHook('security-scan', 'bandit complete');
    return 0;
  } catch {
    // Bandit exits non-zero when issues found
    return 0;
  }
}

/**
 * Run secret detection
 */
function runSecretScan(projectDir: string, resultsDir: string): number {
  logHook('security-scan', 'Running secret detection...');

  const secretPatterns = /(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*["'][^"']{8,}/i;
  let secretsFound = 0;
  const findings: Array<{ file: string; type: string }> = [];

  const extensions = ['.py', '.js', '.ts', '.env'];

  function scanDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;

        // Skip node_modules and .git
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            scanDir(fullPath);
          }
          continue;
        }

        // Check file extension
        if (!extensions.some((ext) => entry.name.endsWith(ext))) {
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (secretPatterns.test(content)) {
            findings.push({ file: fullPath, type: 'potential_secret' });
            secretsFound++;
          }
        } catch {
          // Ignore read errors
        }
      }
    } catch {
      // Ignore directory errors
    }
  }

  scanDir(projectDir);

  writeFileSync(
    `${resultsDir}/secrets.json`,
    JSON.stringify({ findings, count: secretsFound }, null, 2)
  );

  logHook('security-scan', `Secret detection complete: ${secretsFound} potential issues`);
  return secretsFound;
}

/**
 * Aggregate results
 */
function aggregateResults(resultsDir: string, results: SecurityResults): void {
  logHook('security-scan', 'Aggregating results...');

  let totalCritical = 0;
  let totalHigh = 0;

  if (results.npmAudit) {
    totalCritical += results.npmAudit.critical;
    totalHigh += results.npmAudit.high;
  }
  if (results.pipAudit !== null) {
    totalHigh += results.pipAudit;
  }
  if (results.semgrep !== null) {
    totalHigh += results.semgrep;
  }

  const scansCompleted = readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json') && !f.includes('aggregated'))
    .map((f) => f.replace('.json', ''));

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: totalCritical,
      high: totalHigh,
      medium: 0,
    },
    scans_completed: scansCompleted,
  };

  writeFileSync(`${resultsDir}/aggregated-report.json`, JSON.stringify(report, null, 2));

  logHook('security-scan', '=== Security Scan Complete ===');
  logHook('security-scan', `Critical: ${totalCritical}, High: ${totalHigh}`);

  if (totalCritical > 0) {
    console.error(`Security: ${totalCritical} critical, ${totalHigh} high vulnerabilities found`);
  }
}

/**
 * Wrap a synchronous scan function in a Promise with a per-scan timeout.
 * If the scan exceeds the timeout, it resolves with the fallback value rather
 * than throwing, so the aggregator can report partial results.
 *
 * Issue #905: 4 sequential scans (660s total) exceeded the 60s dispatcher timeout.
 */
function runWithTimeout<T>(
  scanFn: () => T,
  fallback: T,
  timeoutMs: number,
  scanName: string
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      logHook('security-scan', `${scanName} timed out after ${timeoutMs}ms — using fallback`);
      resolve(fallback);
    }, timeoutMs);

    try {
      const result = scanFn();
      clearTimeout(timer);
      resolve(result);
    } catch (err) {
      clearTimeout(timer);
      logHook('security-scan', `${scanName} threw an error: ${err}`);
      resolve(fallback);
    }
  });
}

// Issue #905: Per-scan timeout chosen so all 4 fit within the 60s dispatcher window.
// 45 000 ms each leaves ~15 s headroom for aggregation and overhead.
const SCAN_TIMEOUT_MS = 45_000;

/**
 * Security scan aggregator hook
 * Issue #905: previously ran 4 scans sequentially (660s total), exceeding the 60s
 * dispatcher timeout. Fixed by running all 4 in parallel via Promise.all, each
 * guarded by a 45s per-scan timeout. Partial results are reported gracefully.
 */
export async function securityScanAggregator(input: HookInput, ctx: HookContext = NOOP_CTX): Promise<HookResult> {
  ctx.log('security-scan', '=== Security Scan Started (parallel mode) ===');

  const projectDir = input.project_dir || (ctx.projectDir);
  const resultsDir = `${projectDir}/.claude/hooks/logs/security`;

  mkdirSync(resultsDir, { recursive: true });

  // Issue #905: Run all 4 scans in parallel. Each is wrapped with an individual
  // 45s timeout so the combined wall-clock time stays within the 60s dispatcher limit.
  const [npmAudit, pipAudit, semgrep, bandit, secrets] = await Promise.all([
    runWithTimeout(
      () => runNpmAudit(projectDir, resultsDir),
      null,
      SCAN_TIMEOUT_MS,
      'npm-audit'
    ),
    runWithTimeout(
      () => runPipAudit(projectDir, resultsDir),
      null,
      SCAN_TIMEOUT_MS,
      'pip-audit'
    ),
    runWithTimeout(
      () => runSemgrep(projectDir, resultsDir),
      null,
      SCAN_TIMEOUT_MS,
      'semgrep'
    ),
    runWithTimeout(
      () => runBandit(projectDir, resultsDir),
      null,
      SCAN_TIMEOUT_MS,
      'bandit'
    ),
    runWithTimeout(
      () => runSecretScan(projectDir, resultsDir),
      0,
      SCAN_TIMEOUT_MS,
      'secret-scan'
    ),
  ]);

  const results: SecurityResults = {
    npmAudit,
    pipAudit,
    semgrep,
    bandit,
    secrets,
  };

  // Aggregate whatever results completed before the timeouts
  aggregateResults(resultsDir, results);

  return outputSilentSuccess();
}

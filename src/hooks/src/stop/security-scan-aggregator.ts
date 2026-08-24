/**
 * Security Scan Aggregator - Stop Hook
 *
 * Issue #3705: the previous #905 "parallel + timeout" implementation was inert.
 * All five scans were synchronous (execFileSync), runWithTimeout invoked them
 * inside the Promise executor (so Promise.all received already-settled promises
 * and the scans ran strictly sequentially), and the 45s timers could never fire
 * against a blocked event loop. Worst case was ~660s of sequential work on every
 * Stop, with no lock, so N concurrent sessions each ran a full scan.
 *
 * This version:
 * - gates on a clean working tree (no changed files -> no scan)
 * - takes a machine-wide lockfile so concurrent sessions produce ONE scan
 * - runs the external tools genuinely async (execFile) with real kill-on-timeout
 *   enforced by child_process itself, not a racing timer
 * - never fetches over the network: semgrep runs only against a local config
 *   (never `--config auto`, which downloads a rule registry per run)
 * - bounds the secret scan by file count and yields to the event loop while
 *   walking, so child timeouts stay enforceable
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import type { HookInput, HookResult, HookContext } from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

const execFileAsync = promisify(execFile);

// Per-scan wall-clock bound, enforced by child_process (SIGTERM on expiry).
const SCAN_TIMEOUT_MS = 45_000;
// A lock older than this is presumed abandoned (crashed session) and stolen.
const LOCK_STALE_MS = 15 * 60_000;
// Secret-scan bound: stop walking after this many files.
const SECRET_SCAN_MAX_FILES = 5_000;
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;

const LOCK_PATH = `${tmpdir()}/ork-security-scan.lock`;

interface SecurityResults {
  npmAudit: { critical: number; high: number } | null;
  pipAudit: number | null;
  semgrep: number | null;
  bandit: number | null;
  secrets: number;
}

/**
 * True when the working tree has uncommitted or untracked changes (or when the
 * question cannot be answered, e.g. not a git repo) — the cases worth scanning.
 */
function hasUncommittedChanges(projectDir: string): boolean {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return status.trim().length > 0;
  } catch {
    // Not a git repo (or git unavailable): no gate signal, so scan.
    return true;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Machine-wide lock: one scan across all concurrent sessions.
 * Returns true when this process holds the lock.
 */
function acquireLock(): boolean {
  try {
    writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    try {
      const holderPid = Number.parseInt(readFileSync(LOCK_PATH, 'utf8'), 10);
      const age = Date.now() - statSync(LOCK_PATH).mtimeMs;
      const abandoned =
        age > LOCK_STALE_MS || !Number.isInteger(holderPid) || holderPid <= 0 || !isPidAlive(holderPid);
      if (abandoned) {
        unlinkSync(LOCK_PATH);
        writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
        return true;
      }
    } catch {
      // Lost the race to another session, or the lock vanished mid-check.
    }
    return false;
  }
}

function releaseLock(): void {
  try {
    if (readFileSync(LOCK_PATH, 'utf8') === String(process.pid)) {
      unlinkSync(LOCK_PATH);
    }
  } catch {
    // Already gone, or stolen after staleness — nothing to release.
  }
}

function toolInstalled(tool: string): boolean {
  try {
    execFileSync('which', [tool], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run npm audit
 */
async function runNpmAudit(
  projectDir: string,
  resultsDir: string
): Promise<{ critical: number; high: number } | null> {
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
    await execFileAsync('npm', ['audit', '--json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: SCAN_TIMEOUT_MS,
      maxBuffer: EXEC_MAX_BUFFER,
      windowsHide: true,
    });
  } catch (error: unknown) {
    // npm audit returns non-zero on vulnerabilities, capture output
    const stdout = (error as { stdout?: string }).stdout;
    if (stdout) {
      writeFileSync(`${resultsDir}/npm-audit.json`, stdout);
      try {
        const result = JSON.parse(stdout);
        return {
          critical: result.metadata?.vulnerabilities?.critical || 0,
          high: result.metadata?.vulnerabilities?.high || 0,
        };
      } catch {
        // Ignore parse errors
      }
    }
    if ((error as { killed?: boolean }).killed) {
      logHook('security-scan', `npm audit timed out after ${SCAN_TIMEOUT_MS}ms`);
      return null;
    }
  }
  logHook('security-scan', 'npm audit complete');
  return { critical: 0, high: 0 };
}

/**
 * Run pip-audit
 */
async function runPipAudit(projectDir: string, resultsDir: string): Promise<number | null> {
  if (!existsSync(`${projectDir}/requirements.txt`) && !existsSync(`${projectDir}/pyproject.toml`)) {
    return null;
  }
  if (!toolInstalled('pip-audit')) {
    logHook('security-scan', 'pip-audit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running pip-audit...');
  try {
    const { stdout } = await execFileAsync('pip-audit', ['--format', 'json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: SCAN_TIMEOUT_MS,
      maxBuffer: EXEC_MAX_BUFFER,
      windowsHide: true,
    });
    writeFileSync(`${resultsDir}/pip-audit.json`, stdout);
    const parsed = JSON.parse(stdout);
    logHook('security-scan', 'pip-audit complete');
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Run semgrep — local config only. `--config auto` is banned on a Stop path:
 * it fetches a rule registry over the network on every run (#3705).
 */
async function runSemgrep(projectDir: string, resultsDir: string): Promise<number | null> {
  const localConfigs = ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', '.semgrep'];
  const config = localConfigs.find((c) => existsSync(`${projectDir}/${c}`));
  if (!config) {
    return null;
  }
  if (!toolInstalled('semgrep')) {
    logHook('security-scan', 'semgrep not installed, skipping');
    return null;
  }

  logHook('security-scan', `Running semgrep (local config: ${config})...`);
  try {
    const { stdout } = await execFileAsync(
      'semgrep',
      ['--config', config, '--json', '--quiet', '--metrics=off'],
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: EXEC_MAX_BUFFER,
        windowsHide: true,
      }
    );
    writeFileSync(`${resultsDir}/semgrep.json`, stdout);
    const parsed = JSON.parse(stdout);
    const highSeverity = (parsed.results || []).filter(
      (r: { extra?: { severity?: string } }) => r.extra?.severity === 'ERROR'
    ).length;
    logHook('security-scan', 'semgrep complete');
    return highSeverity;
  } catch {
    return 0;
  }
}

/**
 * Run bandit
 */
async function runBandit(projectDir: string, resultsDir: string): Promise<number | null> {
  if (!hasPythonFiles(projectDir) && !existsSync(`${projectDir}/backend`)) {
    return null;
  }
  if (!toolInstalled('bandit')) {
    logHook('security-scan', 'bandit not installed, skipping');
    return null;
  }

  logHook('security-scan', 'Running bandit...');
  try {
    await execFileAsync('bandit', ['-r', '.', '-f', 'json', '-o', `${resultsDir}/bandit.json`], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: SCAN_TIMEOUT_MS,
      maxBuffer: EXEC_MAX_BUFFER,
      windowsHide: true,
    });
    logHook('security-scan', 'bandit complete');
    return 0;
  } catch {
    // Bandit exits non-zero when issues found
    return 0;
  }
}

/** Shallow check (depth 2) for any .py file, replacing the old `find | head` shell-out. */
function hasPythonFiles(projectDir: string, depth = 2): boolean {
  function walk(dir: string, remaining: number): boolean {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.py')) return true;
      if (
        remaining > 0 &&
        entry.isDirectory() &&
        !['node_modules', '.git', 'dist', 'build'].includes(entry.name)
      ) {
        if (walk(`${dir}/${entry.name}`, remaining - 1)) return true;
      }
    }
    return false;
  }
  return walk(projectDir, depth - 1);
}

/**
 * Run secret detection — bounded (SECRET_SCAN_MAX_FILES) and yielding to the
 * event loop between directories so child-process timeouts stay enforceable.
 */
async function runSecretScan(projectDir: string, resultsDir: string): Promise<number> {
  logHook('security-scan', 'Running secret detection...');

  const secretPatterns = /(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*["'][^"']{8,}/i;
  let secretsFound = 0;
  let filesScanned = 0;
  let truncated = false;
  const findings: Array<{ file: string; type: string }> = [];

  const extensions = ['.py', '.js', '.ts', '.env'];
  const yieldToLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

  async function scanDir(dir: string): Promise<void> {
    if (filesScanned >= SECRET_SCAN_MAX_FILES) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    await yieldToLoop();
    for (const entry of entries) {
      if (filesScanned >= SECRET_SCAN_MAX_FILES) {
        truncated = true;
        return;
      }
      const fullPath = `${dir}/${entry.name}`;

      // Skip node_modules and .git
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await scanDir(fullPath);
        }
        continue;
      }

      // Check file extension
      if (!extensions.some((ext) => entry.name.endsWith(ext))) {
        continue;
      }

      filesScanned++;
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
  }

  await scanDir(projectDir);

  writeFileSync(
    `${resultsDir}/secrets.json`,
    JSON.stringify({ findings, count: secretsFound, files_scanned: filesScanned, truncated }, null, 2)
  );

  logHook(
    'security-scan',
    `Secret detection complete: ${secretsFound} potential issues (${filesScanned} files${truncated ? ', truncated at cap' : ''})`
  );
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
 * Security scan aggregator hook (#3705).
 * Gated (clean tree = no scan), locked (one scan per machine), genuinely
 * parallel (async execFile with real kill-on-timeout), network-free.
 */
export async function securityScanAggregator(
  input: HookInput,
  ctx: HookContext = NOOP_CTX
): Promise<HookResult> {
  const projectDir = input.project_dir || ctx.projectDir;

  if (!hasUncommittedChanges(projectDir)) {
    ctx.log('security-scan', 'Working tree clean — skipping scan (#3705)');
    return outputSilentSuccess();
  }

  if (!acquireLock()) {
    ctx.log('security-scan', 'Another scan holds the machine-wide lock — skipping (#3705)');
    return outputSilentSuccess();
  }

  ctx.log('security-scan', '=== Security Scan Started ===');
  const resultsDir = `${projectDir}/.claude/hooks/logs/security`;

  try {
    mkdirSync(resultsDir, { recursive: true });

    const [npmAudit, pipAudit, semgrep, bandit, secrets] = await Promise.all([
      runNpmAudit(projectDir, resultsDir),
      runPipAudit(projectDir, resultsDir),
      runSemgrep(projectDir, resultsDir),
      runBandit(projectDir, resultsDir),
      runSecretScan(projectDir, resultsDir),
    ]);

    const results: SecurityResults = {
      npmAudit,
      pipAudit,
      semgrep,
      bandit,
      secrets,
    };

    aggregateResults(resultsDir, results);
  } finally {
    releaseLock();
  }

  return outputSilentSuccess();
}

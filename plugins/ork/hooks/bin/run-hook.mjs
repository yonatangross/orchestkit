#!/usr/bin/env node
/**
 * CLI Runner for OrchestKit TypeScript Hooks
 *
 * Usage: run-hook.mjs <hook-name>
 * Example: run-hook.mjs permission/auto-approve-readonly
 *
 * Loads event-specific split bundles for fast startup (~89% smaller than unified)
 * Reads hook input from stdin, executes the hook, outputs result to stdout.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, appendFile, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

/** Resolved plugin root — two levels up from hooks/bin/ */
const pluginRoot = join(__dirname, '..', '..');

/** t0: process start reference (nanoseconds via hrtime.bigint) */
const t0 = process.hrtime.bigint();

/** Module-level cache for the project hash (computed once per process). */
let cachedPid = null;

/**
 * Return a 12-char SHA-256 hex prefix of projectDir, computing it only once.
 *
 * @param {string} projectDir - Absolute path to the project root
 * @returns {string} 12-character hex string
 */
function getProjectHash(projectDir) {
  if (cachedPid === null) {
    cachedPid = createHash('sha256').update(projectDir).digest('hex').slice(0, 12);
  }
  return cachedPid;
}

/**
 * Map hook name prefix to bundle name
 */
function getBundleName(hookName) {
  const prefix = hookName.split('/')[0];
  const bundleMap = {
    permission: 'permission',
    pretool: 'pretool',
    posttool: 'posttool',
    prompt: 'prompt',
    lifecycle: 'lifecycle',
    stop: 'stop',
    'subagent-start': 'subagent',
    'subagent-stop': 'subagent',
    'teammate-idle': 'lifecycle',
    'task-created': 'lifecycle',
    'task-completed': 'lifecycle',
    worktree: 'lifecycle',
    notification: 'notification',
    'permission-denied': 'permission',
    setup: 'setup',
    skill: 'skill',
    agent: 'agent',
  };
  return bundleMap[prefix] || null;
}

/**
 * Load the appropriate split bundle for the hook
 */
async function loadBundle(hookName) {
  const bundleName = getBundleName(hookName);
  if (!bundleName) return null;

  const bundlePath = join(distDir, `${bundleName}.mjs`);
  if (!existsSync(bundlePath)) return null;

  return await import(bundlePath);
}

/**
 * Normalize hook input to handle CC version differences
 * CC 2.1.19+ uses tool_input, older versions may use toolInput
 */
function normalizeInput(input) {
  if (!input.tool_input && input.toolInput) {
    input.tool_input = input.toolInput;
  }
  if (!input.tool_input) {
    input.tool_input = {};
  }
  input.tool_name = input.tool_name || input.toolName || '';
  input.session_id = input.session_id || input.sessionId || process.env.CLAUDE_SESSION_ID || '';
  // SubagentStart/SubagentStop send `cwd` instead of `project_dir`
  input.project_dir = input.project_dir || input.projectDir || input.cwd || process.env.CLAUDE_PROJECT_DIR || '.';
  input.plugin_root = pluginRoot;
  // SubagentStart/SubagentStop send `agent_type` at top level (not in tool_input)
  if (input.agent_type && !input.tool_input.subagent_type) {
    input.tool_input.subagent_type = input.agent_type;
  }
  if (input.agent_id && !input.tool_input.agent_id) {
    input.tool_input.agent_id = input.agent_id;
  }
  return input;
}

/** Silent success — tells CC to continue without showing output. */
const SILENT_OK = JSON.stringify({ continue: true, suppressOutput: true });

const hookName = process.argv[2];

// If no hook name provided, output silent success
if (!hookName) {
  console.log(SILENT_OK);
  process.exit(0);
}

/**
 * Attempt to resolve a working dist directory.
 * If the current pluginRoot's dist/ doesn't exist (stale cache after plugin update),
 * scan the cache directory for the latest version that has hooks/dist/.
 * Returns the resolved dist path, or null if no fallback found.
 */
function resolveDistDir(primaryDist) {
  if (existsSync(primaryDist)) return primaryDist;

  // pluginRoot is .../cache/orchestkit/ork/<version>/
  // Walk up to .../cache/orchestkit/ork/ and find the latest version with hooks/dist/
  const orkCacheDir = join(pluginRoot, '..');
  try {
    const versions = readdirSync(orkCacheDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^\d+\.\d+\.\d+/.test(e.name))
      .map(e => e.name)
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
        }
        return 0;
      })
      .reverse(); // latest first

    for (const ver of versions) {
      const candidate = join(orkCacheDir, ver, 'hooks', 'dist');
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // Can't read cache dir — no fallback available
  }
  return null;
}

// Resolve dist directory (with fallback for stale plugin cache)
const resolvedDist = resolveDistDir(distDir);
const effectiveDistDir = resolvedDist || distDir;

// Override loadBundle to use the resolved dist directory
async function loadBundleFallback(hookName) {
  const bundleName = getBundleName(hookName);
  if (!bundleName) return null;

  const bundlePath = join(effectiveDistDir, `${bundleName}.mjs`);
  if (!existsSync(bundlePath)) return null;

  return await import(bundlePath);
}

// Load the appropriate bundle
let hooks;
try {
  hooks = await loadBundleFallback(hookName);
} catch (err) {
  // Bundle not found - likely not built yet
  // Output silent success to not block Claude Code
  console.log(SILENT_OK);
  process.exit(0);
}

/** t1: after bundle import */
const t1 = process.hrtime.bigint();

if (!hooks) {
  console.log(SILENT_OK);
  process.exit(0);
}

// Get the hook function from the registry
const hookFn = hooks.hooks?.[hookName];

// If hook not found (not migrated yet), output silent success
if (!hookFn) {
  console.log(SILENT_OK);
  process.exit(0);
}

// Read stdin with timeout to prevent hanging
let input = '';
let stdinClosed = false;

/**
 * Maximum stdin size (512KB). Image pastes can send megabytes of base64
 * data in the prompt field, causing every hook to run expensive string
 * operations on the payload. Cap stdin to prevent OOM and context death.
 * See: https://github.com/yonatangross/orchestkit/issues/620
 */
const MAX_STDIN_BYTES = 512 * 1024;

// Set up timeout - if no input received within 100ms, assume no input
const timeout = setTimeout(() => {
  if (!stdinClosed) {
    stdinClosed = true;
    runHook(normalizeInput({}));
  }
}, 100);

process.stdin.setEncoding('utf8');

let inputBytes = 0;

process.stdin.on('data', (chunk) => {
  clearTimeout(timeout);
  input += chunk;
  inputBytes += Buffer.byteLength(chunk);
  // Guard: if stdin exceeds max size (e.g. image base64 in prompt),
  // stop reading and run hook with truncated input to avoid OOM
  if (inputBytes > MAX_STDIN_BYTES) {
    stdinClosed = true;
    process.stdin.destroy();
    const truncKB = Math.round(inputBytes / 1024);
    process.stderr.write(`[orchestkit] WARNING: stdin truncated at ${truncKB}KB (max ${MAX_STDIN_BYTES / 1024}KB) for hook "${name}" — large payload (image paste?)\n`);
    try {
      // Try to parse what we have — likely incomplete JSON, so fall back to empty
      const parsedInput = input.trim() ? JSON.parse(input) : {};
      runHook(normalizeInput(parsedInput));
    } catch {
      // JSON incomplete due to truncation — run with empty input (hook will no-op)
      process.stderr.write(`[orchestkit] WARNING: truncated JSON could not be parsed for hook "${name}" — running with empty input\n`);
      runHook(normalizeInput({}));
    }
  }
});

process.stdin.on('end', () => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    try {
      const parsedInput = input.trim() ? JSON.parse(input) : {};
      runHook(normalizeInput(parsedInput));
    } catch (err) {
      // JSON parse error - output error message but continue
      console.log(JSON.stringify({
        continue: true,
        systemMessage: `Hook input parse error: ${err.message}`,
      }));
    }
  }
});

process.stdin.on('error', () => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    runHook(normalizeInput({}));
  }
});

/**
 * Security-critical hooks that CANNOT be disabled via hook-overrides.json.
 * These hooks enforce security boundaries and must always run.
 * See: https://github.com/yonatangross/orchestkit/issues/686
 */
const SECURITY_HOOKS = new Set([
  'pretool/bash/dangerous-command-blocker',
  'pretool/bash/compound-command-validator',
  'pretool/write-edit/file-guard',
  'pretool/Write/security-pattern-validator',
  'skill/redact-secrets',
]);

/**
 * Load hook overrides from .claude/hook-overrides.json
 * Returns null if file doesn't exist or is invalid
 */
function loadOverrides(projectDir) {
  const overridesPath = join(projectDir, '.claude', 'hook-overrides.json');
  if (!existsSync(overridesPath)) return null;
  try {
    return JSON.parse(readFileSync(overridesPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check if a hook is disabled via overrides.
 * Security-critical hooks in SECURITY_HOOKS cannot be disabled.
 */
function isHookDisabled(name, overrides) {
  if (!overrides?.disabled) return false;
  if (!Array.isArray(overrides.disabled) || !overrides.disabled.includes(name)) return false;
  if (SECURITY_HOOKS.has(name)) {
    process.stderr.write(`[orchestkit] WARNING: cannot disable security hook "${name}" via hook-overrides.json — override ignored\n`);
    return false;
  }
  return true;
}

// =============================================================================
// HOOK TRACKING (Issue #245: Multi-User Intelligent Decision Capture)
// =============================================================================

/**
 * Session ID validation (SEC-001).
 * CC uses UUIDs (e.g. "be33e3e1-5918-4057-904d-89997790dd8b").
 * OrchestKit smart IDs use "project-branch-MMDD-HHMM-hash4" (5+ dash-separated parts).
 * Rejects single chars, bare garbage, and path traversal attempts.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SMART_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{6,127}$/; // min 7 chars, starts alphanumeric
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/; // fallback for unknown formats

/**
 * Validate session ID to prevent path traversal attacks.
 * Defense-in-depth: Claude Code controls CLAUDE_SESSION_ID, but we validate anyway.
 * Prefers structural validation (UUID or smart ID), falls back to character-class check.
 * @param {string} sessionId - The session ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidSessionId(sessionId) {
  if (typeof sessionId !== 'string') return false;
  // Structural match: UUID or smart ID (7+ chars starting alphanumeric)
  if (UUID_PATTERN.test(sessionId) || SMART_ID_PATTERN.test(sessionId)) return true;
  // Fallback: character-class only (1-6 char IDs are suspicious but allowed for compat)
  if (SESSION_ID_PATTERN.test(sessionId)) {
    process.stderr.write(`[orchestkit] WARNING: session ID "${sessionId}" is valid but doesn't match UUID or smart-ID format — possible misconfiguration\n`);
    return true;
  }
  return false;
}

/**
 * Track hook execution for user profiling.
 * Writes events to .claude/memory/sessions/{session_id}/events.jsonl
 *
 * @param {string} trackedHookName - The hook name being tracked
 * @param {boolean} success - Whether the hook executed successfully
 * @param {number} durationMs - Execution duration in milliseconds
 * @param {string} projectDir - Project directory path
 * @param {{ t_bundle_ms: number, t_stdin_ms: number, t_exec_ms: number, _t3: bigint }} [timing] - Pipeline stage timings
 * @returns {void}
 */
function trackHookTriggered(trackedHookName, success, durationMs, projectDir, timing) {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID;
    if (!sessionId) return; // No session, skip tracking

    // Validate session ID to prevent path traversal (SEC-001)
    if (!isValidSessionId(sessionId)) return;

    const sessionDir = join(projectDir, '.claude', 'memory', 'sessions', sessionId);
    const eventsPath = join(sessionDir, 'events.jsonl');

    // Ensure directory exists
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    // Generate event
    const event = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event_type: 'hook_triggered',
      identity: {
        session_id: sessionId,
        user_id: process.env.USER || process.env.USERNAME || 'unknown',
        timestamp: new Date().toISOString(),
      },
      payload: {
        name: trackedHookName,
        success: success,
        duration_ms: durationMs,
      },
    };

    // #920: Fire-and-forget async writes — result is already on stdout,
    // so these don't block the tool execution pipeline. Node.js keeps the
    // event loop alive until pending I/O callbacks complete before exiting.
    appendFile(eventsPath, JSON.stringify(event) + '\n', (err) => {
      if (err) process.stderr.write(`[orchestkit] WARNING: failed to write hook event to ${eventsPath}: ${err.message}\n`);
    });

    // Cross-project analytics (Issue #459)
    const analyticsDir = join(homedir(), '.claude', 'analytics');
    mkdirSync(analyticsDir, { recursive: true });
    const pid = getProjectHash(projectDir);
    const team = process.env.CLAUDE_CODE_TEAM_NAME || undefined;
    /** t4: right before the JSONL write — measures tracking overhead (t3→t4) */
    const t4 = timing?._t3 !== undefined ? process.hrtime.bigint() : undefined;
    const stageTimings = timing ? {
      t_bundle_ms: timing.t_bundle_ms,
      t_stdin_ms: timing.t_stdin_ms,
      t_exec_ms: timing.t_exec_ms,
      t_track_ms: t4 !== undefined ? Number(t4 - timing._t3) / 1e6 : undefined,
    } : {};
    const timingPath = join(analyticsDir, 'hook-timing.jsonl');
    appendFile(timingPath,
      JSON.stringify({ ts: new Date().toISOString(), hook: trackedHookName, duration_ms: durationMs, ok: success, pid, ...(team ? { team } : {}), ...stageTimings }) + '\n', (err) => {
      if (err) process.stderr.write(`[orchestkit] WARNING: failed to write hook timing to ${timingPath}: ${err.message}\n`);
    });
  } catch {
    // Silent failure - tracking should never break hooks
  }
}

/**
 * Validate hook input shape at the boundary (Level 1 only).
 * Full validation (Levels 2-3) is handled by src/lib/input-validator.ts
 * inside the compiled bundles. This gate only rejects non-objects.
 */
function validateInput(input, hookName) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: [`${hookName}: input must be an object, got ${input === null ? 'null' : typeof input}`] };
  }
  return { valid: true, errors: [] };
}

/**
 * Execute the hook and output result
 */
async function runHook(parsedInput) {
  // Check hook overrides before execution
  const projectDir = parsedInput.project_dir || process.env.CLAUDE_PROJECT_DIR || '.';
  const overrides = loadOverrides(projectDir);

  if (isHookDisabled(hookName, overrides)) {
    console.log(SILENT_OK);
    return;
  }

  // Validate input at the boundary
  const validation = validateInput(parsedInput, hookName);
  if (!validation.valid) {
    console.log(JSON.stringify({
      continue: true,
      systemMessage: `Hook input validation failed (${hookName}): ${validation.errors.join('; ')}`,
    }));
    return;
  }

  const startTime = Date.now();
  let success = true;

  /** t2: after stdin parsed and input ready for execution */
  const t2 = process.hrtime.bigint();

  let t3 = t2;

  try {
    const result = await hookFn(parsedInput);
    /** t3: after hook function executed */
    t3 = process.hrtime.bigint();
    console.log(JSON.stringify(result));
  } catch (err) {
    /** t3: captured even on error so timing is always recorded */
    t3 = process.hrtime.bigint();
    success = false;
    // On any error, output silent success to not block Claude Code
    console.log(JSON.stringify({
      continue: true,
      systemMessage: `Hook error (${hookName}): ${err.message}`,
    }));
  } finally {
    // Track hook execution (Issue #245)
    const durationMs = Date.now() - startTime;
    const timing = {
      t_bundle_ms: Number(t1 - t0) / 1e6,
      t_stdin_ms: Number(t2 - t1) / 1e6,
      t_exec_ms: Number(t3 - t2) / 1e6,
      _t3: t3, // passed through so trackHookTriggered can measure its own overhead
    };
    trackHookTriggered(hookName, success, durationMs, projectDir, timing);
  }
}

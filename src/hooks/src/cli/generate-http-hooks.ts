/**
 * HTTP Hook Generator — #910, #1860
 *
 * Generates native CC 2.1.63 HTTP hook entries for all 19 event types.
 * Output: JSON config suitable for `.claude/settings.local.json`
 *
 * Token enforcement (#1860): in --write mode the generator refuses to
 * persist hook entries when $ORCHESTKIT_HOOK_TOKEN is unset/empty in the
 * launching shell. Override with --allow-missing-token if you intend to
 * configure the token in a different shell init / 1Password reference.
 *
 * Usage:
 *   npx tsx src/hooks/src/cli/generate-http-hooks.ts <webhook-url>
 *   npx tsx src/hooks/src/cli/generate-http-hooks.ts <webhook-url> --write
 *   npx tsx src/hooks/src/cli/generate-http-hooks.ts <webhook-url> --write --path /path/to/settings.local.json
 *
 * Examples:
 *   npx tsx src/hooks/src/cli/generate-http-hooks.ts https://hq.example.com/api/hooks
 *   npx tsx src/hooks/src/cli/generate-http-hooks.ts https://hq.example.com/api/hooks --write
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { safeProjectDir } from '../lib/paths.js';
import { safeMkdirSync } from '../lib/safe-fs.js';

/** Env var consumed by the Bearer header on each generated HTTP hook. */
const TOKEN_ENV_VAR = 'ORCHESTKIT_HOOK_TOKEN';

// All CC hook event types (CC 2.1.71+)
const CC_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'SessionEnd',
  'Setup',
  'Notification',
  'PreCompact',
  'TeammateIdle',
  'TaskCompleted',
  'InstructionsLoaded',
  'WorktreeCreate',
  'WorktreeRemove',
  'ConfigChange',
] as const;

interface HttpHookEntry {
  type: 'http';
  url: string;
  headers: Record<string, string>;
  allowedEnvVars: string[];
  timeout: number;
}

interface SettingsLocalJson {
  hooks?: Record<string, HttpHookEntry[]>;
  [key: string]: unknown;
}

/**
 * Build a single HTTP hook entry for a given event type.
 */
function buildHttpHookEntry(webhookUrl: string, endpoint: string): HttpHookEntry {
  const url = `${webhookUrl.replace(/\/$/, '')}/${endpoint}`;
  return {
    type: 'http',
    url,
    headers: {
      Authorization: 'Bearer $ORCHESTKIT_HOOK_TOKEN',
    },
    allowedEnvVars: ['ORCHESTKIT_HOOK_TOKEN'],
    timeout: 5,
  };
}

/**
 * Generate HTTP hook config for all 18 event types.
 */
function generateHttpHooks(webhookUrl: string): Record<string, HttpHookEntry[]> {
  const hooks: Record<string, HttpHookEntry[]> = {};

  for (const event of CC_HOOK_EVENTS) {
    hooks[event] = [buildHttpHookEntry(webhookUrl, 'cc-event')];
  }

  return hooks;
}

/**
 * Merge generated hooks into existing settings.local.json.
 * Preserves any non-hook settings and appends HTTP hooks to existing hook arrays.
 */
function mergeIntoSettings(
  existing: SettingsLocalJson,
  newHooks: Record<string, HttpHookEntry[]>
): SettingsLocalJson {
  const merged = { ...existing };
  const existingHooks = (merged.hooks || {}) as Record<string, unknown[]>;

  for (const [event, entries] of Object.entries(newHooks)) {
    const currentEntries = existingHooks[event] || [];

    // Remove any existing HTTP hooks pointing to cc-event (replace, don't duplicate)
    const filtered = (currentEntries as HttpHookEntry[]).filter(
      (h) => !(h.type === 'http' && h.url?.includes('/cc-event'))
    );

    existingHooks[event] = [...filtered, ...entries];
  }

  merged.hooks = existingHooks as Record<string, HttpHookEntry[]>;
  return merged;
}

/**
 * Resolve the default path for settings.local.json.
 */
function getDefaultSettingsPath(): string {
  return join(safeProjectDir(), '.claude', 'settings.local.json');
}

// --- CLI entrypoint ---
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: generate-http-hooks <webhook-url> [options]

Options:
  --write                  Write to settings.local.json (default: print to stdout)
  --path <path>            Custom path for settings file (default: .claude/settings.local.json)
  --dry-run                Show what would be written without writing
  --allow-missing-token    Allow --write even when $${TOKEN_ENV_VAR} is unset
                           (default: refuse; closes #1860 fail-silent class)
  --help, -h               Show this help message

Environment:
  ${TOKEN_ENV_VAR}     Bearer token used by every generated HTTP hook. The
                           generated entries reference this var literally —
                           it must be set in the shell that launches Claude
                           Code, or every hook fires returns 401.

Examples:
  generate-http-hooks https://hq.example.com/api/hooks
  generate-http-hooks https://hq.example.com/api/hooks --write
  generate-http-hooks https://hq.example.com/api/hooks --write --path ~/.claude/settings.local.json`);
    process.exit(0);
  }

  const webhookUrl = args[0];
  const shouldWrite = args.includes('--write');
  const isDryRun = args.includes('--dry-run');
  const allowMissingToken = args.includes('--allow-missing-token');
  const pathIndex = args.indexOf('--path');
  const settingsPath =
    pathIndex !== -1 && args[pathIndex + 1]
      ? args[pathIndex + 1]
      : getDefaultSettingsPath();

  // Validate URL
  try {
    new URL(webhookUrl);
  } catch {
    console.error(`Error: Invalid URL: ${webhookUrl}`);
    process.exit(1);
  }

  // #1860: refuse to persist hook entries when the bearer token is unset.
  // The generated entries reference $${TOKEN_ENV_VAR} literally — writing
  // without it set produces a silently broken state where every hook fire
  // returns 401 and the user only sees on-screen "PreToolUse:Bash hook
  // error" spam, masking real errors. Fail closed + loud, not silent.
  if (shouldWrite && !isDryRun) {
    const tokenValue = process.env[TOKEN_ENV_VAR];
    if (!tokenValue || tokenValue.trim().length === 0) {
      if (!allowMissingToken) {
        console.error(
          `Error: $${TOKEN_ENV_VAR} is unset or empty in this shell.\n` +
            `\n` +
            `The hook entries this script writes reference $${TOKEN_ENV_VAR}\n` +
            `literally as the Bearer token. If you persist them now, every CC\n` +
            `hook fire will 401 against the receiver and the on-screen error\n` +
            `spam will mask real failures.\n` +
            `\n` +
            `Fix one of these and re-run:\n` +
            `  export ${TOKEN_ENV_VAR}=<your-token>     # this shell\n` +
            `  echo 'export ${TOKEN_ENV_VAR}=...' >> ~/.zshrc   # persist\n` +
            `  op read 'op://<vault>/orchestkit/hook-token'  # 1Password ref\n` +
            `\n` +
            `Override (only if you intend to set the token elsewhere before\n` +
            `the next CC session): rerun with --allow-missing-token.`
        );
        process.exit(2);
      }
      console.error(
        `Warning: $${TOKEN_ENV_VAR} unset — proceeding because --allow-missing-token\n` +
          `was passed. CC hooks WILL 401 until you export the token.`
      );
    }
  }

  // Generate hooks
  const hooks = generateHttpHooks(webhookUrl);

  if (!shouldWrite && !isDryRun) {
    // Print to stdout
    const output: SettingsLocalJson = { hooks };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Load existing settings if present
  let existing: SettingsLocalJson = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      console.error(`Warning: Could not parse ${settingsPath}, starting fresh`);
    }
  }

  // Merge
  const merged = mergeIntoSettings(existing, hooks);
  const output = JSON.stringify(merged, null, 2);

  if (isDryRun) {
    console.log(`Would write to: ${settingsPath}`);
    console.log(output);
    return;
  }

  // Write
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) {
    safeMkdirSync(dir, { recursive: true });
  }
  writeFileSync(settingsPath, `${output}\n`, 'utf8');

  console.log(`Written ${CC_HOOK_EVENTS.length} HTTP hooks to ${settingsPath}`);
  console.log(`Webhook URL: ${webhookUrl}/cc-event`);
  console.log(`Auth: Bearer $${TOKEN_ENV_VAR}`);
  const tokenSet = !!(process.env[TOKEN_ENV_VAR] && process.env[TOKEN_ENV_VAR].trim().length > 0);
  if (tokenSet) {
    console.log(`\n${TOKEN_ENV_VAR} is set in this shell — hooks will authenticate.`);
  } else {
    console.log(`\nReminder: ${TOKEN_ENV_VAR} is unset. Hooks will 401 until you set it.`);
  }
}

// Export pure functions for unit testing without executing main().
export {
  buildHttpHookEntry,
  generateHttpHooks,
  mergeIntoSettings,
  TOKEN_ENV_VAR,
  CC_HOOK_EVENTS,
};

// Only auto-run when invoked as a script (not when imported by tests).
// `import.meta.url` matches `process.argv[1]` URL form when this file is
// the entrypoint. Falls back to filename-suffix check when URL form fails.
const invokedAsScript = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return import.meta.url.endsWith(entry) || new URL(`file://${entry}`).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  main();
}

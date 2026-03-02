/**
 * HTTP Hook Generator — #910
 *
 * Generates native CC 2.1.63 HTTP hook entries for all 18 event types.
 * Output: JSON config suitable for `.claude/settings.local.json`
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

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// All CC hook event types (CC 2.1.63)
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
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(projectDir, '.claude', 'settings.local.json');
}

// --- CLI entrypoint ---
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: generate-http-hooks <webhook-url> [options]

Options:
  --write              Write to settings.local.json (default: print to stdout)
  --path <path>        Custom path for settings file (default: .claude/settings.local.json)
  --dry-run            Show what would be written without writing
  --help, -h           Show this help message

Examples:
  generate-http-hooks https://hq.example.com/api/hooks
  generate-http-hooks https://hq.example.com/api/hooks --write
  generate-http-hooks https://hq.example.com/api/hooks --write --path ~/.claude/settings.local.json`);
    process.exit(0);
  }

  const webhookUrl = args[0];
  const shouldWrite = args.includes('--write');
  const isDryRun = args.includes('--dry-run');
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
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(settingsPath, output + '\n', 'utf8');

  console.log(`Written ${CC_HOOK_EVENTS.length} HTTP hooks to ${settingsPath}`);
  console.log(`Webhook URL: ${webhookUrl}/cc-event`);
  console.log(`Auth: Bearer $ORCHESTKIT_HOOK_TOKEN`);
  console.log(`\nSet ORCHESTKIT_HOOK_TOKEN in your environment to enable streaming.`);
}

main();

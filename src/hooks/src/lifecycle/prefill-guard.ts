/**
 * Prefill Breaking Change Guard — SessionStart Hook
 * Opus 4.6 removed support for response prefilling (prefilled assistant
 * messages return 400 errors) and deprecated `output_format` in favor of
 * `output_config.format`. This hook scans for both patterns in skill
 * content and warns users proactively at session start.
 *
 * Addresses: Issue #325, #357
 * Version: 1.1.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getPluginRoot, outputSilentSuccess, outputWarning } from '../lib/common.js';

/** Patterns that indicate response prefilling usage */
const PREFILL_PATTERNS = [
  /\bprefill\b/i,
  /\bpre-fill\b/i,
  /assistant.*content.*:\s*["']/i,
  /\bprefilled?\s+(assistant|response|message)/i,
  /role.*assistant.*content.*(?!$)/i,
];

/** Patterns that indicate deprecated output_format API parameter usage */
const OUTPUT_FORMAT_PATTERNS = [
  /["']output_format["']\s*:/,                    // JSON key "output_format":
  /output_format\s*=\s*["']/,                     // Python kwarg output_format="..."
  /\boutput_format\b.*\b(json|text|xml)\b/i,      // output_format with format value
];

/**
 * Scan a file's content for prefilling patterns
 */
function hasPrefillPatterns(content: string): boolean {
  return PREFILL_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Scan a file's content for deprecated output_format patterns.
 * Excludes third-party API params (ElevenLabs, etc.) and Python function args.
 */
function hasOutputFormatPatterns(content: string): boolean {
  // Skip files that are clearly about third-party APIs
  if (/elevenlabs|mp3_\d+/i.test(content)) return false;
  return OUTPUT_FORMAT_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Scan skills directory for files containing prefill patterns
 */
function scanSkillsForPrefill(pluginRoot: string): string[] {
  const skillsDir = join(pluginRoot, 'skills');
  const matches: string[] = [];

  if (!existsSync(skillsDir)) return matches;

  try {
    const skillDirs = readdirSync(skillsDir).filter(d => {
      try { return statSync(join(skillsDir, d)).isDirectory(); } catch { return false; }
    });

    for (const dir of skillDirs) {
      const skillPath = join(skillsDir, dir, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      try {
        const content = readFileSync(skillPath, 'utf-8');
        if (hasPrefillPatterns(content) || hasOutputFormatPatterns(content)) {
          matches.push(dir);
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Skip if skills dir can't be read
  }

  return matches;
}

/**
 * Check if the current model is Opus 4.6+ (where prefilling is unsupported)
 */
function isOpus46OrLater(): boolean {
  const model = process.env.CLAUDE_MODEL || '';
  // Match opus-4-6, opus-4-7, etc. or just "opus"
  return /opus/i.test(model);
}

/**
 * Prefill guard hook — runs at SessionStart
 */
export function prefillGuard(_input: HookInput): HookResult {
  // Only warn when running on Opus 4.6+
  if (!isOpus46OrLater()) {
    return outputSilentSuccess();
  }

  const pluginRoot = getPluginRoot();
  const affectedSkills = scanSkillsForPrefill(pluginRoot);

  if (affectedSkills.length === 0) {
    logHook('prefill-guard', 'No prefilling patterns detected in skills');
    return outputSilentSuccess();
  }

  logHook('prefill-guard', `Found prefilling patterns in ${affectedSkills.length} skills: ${affectedSkills.join(', ')}`, 'warn');

  return outputWarning(
    `Opus 4.6 deprecation: ${affectedSkills.length} skill(s) reference deprecated patterns (prefilled assistant messages or output_format parameter). ` +
    `Affected: ${affectedSkills.slice(0, 5).join(', ')}${affectedSkills.length > 5 ? '...' : ''}. ` +
    `Migration: use structured outputs instead of prefilling; use output_config.format instead of output_format.`
  );
}

/**
 * Error Solution Suggester - PostToolUse hook for error remediation
 * Issue #124: Suggests fixes and skills when Bash errors occur
 *
 * This hook analyzes error output from Bash commands and injects contextual
 * solution suggestions via CC 2.1.9 additionalContext.
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for suggestions
 * Version: 1.0.0
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, getPluginRoot, getSessionId, logHook } from '../lib/common.js';
import { createHash } from 'node:crypto';

// Configuration
const MAX_CONTEXT_CHARS = 2000;
const DEDUP_PROMPT_THRESHOLD = 10;
const MAX_SKILLS = 3;

interface ErrorPattern {
  id: string;
  regex: string;
  category?: string;
  severity?: string;
  skills?: string[];
  solution?: {
    brief?: string;
    steps?: string[];
  };
}

interface SolutionsFile {
  patterns: ErrorPattern[];
  categories?: Record<string, { related_skills?: string[] }>;
}

interface DedupFile {
  suggestions: Record<string, { pattern_id: string; prompt_count: number }>;
  prompt_count: number;
}

/**
 * Check if this was an error output
 */
function isErrorOutput(input: HookInput): boolean {
  const exitCode = input.exit_code;
  const toolError = input.tool_error || getField<string>(input, 'error') || '';
  const toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');

  // Check exit code
  if (exitCode !== undefined && exitCode !== null && exitCode !== 0) {
    return true;
  }

  // Check tool_error field
  if (toolError) {
    return true;
  }

  // Check output for error patterns
  const errorPattern = /error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|ENOENT|EACCES|EPERM/i;
  if (errorPattern.test(toolOutput)) {
    return true;
  }

  return false;
}

/**
 * Match error text against patterns in solutions file
 */
function matchErrorPattern(errorText: string, solutionsFile: string): ErrorPattern | null {
  if (!existsSync(solutionsFile)) {
    logHook('error-solution-suggester', `Solutions file not found: ${solutionsFile}`);
    return null;
  }

  try {
    const content: SolutionsFile = JSON.parse(readFileSync(solutionsFile, 'utf8'));
    const errorLower = errorText.toLowerCase();

    for (const pattern of content.patterns || []) {
      if (pattern.regex) {
        try {
          const regex = new RegExp(pattern.regex, 'i');
          if (regex.test(errorLower)) {
            return pattern;
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
  } catch {
    // Parse error
  }

  return null;
}

/**
 * Check if we should suggest for this pattern (deduplication)
 */
function shouldSuggest(patternId: string, errorContext: string, dedupFile: string): boolean {
  // Initialize dedup file if needed
  if (!existsSync(dedupFile)) {
    try {
      mkdirSync(require('path').dirname(dedupFile), { recursive: true });
      writeFileSync(dedupFile, JSON.stringify({ suggestions: {}, prompt_count: 0 }));
    } catch {
      return true; // Allow if we can't track
    }
  }

  try {
    const dedup: DedupFile = JSON.parse(readFileSync(dedupFile, 'utf8'));

    // Create hash of pattern ID + first 100 chars of error
    const suggestionHash = createHash('md5')
      .update(`${patternId}|${errorContext.substring(0, 100)}`)
      .digest('hex');

    // Increment prompt count
    const currentCount = (dedup.prompt_count || 0) + 1;
    dedup.prompt_count = currentCount;

    // Get last suggested prompt count for this hash
    const lastSuggestedAt = dedup.suggestions[suggestionHash]?.prompt_count || 0;

    // Allow if never suggested or more than threshold prompts ago
    if (lastSuggestedAt === 0 || (currentCount - lastSuggestedAt) >= DEDUP_PROMPT_THRESHOLD) {
      // Record this suggestion
      dedup.suggestions[suggestionHash] = { pattern_id: patternId, prompt_count: currentCount };
      writeFileSync(dedupFile, JSON.stringify(dedup, null, 2));
      return true;
    }

    writeFileSync(dedupFile, JSON.stringify(dedup, null, 2));
    return false;
  } catch {
    return true; // Allow if we can't track
  }
}

/**
 * Get skill description from SKILL.md frontmatter
 */
function getSkillDescription(skillName: string, skillsDir: string): string {
  const skillFile = `${skillsDir}/${skillName}/SKILL.md`;

  if (!existsSync(skillFile)) return '';

  try {
    const content = readFileSync(skillFile, 'utf8');
    // Extract description from YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const descMatch = frontmatterMatch[1].match(/description:\s*(.+)/);
      if (descMatch) {
        return descMatch[1].trim();
      }
    }
  } catch {
    // Ignore read errors
  }

  return '';
}

/**
 * Build skills section for message
 */
function buildSkillsSection(pattern: ErrorPattern, solutionsFile: string, skillsDir: string): string {
  const category = pattern.category || '';

  // Get skills from pattern
  const patternSkills = pattern.skills || [];

  // Get skills from category
  let categorySkills: string[] = [];
  if (category && existsSync(solutionsFile)) {
    try {
      const content: SolutionsFile = JSON.parse(readFileSync(solutionsFile, 'utf8'));
      categorySkills = content.categories?.[category]?.related_skills || [];
    } catch {
      // Ignore
    }
  }

  // Combine and dedupe skills
  const allSkills = [...new Set([...patternSkills, ...categorySkills])].slice(0, MAX_SKILLS);

  if (allSkills.length === 0) return '';

  let section = '### Related Skills\n\n';

  for (const skill of allSkills) {
    const desc = getSkillDescription(skill, skillsDir);
    if (desc) {
      section += `- **${skill}**: ${desc}\n`;
    } else {
      section += `- **${skill}**\n`;
    }
  }

  section += '\nUse `/ork:<skill-name>` or `Read skills/<skill-name>/SKILL.md`';

  return section;
}

/**
 * Build the suggestion message
 */
function buildSuggestionMessage(pattern: ErrorPattern, solutionsFile: string, skillsDir: string): string {
  const brief = pattern.solution?.brief || 'An error was detected.';
  const steps = pattern.solution?.steps || [];

  let msg = '## Error Solution\n\n';
  msg += `**${brief}**\n\n`;

  if (steps.length > 0) {
    msg += '### Quick Fixes\n\n';
    steps.forEach((step, i) => {
      msg += `  ${i + 1}. ${step}\n`;
    });
    msg += '\n';
  }

  // Add skills section
  const skillsSection = buildSkillsSection(pattern, solutionsFile, skillsDir);
  if (skillsSection) {
    msg += skillsSection;
  }

  // Truncate if too long
  if (msg.length > MAX_CONTEXT_CHARS) {
    msg = msg.substring(0, MAX_CONTEXT_CHARS - 20) + '...\n\n(truncated)';
  }

  return msg;
}

/**
 * Suggest solutions for errors
 */
export function errorSolutionSuggester(input: HookInput): HookResult {
  // Self-guard: Only run for Bash tool
  if (input.tool_name !== 'Bash') {
    return outputSilentSuccess();
  }

  // Self-guard: Only run if there was an error
  if (!isErrorOutput(input)) {
    return outputSilentSuccess();
  }

  logHook('error-solution-suggester', 'Error detected, analyzing for solutions...');

  // Get error content
  const toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');
  const toolError = String(input.tool_error || getField<string>(input, 'error') || '');

  // Combine error sources (prefer explicit error, then output)
  let errorText = toolError || toolOutput;
  errorText = errorText.substring(0, 2000); // Truncate for matching

  if (!errorText) {
    logHook('error-solution-suggester', 'No error text found');
    return outputSilentSuccess();
  }

  const pluginRoot = getPluginRoot();
  const solutionsFile = `${pluginRoot}/.claude/rules/error_solutions.json`;
  const skillsDir = `${pluginRoot}/skills`;
  const sessionId = getSessionId();
  const dedupFile = `/tmp/claude-error-suggestions-${sessionId}.json`;

  // Match against patterns
  const matchedPattern = matchErrorPattern(errorText, solutionsFile);

  if (!matchedPattern) {
    logHook('error-solution-suggester', 'No matching pattern found');
    return outputSilentSuccess();
  }

  logHook('error-solution-suggester', `Matched pattern: ${matchedPattern.id}`);

  // Check deduplication
  if (!shouldSuggest(matchedPattern.id, errorText, dedupFile)) {
    logHook('error-solution-suggester', `Skipping duplicate suggestion for pattern: ${matchedPattern.id}`);
    return outputSilentSuccess();
  }

  // Build suggestion message
  const suggestionMessage = buildSuggestionMessage(matchedPattern, solutionsFile, skillsDir);

  if (suggestionMessage) {
    logHook('error-solution-suggester', 'Injecting solution suggestion via additionalContext');

    return {
      continue: true,
      hookSpecificOutput: {
        additionalContext: suggestionMessage,
      },
    };
  }

  return outputSilentSuccess();
}

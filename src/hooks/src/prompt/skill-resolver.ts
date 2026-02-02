/**
 * Skill Resolver - Unified UserPromptSubmit Hook
 * Merges skill-auto-suggest + skill-injector into a single hook.
 *
 * Issue #278: Three-tier UX with dual output channels
 * - systemMessage: Brief user notification (80-89% confidence)
 * - additionalContext: Full context for Claude (all tiers)
 *
 * Confidence tiers:
 * - >= 90%: Silent injection (Claude gets content, user sees nothing)
 * - 80-89%: Notify injection (user sees "💡 Loaded: X", Claude gets content)
 * - 70-79%: Suggestion (Claude gets summary, user sees nothing)
 * - 50-69%: Hint (Claude gets minimal hint, user sees nothing)
 * - < 50%: Silent success (nothing)
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext + systemMessage
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithNotification, logHook, getPluginRoot, estimateTokenCount, normalizeLineEndings } from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadConfig,
  isSkillInjected,
  trackInjectedSkill,
  getLastClassification,
} from '../lib/orchestration-state.js';
import { classifyIntent, shouldClassify } from '../lib/intent-classifier.js';
import type { ClassificationResult, SkillMatch } from '../lib/orchestration-types.js';
import { findMatchingSkills as findKeywordSkills } from './skill-auto-suggest.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum tokens for full skill content injection */
const MAX_INJECTION_TOKENS = 800;

/** Maximum skills to inject per prompt (full tier) */
const MAX_FULL_INJECT = 2;

/** Maximum skills to suggest (hint/summary tier) */
const MAX_SUGGESTIONS = 3;

/**
 * Confidence tiers (Issue #278: Three-tier UX)
 * - SILENT: High confidence, inject without user notification
 * - NOTIFY: Good confidence, notify user + inject
 * - SUGGEST: Medium confidence, suggest to Claude only
 * - HINT: Low confidence, minimal hint to Claude
 */
const TIER_SILENT = 90;
const TIER_NOTIFY = 80;
const TIER_SUGGEST = 70;
const TIER_HINT = 50;

// -----------------------------------------------------------------------------
// Skill Content Loading & Compression
// -----------------------------------------------------------------------------

/**
 * Load and compress skill content from SKILL.md.
 * Strips: frontmatter, ## References sections, excessive blanks,
 * and truncates code blocks >10 lines.
 */
function loadCompressedSkillContent(skillName: string, maxTokens: number): string | null {
  const pluginRoot = getPluginRoot();
  const skillFile = join(pluginRoot, 'skills', skillName, 'SKILL.md');

  if (!existsSync(skillFile)) {
    logHook('skill-resolver', 'Skill file not found: ' + skillFile);
    return null;
  }

  try {
    let content = normalizeLineEndings(readFileSync(skillFile, 'utf8'));

    // Remove frontmatter
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
    if (frontmatterMatch) {
      content = content.slice(frontmatterMatch[0].length);
    }

    // Strip ## References sections (just file links)
    content = content.replace(/^## References[\s\S]*?(?=^## |\Z)/gm, '');

    // Truncate code blocks >10 lines to 5 lines + notice
    content = content.replace(/```[\s\S]*?```/g, (block) => {
      const lines = block.split('\n');
      if (lines.length > 12) {
        const truncated = lines.slice(0, 7).join('\n');
        return truncated + '\n# ... truncated\n```';
      }
      return block;
    });

    // Collapse excessive blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.trim();

    // Truncate to token budget
    const maxChars = Math.floor(maxTokens * 3.5);
    if (content.length > maxChars) {
      const truncated = content.slice(0, maxChars);
      const lastParagraph = truncated.lastIndexOf('\n\n');
      if (lastParagraph > maxChars * 0.6) {
        content = truncated.slice(0, lastParagraph) + '\n\n[... truncated for context budget]';
      } else {
        content = truncated + '\n\n[... truncated for context budget]';
      }
    }

    return content;
  } catch (err) {
    logHook('skill-resolver', 'Failed to load skill: ' + String(err));
    return null;
  }
}

/**
 * Get skill description from SKILL.md frontmatter
 */
function getSkillDescription(skillName: string): string {
  const pluginRoot = getPluginRoot();
  const skillFile = join(pluginRoot, 'skills', skillName, 'SKILL.md');

  if (!existsSync(skillFile)) return '';

  try {
    const content = normalizeLineEndings(readFileSync(skillFile, 'utf8'));
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
      if (descMatch) return descMatch[1].trim();
    }
  } catch {
    // Ignore
  }
  return '';
}

// -----------------------------------------------------------------------------
// Message Building (Issue #278: User-friendly, no raw percentages)
// -----------------------------------------------------------------------------

/**
 * Build user notification for systemMessage channel.
 * Brief, friendly message shown to user.
 */
function buildUserNotification(loadedSkills: Array<{ skill: string }>): string {
  if (loadedSkills.length === 0) return '';
  const names = loadedSkills.slice(0, 2).map(s => s.skill).join(', ');
  return `\u{1F4A1} Loaded: ${names}`;
}

/**
 * Build Claude context for additionalContext channel.
 * Full content without raw percentages, friendlier headers.
 */
function buildClaudeContext(
  loadedSkills: Array<{ skill: string; content: string }>,
  suggestedSkills: SimpleSkillMatch[]
): string {
  const parts: string[] = [];

  // Full content for loaded skills (no percentages)
  if (loadedSkills.length > 0) {
    parts.push('## Relevant Patterns Loaded\n');
    for (const { skill, content } of loadedSkills) {
      parts.push(`### ${skill}\n\n${content}\n\n---\n`);
    }
  }

  // Suggestions for medium-confidence skills (no percentages)
  if (suggestedSkills.length > 0) {
    parts.push('\n## Also Available\n');
    for (const { skill } of suggestedSkills) {
      const desc = getSkillDescription(skill);
      parts.push(`- **${skill}**${desc ? ` \u2014 ${desc}` : ''}`);
    }
    parts.push('\nUse `/ork:<skill>` to load full content.');
  }

  return parts.join('\n').trim();
}

/**
 * Build hint context for low-confidence matches.
 * Minimal hint for Claude, no user notification.
 */
function buildHintContext(skills: SimpleSkillMatch[]): string {
  if (skills.length === 0) return '';
  const names = skills.map(s => s.skill).join(', ');
  return `Related skills available: ${names}. Use /ork:<skill> if needed.`;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SimpleSkillMatch {
  skill: string;
  confidence: number;
}

// -----------------------------------------------------------------------------
// Unified Resolver
// -----------------------------------------------------------------------------

/**
 * Skill resolver hook - unified replacement for skill-auto-suggest + skill-injector.
 */
export function skillResolver(input: HookInput): HookResult {
  const prompt = input.prompt || '';

  if (!prompt || !shouldClassify(prompt)) {
    return outputSilentSuccess();
  }

  const config = loadConfig();
  logHook('skill-resolver', 'Analyzing prompt for skill resolution...');

  // Single classification pass (reuse cached if available)
  let result: ClassificationResult | undefined = getLastClassification();
  if (!result) {
    result = classifyIntent(prompt);
  }

  // Also check keyword-based matches for broader coverage
  const keywordMatches = findKeywordSkills(prompt);

  // Merge: prefer intent classifier results, supplement with keyword matches
  const allSkills = mergeSkillMatches(result.skills, keywordMatches);

  if (allSkills.length === 0) {
    logHook('skill-resolver', 'No skill matches found');
    return outputSilentSuccess();
  }

  logHook('skill-resolver',
    'Found ' + allSkills.length + ' skills: ' + allSkills.map(s => s.skill + ':' + s.confidence).join(', '));

  // Partition into NEW tiers (Issue #278: Three-tier UX)
  const silentTier = allSkills.filter(s => s.confidence >= TIER_SILENT);
  const notifyTier = allSkills.filter(s => s.confidence >= TIER_NOTIFY && s.confidence < TIER_SILENT);
  const suggestTier = allSkills.filter(s => s.confidence >= TIER_SUGGEST && s.confidence < TIER_NOTIFY);
  const hintTier = allSkills.filter(s => s.confidence >= TIER_HINT && s.confidence < TIER_SUGGEST);

  // Load full content for high-confidence skills (silent + notify tiers)
  const loadedSkills: Array<{ skill: string; content: string }> = [];

  if (config.enableSkillInjection) {
    const maxTotalTokens = config.maxSkillInjectionTokens || MAX_INJECTION_TOKENS;
    const skillsToLoad = [...silentTier, ...notifyTier].slice(0, MAX_FULL_INJECT);
    const skillCount = Math.min(skillsToLoad.length, MAX_FULL_INJECT);
    const tokensPerSkill = skillCount > 0 ? Math.floor(maxTotalTokens / skillCount) : maxTotalTokens;
    let totalTokens = 0;

    for (const match of skillsToLoad) {
      if (isSkillInjected(match.skill)) continue;

      const remainingTokens = maxTotalTokens - totalTokens;
      if (remainingTokens < 100) break;

      const content = loadCompressedSkillContent(
        match.skill,
        Math.min(tokensPerSkill, remainingTokens)
      );

      if (content) {
        const tokens = estimateTokenCount(content);
        totalTokens += tokens;
        loadedSkills.push({ skill: match.skill, content });
        trackInjectedSkill(match.skill);
        logHook('skill-resolver', 'Loaded: ' + match.skill + ' (~' + tokens + 't)');
      }
    }
  }

  // Build outputs for each channel (Issue #278: Dual-channel output)
  const claudeContext = buildClaudeContext(loadedSkills, suggestTier.slice(0, MAX_SUGGESTIONS));
  const hintContext = buildHintContext(hintTier.slice(0, MAX_SUGGESTIONS));
  const fullContext = [claudeContext, hintContext].filter(Boolean).join('\n\n');

  // Determine user notification (only for notify tier, not silent tier)
  const shouldNotifyUser = notifyTier.length > 0 && loadedSkills.length > 0;
  const userMessage = shouldNotifyUser ? buildUserNotification(loadedSkills) : '';

  if (!fullContext && !userMessage) {
    logHook('skill-resolver', 'No content to output');
    return outputSilentSuccess();
  }

  logHook('skill-resolver',
    'Output: ' + (userMessage ? 'notify ' : 'silent ') +
    '(~' + estimateTokenCount(fullContext) + 't context)');

  // Return with appropriate channels (Issue #278: systemMessage + additionalContext)
  return outputWithNotification(userMessage || undefined, fullContext || undefined);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Merge intent-classifier skill matches with keyword-based matches.
 * Deduplicates by skill name, keeping highest confidence.
 */
function mergeSkillMatches(
  classifierMatches: SkillMatch[],
  keywordMatches: SimpleSkillMatch[]
): SimpleSkillMatch[] {
  const map = new Map<string, number>();

  for (const m of classifierMatches) {
    const current = map.get(m.skill) || 0;
    if (m.confidence > current) map.set(m.skill, m.confidence);
  }

  for (const m of keywordMatches) {
    const current = map.get(m.skill) || 0;
    if (m.confidence > current) map.set(m.skill, m.confidence);
  }

  return Array.from(map.entries())
    .map(([skill, confidence]) => ({ skill, confidence }))
    .sort((a, b) => b.confidence - a.confidence);
}

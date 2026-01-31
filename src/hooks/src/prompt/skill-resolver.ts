/**
 * Skill Resolver - Unified UserPromptSubmit Hook
 * Merges skill-auto-suggest + skill-injector into a single hook.
 *
 * Runs classifyIntent() once and applies tiered response:
 * - confidence >= 80%: inject full (compressed) skill content
 * - confidence 50-79%: output lightweight suggestion list
 * - confidence < 50%: silent success
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getPluginRoot, estimateTokenCount } from '../lib/common.js';
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

/** Confidence tiers */
const TIER_FULL = 80;
const TIER_SUMMARY = 70;
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
    // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
    let content = readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n');

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
    // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
    const content = readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n');
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

/**
 * Extract 3 key bullet points from skill content for summary tier
 */
function extractKeyBullets(skillName: string): string[] {
  const pluginRoot = getPluginRoot();
  const skillFile = join(pluginRoot, 'skills', skillName, 'SKILL.md');

  if (!existsSync(skillFile)) return [];

  try {
    // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
    const content = readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n');
    const bullets: string[] = [];
    const headings = content.match(/^## .+$/gm) || [];
    for (const h of headings.slice(0, 3)) {
      const text = h.replace(/^## /, '').trim();
      if (text && text !== 'References' && text.length < 80) {
        bullets.push(text);
      }
    }
    return bullets.slice(0, 3);
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Message Building
// -----------------------------------------------------------------------------

function buildHintMessage(skills: SimpleSkillMatch[]): string {
  if (skills.length === 0) return '';
  const lines = skills.map(s => '- **' + s.skill + '** \u2014 Use `/ork:' + s.skill + '` to load');
  return '## Skill Hints\n\n' + lines.join('\n');
}

function buildSummaryMessage(skills: SimpleSkillMatch[]): string {
  if (skills.length === 0) return '';
  let message = '## Relevant Skills\n\n';
  for (const { skill, confidence } of skills) {
    const desc = getSkillDescription(skill);
    const bullets = extractKeyBullets(skill);
    message += '### ' + skill + ' (' + confidence + '% match)\n';
    if (desc) message += desc + '\n';
    if (bullets.length > 0) {
      message += bullets.map(b => '- ' + b).join('\n') + '\n';
    }
    message += 'Use `/ork:' + skill + '` to load full content.\n\n';
  }
  return message.trim();
}

function buildFullInjectionMessage(skills: Array<{ skill: string; content: string }>): string {
  if (skills.length === 0) return '';
  let message = '## Skill Knowledge Injected\n\nAuto-loaded based on your prompt:\n\n';
  for (const { skill, content } of skills) {
    message += '### ' + skill + '\n\n' + content + '\n\n---\n\n';
  }
  return message.trim();
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

  // Partition into tiers
  const fullTier = allSkills.filter(s => s.confidence >= TIER_FULL);
  const summaryTier = allSkills.filter(s => s.confidence >= TIER_SUMMARY && s.confidence < TIER_FULL);
  const hintTier = allSkills.filter(s => s.confidence >= TIER_HINT && s.confidence < TIER_SUMMARY);

  const parts: string[] = [];

  // Full tier: inject compressed content (if injection enabled)
  if (fullTier.length > 0 && config.enableSkillInjection) {
    const maxTotalTokens = config.maxSkillInjectionTokens || MAX_INJECTION_TOKENS;
    const skillCount = Math.min(fullTier.length, MAX_FULL_INJECT);
    const tokensPerSkill = Math.floor(maxTotalTokens / skillCount);

    const loadedSkills: Array<{ skill: string; content: string }> = [];
    let totalTokens = 0;

    for (const match of fullTier.slice(0, MAX_FULL_INJECT)) {
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
        logHook('skill-resolver', 'Full inject: ' + match.skill + ' (~' + tokens + 't)');
      }
    }

    if (loadedSkills.length > 0) {
      parts.push(buildFullInjectionMessage(loadedSkills));
    }
  }

  // Summary tier
  if (summaryTier.length > 0) {
    const summarySkills = summaryTier.slice(0, MAX_SUGGESTIONS);
    parts.push(buildSummaryMessage(summarySkills));
    logHook('skill-resolver', 'Summary: ' + summarySkills.map(s => s.skill).join(', '));
  }

  // Hint tier
  if (hintTier.length > 0) {
    const hintSkills = hintTier.slice(0, MAX_SUGGESTIONS);
    parts.push(buildHintMessage(hintSkills));
    logHook('skill-resolver', 'Hints: ' + hintSkills.map(s => s.skill).join(', '));
  }

  if (parts.length === 0) {
    return outputSilentSuccess();
  }

  const message = parts.join('\n\n');
  logHook('skill-resolver', 'Outputting ' + parts.length + ' tiers (~' + estimateTokenCount(message) + 't)');

  return outputPromptContext(message);
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

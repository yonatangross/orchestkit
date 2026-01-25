/**
 * Skill Injector - UserPromptSubmit Hook for Auto-Injecting Skill Content
 * Issue #197: Agent Orchestration Layer
 *
 * At confidence >= 80%: Auto-injects skill SKILL.md content
 * Maximum 800 tokens per skill injection to respect context budget
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getPluginRoot } from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadConfig,
  isSkillInjected,
  trackInjectedSkill,
  getLastClassification,
} from '../lib/orchestration-state.js';
import { classifyIntent, shouldClassify } from '../lib/intent-classifier.js';
import { THRESHOLDS } from '../lib/orchestration-types.js';
import type { ClassificationResult } from '../lib/orchestration-types.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum tokens for skill content injection */
const MAX_INJECTION_TOKENS = 800;

/** Approximate characters per token */
const CHARS_PER_TOKEN = 4;

/** Maximum skills to inject per prompt */
const MAX_SKILLS_PER_PROMPT = 2;

// -----------------------------------------------------------------------------
// Skill Content Loading
// -----------------------------------------------------------------------------

/**
 * Load skill content from SKILL.md
 * Returns truncated content to fit within token budget
 */
function loadSkillContent(skillName: string, maxTokens: number): string | null {
  const pluginRoot = getPluginRoot();
  const skillFile = join(pluginRoot, 'skills', skillName, 'SKILL.md');

  if (!existsSync(skillFile)) {
    logHook('skill-injector', `Skill file not found: ${skillFile}`);
    return null;
  }

  try {
    let content = readFileSync(skillFile, 'utf8');

    // Remove frontmatter
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
    if (frontmatterMatch) {
      content = content.slice(frontmatterMatch[0].length);
    }

    // Trim whitespace
    content = content.trim();

    // Truncate to token budget
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (content.length > maxChars) {
      // Try to break at a paragraph
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
    logHook('skill-injector', `Failed to load skill: ${err}`);
    return null;
  }
}

/**
 * Calculate token estimate for content
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

// -----------------------------------------------------------------------------
// Message Building
// -----------------------------------------------------------------------------

/**
 * Build injection message for skills
 */
function buildInjectionMessage(skills: Array<{ skill: string; content: string }>): string {
  if (skills.length === 0) return '';

  let message = `## 📚 Skill Knowledge Injected

The following skill patterns have been auto-loaded based on your prompt:

`;

  for (const { skill, content } of skills) {
    message += `### ${skill}

${content}

---

`;
  }

  message += `*Auto-injected by OrchestKit Agent Orchestration Layer*`;

  return message;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Skill injector hook
 *
 * Automatically injects relevant skill content when:
 * 1. Skill match confidence >= 80%
 * 2. Skill not already injected in session
 * 3. Within token budget
 */
export function skillInjector(input: HookInput): HookResult {
  const prompt = input.prompt || '';

  // Quick filter
  if (!shouldClassify(prompt)) {
    return outputSilentSuccess();
  }

  // Load config
  const config = loadConfig();

  if (!config.enableSkillInjection) {
    return outputSilentSuccess();
  }

  logHook('skill-injector', 'Checking for skill injection...');

  // Try to use cached classification from agent-orchestrator
  let result: ClassificationResult | undefined = getLastClassification();

  // If no cached result, run classification
  if (!result) {
    result = classifyIntent(prompt);
  }

  // Filter skills above injection threshold
  const eligibleSkills = result.skills.filter(
    s => s.confidence >= THRESHOLDS.SKILL_INJECT && !isSkillInjected(s.skill)
  );

  if (eligibleSkills.length === 0) {
    logHook('skill-injector', 'No eligible skills for injection');
    return outputSilentSuccess();
  }

  // Calculate token budget per skill
  const maxTotalTokens = config.maxSkillInjectionTokens || MAX_INJECTION_TOKENS;
  const skillCount = Math.min(eligibleSkills.length, MAX_SKILLS_PER_PROMPT);
  const tokensPerSkill = Math.floor(maxTotalTokens / skillCount);

  // Load skill content
  const loadedSkills: Array<{ skill: string; content: string }> = [];
  let totalTokens = 0;

  for (const match of eligibleSkills.slice(0, MAX_SKILLS_PER_PROMPT)) {
    const remainingTokens = maxTotalTokens - totalTokens;
    if (remainingTokens < 100) break; // Minimum useful content

    const content = loadSkillContent(match.skill, Math.min(tokensPerSkill, remainingTokens));

    if (content) {
      const tokens = estimateTokens(content);
      totalTokens += tokens;

      loadedSkills.push({ skill: match.skill, content });
      trackInjectedSkill(match.skill);

      logHook('skill-injector', `Loaded skill ${match.skill} (~${tokens} tokens)`);
    }
  }

  if (loadedSkills.length === 0) {
    return outputSilentSuccess();
  }

  // Build injection message
  const message = buildInjectionMessage(loadedSkills);

  logHook(
    'skill-injector',
    `Injecting ${loadedSkills.length} skills (~${totalTokens} tokens): ${loadedSkills.map(s => s.skill).join(', ')}`
  );

  return outputPromptContext(message);
}
